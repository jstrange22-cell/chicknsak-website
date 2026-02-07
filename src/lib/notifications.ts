import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { NotificationType } from '@/types';

interface CreateNotificationParams {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const notificationData = {
    userId: params.userId,
    companyId: params.companyId,
    title: params.title,
    body: params.body || null,
    type: params.type,
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    actionUrl: params.actionUrl || null,
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'notifications'), notificationData);
  return docRef.id;
}

export async function notifyMentions(params: {
  mentionedUserIds: string[];
  companyId: string;
  mentionerName: string;
  photoId: string;
  projectId: string;
}) {
  const promises = params.mentionedUserIds.map((userId) =>
    createNotification({
      userId,
      companyId: params.companyId,
      title: `${params.mentionerName} mentioned you`,
      body: 'You were mentioned in a comment',
      type: 'mention',
      entityType: 'photo',
      entityId: params.photoId,
      actionUrl: `/projects/${params.projectId}`,
    })
  );
  await Promise.all(promises);
}

export async function notifyPhotoComment(params: {
  photoOwnerId: string;
  commenterId: string;
  commenterName: string;
  companyId: string;
  photoId: string;
  projectId: string;
}) {
  // Don't notify if commenting on own photo
  if (params.photoOwnerId === params.commenterId) return;

  await createNotification({
    userId: params.photoOwnerId,
    companyId: params.companyId,
    title: `${params.commenterName} commented on your photo`,
    body: 'New comment on your photo',
    type: 'comment',
    entityType: 'photo',
    entityId: params.photoId,
    actionUrl: `/projects/${params.projectId}`,
  });
}
