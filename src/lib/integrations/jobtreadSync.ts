// JobTread <-> StructureWorks Field Sync Engine
// Handles bidirectional sync between JobTread jobs and Firestore projects.

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JobTreadClient, JobTreadApiError, type JobTreadJob } from './jobtread';
import type { ProjectStatus, Photo, Project } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: number;
  updated: number;
  errors: Array<{ jobId: string; message: string }>;
}

export interface BatchPhotoSyncConfig {
  /** Default JobTread folder ID to place uploaded files into */
  defaultFolderId?: string;
  /** Default tag names to apply to every uploaded file */
  defaultTags?: string[];
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

const JOBTREAD_STATUS_MAP: Record<string, ProjectStatus> = {
  active: 'active',
  complete: 'completed',
  completed: 'completed',
  archived: 'archived',
  on_hold: 'on_hold',
  hold: 'on_hold',
};

function mapJobTreadStatus(status: string): ProjectStatus {
  return JOBTREAD_STATUS_MAP[status.toLowerCase()] || 'active';
}

// ---------------------------------------------------------------------------
// Build a full address string from address parts
// ---------------------------------------------------------------------------

function buildFullAddress(
  address: JobTreadJob['address']
): string | undefined {
  if (!address) return undefined;
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

// ---------------------------------------------------------------------------
// Sync: Pull jobs from JobTread into Firestore projects
// ---------------------------------------------------------------------------

/**
 * Pulls all jobs from JobTread and upserts them as Firestore project documents.
 *
 * - New jobs create new project documents.
 * - Existing projects (matched by metadata.jobtreadJobId) are updated.
 * - Errors on individual jobs are collected rather than aborting the batch.
 */
export async function syncJobsToProjects(
  client: JobTreadClient,
  companyId: string
): Promise<SyncResult> {
  if (!companyId) {
    throw new Error('companyId is required for sync');
  }

  const jobs = await client.getJobs(100);

  let created = 0;
  let updated = 0;
  const errors: SyncResult['errors'] = [];

  for (const job of jobs) {
    try {
      // Check if a project already exists linked to this JobTread job
      const projectsRef = collection(db, 'projects');
      const existingQuery = query(
        projectsRef,
        where('companyId', '==', companyId),
        where('metadata.jobtreadJobId', '==', job.id)
      );
      const existing = await getDocs(existingQuery);

      const projectData = {
        companyId,
        name: job.name,
        addressStreet: job.address?.street ?? undefined,
        addressCity: job.address?.city ?? undefined,
        addressState: job.address?.state ?? undefined,
        addressZip: job.address?.zip ?? undefined,
        addressFull: buildFullAddress(job.address),
        latitude: job.address?.latitude ?? undefined,
        longitude: job.address?.longitude ?? undefined,
        customerName: job.customer?.name ?? undefined,
        customerEmail: job.customer?.email ?? undefined,
        customerPhone: job.customer?.phone ?? undefined,
        customerCompany: job.customer?.company ?? undefined,
        status: mapJobTreadStatus(job.status),
        metadata: {
          jobtreadJobId: job.id,
          jobtreadJobNumber: job.number ?? null,
        },
        updatedAt: serverTimestamp(),
      };

      if (existing.empty) {
        // Create a new project
        const newRef = doc(collection(db, 'projects'));
        await setDoc(newRef, {
          ...projectData,
          id: newRef.id,
          progress: 0,
          createdAt: serverTimestamp(),
          createdBy: 'jobtread-sync',
        });
        created++;
      } else {
        // Update the first matching project
        const existingDoc = existing.docs[0];
        await updateDoc(doc(db, 'projects', existingDoc.id), projectData);
        updated++;
      }
    } catch (err) {
      const message =
        err instanceof JobTreadApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : String(err);
      errors.push({ jobId: job.id, message });
    }
  }

  return { created, updated, errors };
}

// ---------------------------------------------------------------------------
// Push: Upload a photo to a JobTread job
// ---------------------------------------------------------------------------

/**
 * Upload a photo from StructureWorks Field storage to a linked JobTread job.
 */
export async function syncPhotoToJobTread(
  client: JobTreadClient,
  photoUrl: string,
  photoName: string,
  jobtreadJobId: string
): Promise<void> {
  if (!jobtreadJobId) {
    throw new Error('jobtreadJobId is required to sync a photo');
  }
  if (!photoUrl) {
    throw new Error('photoUrl is required to sync a photo');
  }

  await client.uploadFile(jobtreadJobId, photoUrl, photoName);
}

// ---------------------------------------------------------------------------
// Push: Create a task in JobTread from a StructureWorks Field task
// ---------------------------------------------------------------------------

/**
 * Creates a task in JobTread linked to a specific job.
 */
export async function syncTaskToJobTread(
  client: JobTreadClient,
  jobtreadJobId: string,
  task: { title: string; description?: string; dueDate?: string }
): Promise<{ id: string }> {
  if (!jobtreadJobId) {
    throw new Error('jobtreadJobId is required to sync a task');
  }

  return client.createTask(jobtreadJobId, task);
}

// ---------------------------------------------------------------------------
// Push: Create a job in JobTread from a StructureWorks project
// ---------------------------------------------------------------------------

/**
 * When a project is created in StructureWorks, push it to JobTread as a new
 * job with the project's name, address, customer info, and coordinates.
 *
 * Returns the created JobTread job ID.
 */
export async function syncProjectToJobTread(
  client: JobTreadClient,
  project: Project,
  companyId: string
): Promise<string> {
  if (!companyId) {
    throw new Error('companyId is required for sync');
  }

  const jobData: Parameters<JobTreadClient['createJob']>[0] = {
    name: project.name,
    status: project.status === 'on_hold' ? 'hold' : project.status,
  };

  // Attach address fields when available
  const hasAddress = project.addressStreet || project.addressCity || project.addressState || project.addressZip;
  if (hasAddress) {
    jobData.address = {
      street: project.addressStreet,
      city: project.addressCity,
      state: project.addressState,
      zip: project.addressZip,
      latitude: project.latitude,
      longitude: project.longitude,
    };
  }

  // Attach customer info when available
  if (project.customerName) {
    jobData.customerName = project.customerName;
    jobData.customerEmail = project.customerEmail;
    jobData.customerPhone = project.customerPhone;
    jobData.customerCompany = project.customerCompany;
  }

  const createdJob = await client.createJob(jobData);

  // Store the JobTread job ID back on the Firestore project document
  const projectRef = doc(db, 'projects', project.id);
  await updateDoc(projectRef, {
    'metadata.jobtreadJobId': createdJob.id,
    'metadata.jobtreadJobNumber': createdJob.number ?? null,
    updatedAt: serverTimestamp(),
  });

  return createdJob.id;
}

// ---------------------------------------------------------------------------
// Push: Batch-sync all un-synced photos to JobTread
// ---------------------------------------------------------------------------

/**
 * Upload every photo in a StructureWorks project that hasn't been synced to
 * the linked JobTread job yet.
 *
 * A photo is considered un-synced when `metadata.jobtreadFileId` is not set.
 *
 * Each successfully uploaded photo is stamped with the returned JobTread file
 * ID so it won't be re-synced on subsequent runs.
 *
 * Returns the count of photos that were synced during this invocation.
 */
export async function syncAllPhotosToJobTread(
  client: JobTreadClient,
  projectId: string,
  jobtreadJobId: string,
  config: BatchPhotoSyncConfig = {}
): Promise<number> {
  if (!projectId) {
    throw new Error('projectId is required for batch photo sync');
  }
  if (!jobtreadJobId) {
    throw new Error('jobtreadJobId is required for batch photo sync');
  }

  // Query Firestore for photos in this project that haven't been synced
  const photosRef = collection(db, 'photos');
  const unsyncedQuery = query(
    photosRef,
    where('projectId', '==', projectId)
  );
  const snapshot = await getDocs(unsyncedQuery);

  // Filter client-side for photos missing jobtreadFileId – Firestore doesn't
  // support inequality checks on missing nested map fields natively.
  const unsyncedPhotos = snapshot.docs.filter((d) => {
    const data = d.data() as Photo;
    return !data.metadata?.jobtreadFileId;
  });

  let syncedCount = 0;

  for (const photoDoc of unsyncedPhotos) {
    const photo = { id: photoDoc.id, ...photoDoc.data() } as Photo;
    const photoName = photo.description || photo.storagePath.split('/').pop() || `photo_${photo.id}`;

    try {
      // Upload file to JobTread
      const jtFile = await client.uploadFile(jobtreadJobId, photo.url, photoName);

      // Apply default folder and tags from config if provided
      const hasUpdates = config.defaultFolderId || (config.defaultTags && config.defaultTags.length > 0);
      if (hasUpdates) {
        const updatePayload: { folderId?: string; tags?: string[] } = {};
        if (config.defaultFolderId) {
          updatePayload.folderId = config.defaultFolderId;
        }
        if (config.defaultTags && config.defaultTags.length > 0) {
          updatePayload.tags = config.defaultTags;
        }
        await client.updateFile(jtFile.id, updatePayload);
      }

      // Mark the Firestore photo with the JobTread file ID
      const photoRef = doc(db, 'photos', photo.id);
      await updateDoc(photoRef, {
        'metadata.jobtreadFileId': jtFile.id,
        'metadata.jobtreadSyncedAt': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      syncedCount++;
    } catch (err) {
      // Log but don't abort – continue syncing remaining photos
      console.error(
        `[jobtreadSync] Failed to sync photo ${photo.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return syncedCount;
}

// ---------------------------------------------------------------------------
// Push: Update a file in JobTread when a photo is annotated or tags change
// ---------------------------------------------------------------------------

/**
 * When a photo is annotated or its tags change in StructureWorks, push the
 * updated data to the corresponding JobTread file.
 *
 * - If the photo has an `annotatedUrl`, the file name in JobTread is updated
 *   to reflect the annotation.
 * - Tags from the photo's PhotoTag relationships are synced to the JobTread
 *   file's tags array.
 */
export async function syncFileEditToJobTread(
  client: JobTreadClient,
  photo: Photo,
  jobtreadFileId: string
): Promise<void> {
  if (!jobtreadFileId) {
    throw new Error('jobtreadFileId is required to sync file edits');
  }

  const updatePayload: { name?: string; tags?: string[] } = {};

  // If the photo has been annotated, update the file name to indicate it
  if (photo.annotatedUrl) {
    const baseName = photo.description || photo.storagePath.split('/').pop() || `photo_${photo.id}`;
    updatePayload.name = `${baseName} (annotated)`;
  }

  // Resolve tags from the PhotoTag junction collection
  const photoTagsRef = collection(db, 'photoTags');
  const tagQuery = query(photoTagsRef, where('photoId', '==', photo.id));
  const tagSnapshot = await getDocs(tagQuery);

  if (!tagSnapshot.empty) {
    const tagIds = tagSnapshot.docs.map((d) => d.data().tagId as string);

    // Fetch each tag document to get the name
    const tagNames: string[] = [];
    for (const tagId of tagIds) {
      try {
        const tagsCollRef = collection(db, 'tags');
        const tagDocQuery = query(tagsCollRef, where('__name__', '==', tagId));
        const tagDocSnap = await getDocs(tagDocQuery);
        if (!tagDocSnap.empty) {
          tagNames.push(tagDocSnap.docs[0].data().name as string);
        }
      } catch {
        // Skip tags that can't be resolved
      }
    }

    if (tagNames.length > 0) {
      updatePayload.tags = tagNames;
    }
  }

  // Only call the API if there's something to update
  if (updatePayload.name || updatePayload.tags) {
    await client.updateFile(jobtreadFileId, updatePayload);
  }
}

// ---------------------------------------------------------------------------
// Push: Sync file tags between systems
// ---------------------------------------------------------------------------

/**
 * Sync StructureWorks tags to the files on a JobTread job, matching by tag
 * name. For every file in the JobTread job, look up the corresponding
 * Firestore photo (via `metadata.jobtreadFileId`) and push the current set
 * of tag names from StructureWorks to JobTread.
 */
export async function syncTagsToJobTread(
  client: JobTreadClient,
  tags: Array<{ id: string; name: string }>,
  jobtreadJobId: string
): Promise<void> {
  if (!jobtreadJobId) {
    throw new Error('jobtreadJobId is required to sync tags');
  }

  // Build a quick lookup: tagId -> tagName
  const tagNameById = new Map<string, string>();
  for (const tag of tags) {
    tagNameById.set(tag.id, tag.name);
  }

  // Get all files currently on the JobTread job
  const jtFiles = await client.getJobFiles(jobtreadJobId);

  for (const jtFile of jtFiles) {
    // Find the Firestore photo linked to this JobTread file
    const photosRef = collection(db, 'photos');
    const linkedQuery = query(
      photosRef,
      where('metadata.jobtreadFileId', '==', jtFile.id)
    );
    const linkedSnap = await getDocs(linkedQuery);

    if (linkedSnap.empty) continue;

    const photo = { id: linkedSnap.docs[0].id, ...linkedSnap.docs[0].data() } as Photo;

    // Get tag names for this photo from the PhotoTag junction
    const photoTagsRef = collection(db, 'photoTags');
    const ptQuery = query(photoTagsRef, where('photoId', '==', photo.id));
    const ptSnap = await getDocs(ptQuery);

    const currentTagNames: string[] = ptSnap.docs
      .map((d) => tagNameById.get(d.data().tagId as string))
      .filter((name): name is string => !!name);

    // Only update if tags actually differ
    const existingTags = jtFile.tags ?? [];
    const tagsMatch =
      existingTags.length === currentTagNames.length &&
      existingTags.every((t) => currentTagNames.includes(t));

    if (!tagsMatch) {
      await client.updateFile(jtFile.id, { tags: currentTagNames });
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Count un-synced photos in a project
// ---------------------------------------------------------------------------

/**
 * Returns the number of photos in a StructureWorks project that have not yet
 * been synced to JobTread (i.e. missing `metadata.jobtreadFileId`).
 */
export async function getUnsyncedPhotoCount(projectId: string): Promise<number> {
  if (!projectId) {
    throw new Error('projectId is required');
  }

  const photosRef = collection(db, 'photos');
  const photosQuery = query(
    photosRef,
    where('projectId', '==', projectId)
  );
  const snapshot = await getDocs(photosQuery);

  // Filter client-side for photos that lack a jobtreadFileId
  const unsyncedCount = snapshot.docs.filter((d) => {
    const data = d.data() as Photo;
    return !data.metadata?.jobtreadFileId;
  }).length;

  return unsyncedCount;
}
