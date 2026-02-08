import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from './firebase';
import { compressImage, generateThumbnail, getImageDimensions, generateFilename } from './imageProcessing';
import { logActivity } from './activityLogger';

interface UploadPhotoParams {
  file: Blob;
  projectId: string;
  userId: string;
  companyId: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  capturedAt?: Date;
  isBefore?: boolean;
  isAfter?: boolean;
  isInternal?: boolean;
  tags?: string[];
}

interface UploadResult {
  photoId: string;
  originalUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
}

/**
 * Parse a Firebase Storage error into a user-friendly message.
 */
function getStorageErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'storage/unauthorized':
      case 'storage/unauthenticated':
        return 'You do not have permission to upload photos. Please sign in again and try once more.';
      case 'storage/quota-exceeded':
        return 'Storage quota has been exceeded. Please contact your administrator to upgrade the storage plan.';
      case 'storage/canceled':
        return 'The upload was canceled.';
      case 'storage/retry-limit-exceeded':
        return 'Upload failed after multiple retries. Please check your internet connection and try again.';
      case 'storage/invalid-checksum':
        return 'The file was corrupted during upload. Please try again.';
      case 'storage/server-file-wrong-size':
        return 'Upload verification failed (file size mismatch). Please try again.';
      case 'storage/unknown':
      default:
        return `Upload failed (${code}). Please check your internet connection and try again.`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred during upload.';
}

/**
 * Parse a Firestore error into a user-friendly message.
 */
function getFirestoreErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'permission-denied':
        return 'You do not have permission to save photo data. Please sign in again.';
      case 'resource-exhausted':
        return 'Database quota exceeded. Please contact your administrator.';
      case 'unavailable':
        return 'The database is temporarily unavailable. Please try again in a moment.';
      default:
        return `Failed to save photo record (${code}). Please try again.`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred while saving the photo record.';
}

export async function uploadPhoto(params: UploadPhotoParams): Promise<UploadResult> {
  const {
    file,
    projectId,
    userId,
    companyId,
    description,
    latitude,
    longitude,
    capturedAt = new Date(),
    isBefore = false,
    isAfter = false,
    isInternal = false,
    tags = [],
  } = params;

  const filename = generateFilename();
  const thumbFilename = `thumb_${filename}`;

  const storagePath = `photos/${companyId}/${projectId}/${filename}`;
  const thumbnailPath = `photos/${companyId}/${projectId}/thumbs/${thumbFilename}`;

  // ---- Step 1: Process images ----
  let compressedImage: Blob;
  let thumbnail: Blob;
  let dimensions: { width: number; height: number };

  try {
    // Run compression and thumbnail in parallel, but get dimensions separately
    // so that a thumbnail failure does not block the main image.
    [compressedImage, thumbnail, dimensions] = await Promise.all([
      compressImage(file, 2048, 0.85),
      generateThumbnail(file, 400, 0.6),
      getImageDimensions(file),
    ]);
  } catch (processingError) {
    console.error('[uploadPhoto] Image processing failed:', processingError);
    const detail = processingError instanceof Error ? processingError.message : String(processingError);
    throw new Error(
      `Photo processing failed: ${detail}. `
      + 'Try taking the photo again, or use a smaller image.'
    );
  }

  // ---- Step 2: Upload to Firebase Storage ----
  let originalUrl: string;
  let thumbnailUrl: string;

  try {
    const originalRef = ref(storage, storagePath);
    const thumbnailRef = ref(storage, thumbnailPath);

    const [originalSnapshot, thumbnailSnapshot] = await Promise.all([
      uploadBytes(originalRef, compressedImage, { contentType: 'image/jpeg' }),
      uploadBytes(thumbnailRef, thumbnail, { contentType: 'image/jpeg' }),
    ]);

    [originalUrl, thumbnailUrl] = await Promise.all([
      getDownloadURL(originalSnapshot.ref),
      getDownloadURL(thumbnailSnapshot.ref),
    ]);
  } catch (uploadError) {
    const errorCode = uploadError && typeof uploadError === 'object' && 'code' in uploadError
      ? (uploadError as { code: string }).code
      : 'unknown';
    const errorServerResponse = uploadError && typeof uploadError === 'object' && 'serverResponse' in uploadError
      ? (uploadError as { serverResponse: string }).serverResponse
      : null;
    console.error(
      '[uploadPhoto] Firebase Storage upload failed.\n' +
      `  Error code : ${errorCode}\n` +
      `  Storage path : ${storagePath}\n` +
      `  File size : ${compressedImage.size} bytes\n` +
      `  Server response: ${errorServerResponse || '(none)'}`,
      uploadError,
    );
    const userMessage = getStorageErrorMessage(uploadError);
    throw new Error(userMessage);
  }

  // ---- Step 3: Create Firestore document ----
  let photoId: string;

  try {
    const photoData = {
      projectId,
      companyId,
      userId,
      uploadedBy: userId,
      storagePath,
      thumbnailPath,
      url: originalUrl,
      originalUrl,
      thumbnailUrl,
      description: description || null,
      latitude: latitude || null,
      longitude: longitude || null,
      capturedAt: capturedAt,
      isBefore,
      isAfter,
      isInternal,
      photoType: isBefore ? 'before' : isAfter ? 'after' : 'progress',
      fileSizeBytes: compressedImage.size,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: 'image/jpeg',
      metadata: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const photoRef = await addDoc(collection(db, 'photos'), photoData);
    photoId = photoRef.id;

    // Add tags if provided
    if (tags.length > 0) {
      try {
        const photoTagsCollection = collection(db, 'photoTags');
        await Promise.all(
          tags.map((tagId) =>
            addDoc(photoTagsCollection, {
              photoId,
              tagId,
              createdAt: serverTimestamp(),
            })
          )
        );
      } catch (tagError) {
        // Tags failing should not block the photo save
        console.warn('[uploadPhoto] Failed to save tags, but photo was saved:', tagError);
      }
    }
  } catch (firestoreError) {
    // Only rethrow if this is not a tag error (photo doc creation failed)
    if (!(firestoreError instanceof Error && firestoreError.message.includes('tags'))) {
      const fsCode = firestoreError && typeof firestoreError === 'object' && 'code' in firestoreError
        ? (firestoreError as { code: string }).code
        : 'unknown';
      console.error(
        '[uploadPhoto] Firestore document creation failed.\n' +
        `  Error code : ${fsCode}\n` +
        `  Collection : photos\n` +
        `  Project ID : ${projectId}\n` +
        `  Company ID : ${companyId}`,
        firestoreError,
      );
      throw new Error(getFirestoreErrorMessage(firestoreError));
    }
    // This shouldn't be reached, but as a safety net:
    throw firestoreError;
  }

  // ---- Step 4: Log activity (non-blocking, best-effort) ----
  try {
    await logActivity({
      companyId,
      projectId,
      userId,
      activityType: 'photo_uploaded',
      message: 'uploaded a photo',
      entityType: 'photo',
      entityId: photoId,
      thumbnailUrl,
    });
  } catch (activityError) {
    // Activity logging failure should never block the user
    console.warn('[uploadPhoto] Activity logging failed (photo was saved successfully):', activityError);
  }

  return {
    photoId,
    originalUrl,
    thumbnailUrl,
    storagePath,
    thumbnailPath,
  };
}
