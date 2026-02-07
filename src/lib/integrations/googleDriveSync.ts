// Google Drive Sync Service
//
// Handles syncing project photos and documents to Google Drive.
// Uses a Firebase Cloud Function as a proxy for Drive API calls.

import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  rootFolderId?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callDriveFunction(
  action: string,
  credentials: DriveConfig,
  data?: Record<string, unknown>,
) {
  const googleDriveApi = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'googleDriveApi');
  const response = await googleDriveApi({ action, credentials, data });
  const result = response.data;

  if (result && !result.success) {
    throw new Error((result.error as string) || 'Drive request failed');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Test the Google Drive connection */
export async function testDriveConnection(config: DriveConfig): Promise<{
  success: boolean;
  files?: DriveFile[];
  error?: string;
}> {
  try {
    const result = await callDriveFunction('test-connection', config);
    return { success: true, files: result.files as DriveFile[] | undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection test failed',
    };
  }
}

/** Create a folder in Google Drive */
export async function createDriveFolder(
  config: DriveConfig,
  name: string,
  parentId?: string,
): Promise<DriveFolder> {
  const result = await callDriveFunction('create-folder', config, { name, parentId });
  return result.folder as DriveFolder;
}

/** Get or create a project-specific folder */
export async function getOrCreateProjectFolder(
  config: DriveConfig,
  projectName: string,
): Promise<{ folder: DriveFolder; created: boolean }> {
  const result = await callDriveFunction('get-or-create-project-folder', config, {
    projectName,
  });
  return {
    folder: result.folder as DriveFolder,
    created: result.created as boolean,
  };
}

/** Upload a photo to Drive from a Firebase Storage URL */
export async function uploadPhotoToDrive(
  config: DriveConfig,
  photoUrl: string,
  fileName: string,
  folderId?: string,
  description?: string,
): Promise<DriveFile> {
  const result = await callDriveFunction('upload-photo', config, {
    photoUrl,
    fileName,
    folderId,
    description,
  });
  return result.file as DriveFile;
}

/** List files in a Drive folder */
export async function listDriveFiles(
  config: DriveConfig,
  folderId?: string,
): Promise<DriveFile[]> {
  const result = await callDriveFunction('list-files', config, { folderId });
  return ((result.data as Record<string, unknown>)?.files as DriveFile[]) ?? [];
}

/** Backup all project photos to a Drive folder */
export async function backupProjectPhotos(
  config: DriveConfig,
  projectName: string,
  photos: Array<{ url: string; fileName: string; description?: string }>,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ uploaded: number; errors: string[] }> {
  // Get or create the project folder
  const { folder } = await getOrCreateProjectFolder(config, projectName);

  let uploaded = 0;
  const errors: string[] = [];

  for (let i = 0; i < photos.length; i++) {
    try {
      await uploadPhotoToDrive(
        config,
        photos[i].url,
        photos[i].fileName,
        folder.id,
        photos[i].description,
      );
      uploaded++;
    } catch (err) {
      errors.push(`${photos[i].fileName}: ${err instanceof Error ? err.message : 'Upload failed'}`);
    }
    onProgress?.(i + 1, photos.length);
  }

  return { uploaded, errors };
}
