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

  // Process images
  const [compressedImage, thumbnail, dimensions] = await Promise.all([
    compressImage(file, 2048, 0.85),
    generateThumbnail(file, 400, 0.6),
    getImageDimensions(file),
  ]);

  // Upload to Firebase Storage
  const originalRef = ref(storage, storagePath);
  const thumbnailRef = ref(storage, thumbnailPath);

  const [originalSnapshot, thumbnailSnapshot] = await Promise.all([
    uploadBytes(originalRef, compressedImage, { contentType: 'image/jpeg' }),
    uploadBytes(thumbnailRef, thumbnail, { contentType: 'image/jpeg' }),
  ]);

  // Get download URLs
  const [originalUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(originalSnapshot.ref),
    getDownloadURL(thumbnailSnapshot.ref),
  ]);


  // Create photo document in Firestore
  // Note: `url` is the primary field the Photo type expects for display.
  // We also store `originalUrl` for backward compatibility.
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

  // Add tags if provided
  if (tags.length > 0) {
    const photoTagsCollection = collection(db, 'photoTags');
    await Promise.all(
      tags.map((tagId) =>
        addDoc(photoTagsCollection, {
          photoId: photoRef.id,
          tagId,
          createdAt: serverTimestamp(),
        })
      )
    );
  }

  // Log activity
  await logActivity({
    companyId,
    projectId,
    userId,
    activityType: 'photo_uploaded',
    message: 'uploaded a photo',
    entityType: 'photo',
    entityId: photoRef.id,
    thumbnailUrl,
  });

  return {
    photoId: photoRef.id,
    originalUrl,
    thumbnailUrl,
    storagePath,
    thumbnailPath,
  };
}
