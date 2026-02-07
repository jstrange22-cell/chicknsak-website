import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ActivityType } from '@/types';

interface LogActivityParams {
  companyId: string;
  projectId?: string;
  userId: string;
  activityType: ActivityType | string;
  message: string;
  entityType?: string;
  entityId?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams): Promise<string> {
  const activityData = {
    companyId: params.companyId,
    projectId: params.projectId || null,
    userId: params.userId,
    activityType: params.activityType,
    message: params.message,
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    thumbnailUrl: params.thumbnailUrl || null,
    metadata: params.metadata || {},
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'activityLog'), activityData);
  return docRef.id;
}
