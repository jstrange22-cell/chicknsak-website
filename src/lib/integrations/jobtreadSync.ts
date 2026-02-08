// JobTread <-> JobMate Sync Engine
// Handles bidirectional sync between JobTread jobs and Firestore projects.

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JobTreadClient, JobTreadApiError } from './jobtread';
import type { ProjectStatus, Photo, Project, TemplateSection, TemplateField } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
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

/**
 * JobTread status → JobMate status mapping.
 *
 * JobTread uses three statuses:
 *   - "CREATED"  → the job exists but hasn't been approved by the customer yet → **lead**
 *   - "APPROVED" → the customer has approved the job (Active Customers box) → **active**
 *   - "CLOSED"   → the job is completed / closed out → **archived**
 *
 * We also handle a few legacy / fallback values just in case.
 */
const JOBTREAD_STATUS_MAP: Record<string, ProjectStatus> = {
  created: 'lead',
  approved: 'active',
  active: 'active',
  pending: 'lead',
  paid: 'active',
  closed: 'archived',
  complete: 'archived',
  completed: 'archived',
  archived: 'archived',
  on_hold: 'on_hold',
  hold: 'on_hold',
};

function mapJobTreadStatus(status: string): ProjectStatus {
  return JOBTREAD_STATUS_MAP[status.toLowerCase()] || 'lead';
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
 *
 * Note: The JobTread API returns location as a single address string
 * (e.g. "123 Main St, Dallas, TX 75201") rather than separate parts.
 * We store this in `addressFull` and also populate the GPS coordinates.
 */
export async function syncJobsToProjects(
  client: JobTreadClient,
  companyId: string
): Promise<SyncResult> {
  if (!companyId) {
    throw new Error('companyId is required for sync');
  }

  // Paginate through ALL jobs instead of just the first 100.
  // This ensures archived projects in JobMate don't consume slots
  // that prevent new/active JobTread jobs from syncing.
  const jobs = await client.getAllJobs();

  let created = 0;
  let updated = 0;
  let skipped = 0;
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

      // Skip projects that were manually archived in JobMate.
      // This prevents sync from overwriting a user's decision AND frees up
      // slots in the 100-job sync limit for legitimate active jobs.
      if (!existing.empty) {
        const existingData = existing.docs[0].data();
        if (existingData.status === 'archived') {
          skipped++;
          continue;
        }
      }

      // Map JobTread job → Firestore project data.
      // JobTread provides location.address as a full string (no separate parts).
      // IMPORTANT: Firestore does not accept `undefined` — use `null` or omit.
      //
      // We build separate data objects for create vs update because:
      // - On CREATE: set the mapped status from JobTread
      // - On UPDATE: do NOT overwrite status — the user may have manually
      //   changed it in JobMate (e.g. moved a "lead" to "active")
      const baseData: Record<string, unknown> = {
        companyId,
        name: job.name || 'Untitled Job',
        metadata: {
          jobtreadJobId: job.id,
          jobtreadJobNumber: job.number ?? null,
        },
        updatedAt: serverTimestamp(),
      };

      // Only include optional fields when they have actual values
      if (job.location?.address) baseData.addressFull = job.location.address;
      if (job.location?.latitude != null) baseData.latitude = job.location.latitude;
      if (job.location?.longitude != null) baseData.longitude = job.location.longitude;
      if (job.description) baseData.description = job.description;

      // Map contact/customer data
      if (job.contact?.name) baseData.customerName = job.contact.name;
      if (job.contact?.email) baseData.customerEmail = job.contact.email;
      if (job.contact?.phone) baseData.customerPhone = job.contact.phone;
      if (job.contact?.company) baseData.customerCompany = job.contact.company;

      if (existing.empty) {
        // Create a new project — set status from JobTread mapping
        const newRef = doc(collection(db, 'projects'));
        await setDoc(newRef, {
          ...baseData,
          status: mapJobTreadStatus(job.status),
          id: newRef.id,
          progress: 0,
          createdAt: serverTimestamp(),
          createdBy: 'jobtread-sync',
        });
        created++;
      } else {
        // Update an existing project — preserve the user's status choice
        const existingDoc = existing.docs[0];
        await updateDoc(doc(db, 'projects', existingDoc.id), baseData);
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

  return { created, updated, skipped, errors };
}

// ---------------------------------------------------------------------------
// Sync: Pull approved proposals from JobTread → checklists
// ---------------------------------------------------------------------------

export interface ProposalSyncResult {
  synced: number;
  skipped: number;
  errors: Array<{ proposalId: string; message: string }>;
}

/**
 * Fetches approved proposals from a JobTread job and creates checklists
 * from them in Firestore. Each proposal group becomes a checklist section,
 * and each line item becomes a checkbox field.
 *
 * Already-synced proposals (matched by metadata.jobtreadProposalId) are skipped.
 */
export async function syncProposalsToChecklists(
  client: JobTreadClient,
  projectId: string,
  jobtreadJobId: string,
  companyId: string,
  userId: string
): Promise<ProposalSyncResult> {
  if (!projectId || !jobtreadJobId || !companyId || !userId) {
    throw new Error('All parameters are required for proposal sync');
  }

  const proposals = await client.getJobProposals(jobtreadJobId);

  // Filter for approved proposals only
  const approved = proposals.filter(
    (p) => p.status?.toLowerCase() === 'approved'
  );

  let synced = 0;
  let skipped = 0;
  const errors: ProposalSyncResult['errors'] = [];

  for (const proposal of approved) {
    try {
      // Check if this proposal was already synced
      const checklistsRef = collection(db, 'checklists');
      const existingQuery = query(
        checklistsRef,
        where('companyId', '==', companyId),
        where('projectId', '==', projectId),
        where('metadata.jobtreadProposalId', '==', proposal.id)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        skipped++;
        continue;
      }

      // Build sections from proposal groups
      const sections: TemplateSection[] = (proposal.groups?.nodes ?? []).map((group) => ({
        name: group.name || 'Untitled Group',
        fields: (group.lineItems?.nodes ?? []).map((item): TemplateField => ({
          id: crypto.randomUUID(),
          label: item.name || 'Untitled Item',
          type: 'checkbox',
          required: false,
        })),
      }));

      // Create the checklist document
      const checklistDoc = await addDoc(collection(db, 'checklists'), {
        projectId,
        companyId,
        name: proposal.name || 'Imported Proposal',
        status: 'in_progress',
        sections,
        createdBy: userId,
        metadata: {
          jobtreadProposalId: proposal.id,
          importedFrom: 'jobtread',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create individual checklist items via batch write
      const batch = writeBatch(db);
      let sortOrder = 0;

      for (const section of sections) {
        for (const field of section.fields) {
          const itemRef = doc(collection(db, 'checklistItems'));
          batch.set(itemRef, {
            checklistId: checklistDoc.id,
            sectionName: section.name,
            label: field.label,
            fieldType: 'checkbox',
            sortOrder: sortOrder++,
            completed: false,
            photoIds: [],
            required: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
      synced++;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push({ proposalId: proposal.id, message });
    }
  }

  return { synced, skipped, errors };
}

// ---------------------------------------------------------------------------
// Push: Upload a photo to a JobTread job
// ---------------------------------------------------------------------------

/**
 * Upload a photo from JobMate storage to a linked JobTread job.
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
// Push: Create a job in JobTread from a JobMate project
// ---------------------------------------------------------------------------

/**
 * When a project is created in JobMate, push it to JobTread as a new
 * job with the project's name and description.
 *
 * Note: The JobTread createJob mutation only accepts name, description, and
 * organizationId. Address/customer info is not settable via the create API.
 *
 * Returns the created JobTread job ID.
 */
export async function syncProjectToJobTread(
  client: JobTreadClient,
  project: Project,
  _companyId: string
): Promise<string> {
  const createdJob = await client.createJob({
    name: project.name,
    description: project.description,
  });

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
 * Upload every photo in a JobMate project that hasn't been synced to
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
 * When a photo is annotated or its tags change in JobMate, push the
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
 * Sync JobMate tags to the files on a JobTread job, matching by tag
 * name. For every file in the JobTread job, look up the corresponding
 * Firestore photo (via `metadata.jobtreadFileId`) and push the current set
 * of tag names from JobMate to JobTread.
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
 * Returns the number of photos in a JobMate project that have not yet
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
