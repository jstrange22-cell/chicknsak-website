import Dexie, { type Table } from 'dexie';

export interface OfflinePhoto {
  id: string;
  blob: Blob;
  projectId: string;
  companyId: string;
  tags: string[];
  description: string;
  latitude?: number;
  longitude?: number;
  capturedAt: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

export interface OfflineAction {
  id: string;
  type: string; // create_comment, complete_checklist_item, clock_in, clock_out, update_task
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
}

class OfflineDatabase extends Dexie {
  photos!: Table<OfflinePhoto>;
  actions!: Table<OfflineAction>;

  constructor() {
    super('structureworks-field');
    this.version(1).stores({
      photos: 'id, projectId, status, createdAt',
      actions: 'id, type, status, createdAt',
    });
  }
}

export const offlineDb = new OfflineDatabase();
