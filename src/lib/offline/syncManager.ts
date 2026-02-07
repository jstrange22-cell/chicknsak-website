import { offlineDb, type OfflinePhoto, type OfflineAction } from './db';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';

const MAX_RETRIES = 3;
const CLEANUP_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

class SyncManager {
  private _isSyncing = false;

  isOnline(): boolean {
    return navigator.onLine;
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  async queuePhoto(
    photo: Omit<OfflinePhoto, 'status' | 'retryCount' | 'createdAt'>
  ): Promise<void> {
    await offlineDb.photos.add({
      ...photo,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  async queueAction(
    action: Omit<OfflineAction, 'status' | 'retryCount' | 'createdAt'>
  ): Promise<void> {
    await offlineDb.actions.add({
      ...action,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    });
  }

  async getPendingCounts(): Promise<{ photos: number; actions: number }> {
    const photos = await offlineDb.photos
      .where('status')
      .anyOf(['pending', 'uploading'])
      .count();
    const actions = await offlineDb.actions
      .where('status')
      .anyOf(['pending', 'processing'])
      .count();
    return { photos, actions };
  }

  async processQueue(
    onProgress?: (msg: string) => void
  ): Promise<{ photosProcessed: number; actionsProcessed: number }> {
    if (this._isSyncing || !this.isOnline()) {
      return { photosProcessed: 0, actionsProcessed: 0 };
    }

    this._isSyncing = true;
    let photosProcessed = 0;
    let actionsProcessed = 0;

    try {
      // Process photos
      const pendingPhotos = await offlineDb.photos
        .where('status')
        .equals('pending')
        .toArray();

      for (const photo of pendingPhotos) {
        try {
          onProgress?.(
            `Uploading photo ${photosProcessed + 1}/${pendingPhotos.length}...`
          );
          await offlineDb.photos.update(photo.id, { status: 'uploading' });

          // Upload blob to Firebase Storage
          const storageRef = ref(
            storage,
            `photos/${photo.companyId}/${photo.projectId}/${photo.id}`
          );
          await uploadBytes(storageRef, photo.blob);
          const url = await getDownloadURL(storageRef);

          // Create Firestore document for the photo
          const photoRef = doc(collection(db, 'photos'));
          await setDoc(photoRef, {
            id: photoRef.id,
            projectId: photo.projectId,
            companyId: photo.companyId,
            uploadedBy: 'offline-sync',
            storagePath: storageRef.fullPath,
            url,
            description: photo.description || '',
            location:
              photo.latitude != null && photo.longitude != null
                ? { latitude: photo.latitude, longitude: photo.longitude }
                : null,
            capturedAt: new Date(photo.capturedAt),
            photoType: 'standard',
            mimeType: photo.blob.type || 'image/jpeg',
            fileSizeBytes: photo.blob.size,
            metadata: { offlineUpload: true },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await offlineDb.photos.update(photo.id, { status: 'completed' });
          photosProcessed++;
        } catch (err) {
          const retryCount = (photo.retryCount || 0) + 1;
          await offlineDb.photos.update(photo.id, {
            status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
            retryCount,
            errorMessage:
              err instanceof Error ? err.message : 'Upload failed',
          });
        }
      }

      // Process queued actions
      const pendingActions = await offlineDb.actions
        .where('status')
        .equals('pending')
        .toArray();

      for (const action of pendingActions) {
        try {
          onProgress?.(`Processing action: ${action.type}...`);
          await offlineDb.actions.update(action.id, { status: 'processing' });

          await processAction(action);

          await offlineDb.actions.update(action.id, { status: 'completed' });
          actionsProcessed++;
        } catch (err) {
          const retryCount = (action.retryCount || 0) + 1;
          await offlineDb.actions.update(action.id, {
            status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
            retryCount,
            errorMessage:
              err instanceof Error ? err.message : 'Action failed',
          });
        }
      }

      // Clean up completed items older than 24 hours
      const cutoff = new Date(Date.now() - CLEANUP_THRESHOLD_MS).toISOString();
      await offlineDb.photos
        .where('status')
        .equals('completed')
        .and((p) => p.createdAt < cutoff)
        .delete();
      await offlineDb.actions
        .where('status')
        .equals('completed')
        .and((a) => a.createdAt < cutoff)
        .delete();
    } finally {
      this._isSyncing = false;
    }

    return { photosProcessed, actionsProcessed };
  }
}

async function processAction(action: OfflineAction): Promise<void> {
  const { type, payload } = action;

  switch (type) {
    case 'create_comment': {
      const commentRef = doc(collection(db, 'comments'));
      await setDoc(commentRef, {
        id: commentRef.id,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      break;
    }
    case 'complete_checklist_item': {
      const { checklistItemId, ...updateData } = payload as {
        checklistItemId: string;
        [key: string]: unknown;
      };
      await updateDoc(doc(db, 'checklistItems', checklistItemId), {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      break;
    }
    case 'clock_in':
    case 'clock_out': {
      const entryRef = doc(collection(db, 'timeEntries'));
      await setDoc(entryRef, {
        id: entryRef.id,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      break;
    }
    case 'update_task': {
      const { taskId, ...taskData } = payload as {
        taskId: string;
        [key: string]: unknown;
      };
      await updateDoc(doc(db, 'tasks', taskId), {
        ...taskData,
        updatedAt: serverTimestamp(),
      });
      break;
    }
    default:
      console.warn(`Unknown offline action type: ${type}`);
  }
}

export const syncManager = new SyncManager();
