import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { compressImage, generateThumbnail, getImageDimensions, generateFilename } from './imageProcessing';
import { logActivity } from './activityLogger';

/**
 * Upload API endpoint — hosted on the same Hostinger server as the app.
 * Firebase Storage requires the Blaze (paid) plan, so we upload photos
 * directly to the web server via a PHP endpoint instead.
 */
const UPLOAD_URL = `${window.location.origin}/api/upload.php`;

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

  // ---- Step 1: Process images ----
  let compressedImage: Blob;
  let thumbnail: Blob;
  let dimensions: { width: number; height: number };

  try {
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

  // ---- Step 2: Upload to Hostinger server via PHP endpoint ----
  let originalUrl: string;
  let thumbnailUrl: string;
  let storagePath: string;
  let thumbnailPath: string;

  try {
    // Build FormData with the photo and thumbnail blobs
    const formData = new FormData();
    formData.append('photo', compressedImage, generateFilename());
    formData.append('thumbnail', thumbnail, `thumb_${generateFilename()}`);
    formData.append('companyId', companyId);
    formData.append('projectId', projectId);

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Upload failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = `Upload failed (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();

    if (!result.success || !result.url) {
      throw new Error(result.error || 'Upload failed — no URL returned');
    }

    originalUrl = result.url;
    thumbnailUrl = result.thumbnailUrl || result.url;
    storagePath = result.storagePath || '';
    thumbnailPath = result.thumbnailPath || '';
  } catch (uploadError) {
    console.error(
      '[uploadPhoto] Server upload failed.\n' +
      `  File size : ${compressedImage.size} bytes\n` +
      `  Project ID: ${projectId}`,
      uploadError,
    );

    // If fetch itself failed (network error), give a helpful message
    if (uploadError instanceof TypeError && uploadError.message.includes('fetch')) {
      throw new Error('Network error: Unable to reach the upload server. Please check your internet connection and try again.');
    }

    // Re-throw with the error message
    const msg = uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.';
    throw new Error(msg);
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
