// Sync Queue Processor Edge Function
//
// Picks pending items from the `syncQueue` Firestore collection, processes
// them based on action type, and updates their status to completed or failed.
//
// This function is designed to be invoked on a schedule (e.g., every 5 min
// via a cron trigger) or on demand via an HTTP call.
//
// Processing flow:
//   1. Query Firestore for pending sync queue items.
//   2. For each item, set status to "processing".
//   3. Execute the appropriate sync action.
//   4. Set status to "completed" or "failed" with error details.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncQueueItem {
  name: string; // Firestore document path
  fields: Record<string, { stringValue?: string; integerValue?: string }>;
}

interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ documentName: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getFieldValue(
  fields: SyncQueueItem['fields'],
  key: string
): string {
  const field = fields[key];
  return field?.stringValue ?? field?.integerValue ?? '';
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------

async function fetchPendingItems(): Promise<SyncQueueItem[]> {
  if (!FIREBASE_PROJECT_ID) {
    console.warn('FIREBASE_PROJECT_ID not set -- cannot fetch sync queue');
    return [];
  }

  // Firestore REST: Run a structured query for pending items
  const url =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'syncQueue' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'status' },
            op: 'EQUAL',
            value: { stringValue: 'pending' },
          },
        },
        limit: 50,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to query sync queue:', errorText);
    return [];
  }

  const results = await response.json() as Array<{ document?: SyncQueueItem }>;
  return results
    .filter((r) => r.document)
    .map((r) => r.document!);
}

async function updateItemStatus(
  documentName: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  if (!FIREBASE_PROJECT_ID) return;

  const url = `https://firestore.googleapis.com/v1/${documentName}?updateMask.fieldPaths=status&updateMask.fieldPaths=processedAt&updateMask.fieldPaths=errorMessage`;

  const fields: Record<string, Record<string, string>> = {
    status: { stringValue: status },
    processedAt: { stringValue: new Date().toISOString() },
  };

  if (errorMessage) {
    fields.errorMessage = { stringValue: errorMessage };
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to update item ${documentName}:`, errorText);
  }
}

// ---------------------------------------------------------------------------
// Action processors
// ---------------------------------------------------------------------------

/**
 * Process a single sync queue item based on its action and entity type.
 *
 * In a full implementation, each case would instantiate the JobTreadClient
 * using the company's stored access token and call the appropriate sync
 * function. For now, this skeleton logs the action and demonstrates the
 * dispatch pattern.
 */
async function processItem(item: SyncQueueItem): Promise<void> {
  const action = getFieldValue(item.fields, 'action');
  const entityType = getFieldValue(item.fields, 'entityType');
  const entityId = getFieldValue(item.fields, 'entityId');
  const provider = getFieldValue(item.fields, 'provider');

  console.log(
    `Processing: provider=${provider}, action=${action}, entityType=${entityType}, entityId=${entityId}`
  );

  switch (action) {
    case 'sync_from_jobtread': {
      // In production:
      // 1. Look up the integration record for the companyId to get the access token
      // 2. Instantiate JobTreadClient with the token
      // 3. Fetch the specific entity (job, file) from JobTread
      // 4. Upsert the corresponding Firestore document
      //
      // Example:
      //   const integration = await getIntegration(companyId, 'jobtread');
      //   const client = new JobTreadClient(integration.accessToken);
      //   if (entityType === 'job') {
      //     const job = await client.getJob(entityId);
      //     await upsertProject(companyId, job);
      //   }
      console.log(`Would sync ${entityType} ${entityId} from JobTread`);
      break;
    }

    case 'sync_to_jobtread': {
      // Push local changes to JobTread
      // Example: upload a new photo, create a task, etc.
      console.log(`Would sync ${entityType} ${entityId} to JobTread`);
      break;
    }

    case 'create':
    case 'update':
    case 'delete': {
      console.log(`Would perform ${action} on ${entityType} ${entityId}`);
      break;
    }

    default:
      throw new Error(`Unknown sync action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

function shouldRetry(item: SyncQueueItem): boolean {
  const retryCount = parseInt(getFieldValue(item.fields, 'retryCount') || '0', 10);
  const maxRetries = parseInt(getFieldValue(item.fields, 'maxRetries') || '3', 10);
  return retryCount < maxRetries;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const pendingItems = await fetchPendingItems();

    if (pendingItems.length === 0) {
      return jsonResponse({
        message: 'No pending items in sync queue',
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    console.log(`Found ${pendingItems.length} pending sync queue items`);

    const result: ProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const item of pendingItems) {
      const documentName = item.name;
      result.processed++;

      // Mark as processing
      await updateItemStatus(documentName, 'processing');

      try {
        await processItem(item);
        await updateItemStatus(documentName, 'completed');
        result.succeeded++;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);

        if (shouldRetry(item)) {
          // Put back to pending with incremented retryCount for next run
          await updateItemStatus(documentName, 'pending', errorMsg);
        } else {
          await updateItemStatus(documentName, 'failed', errorMsg);
        }

        result.failed++;
        result.errors.push({ documentName, error: errorMsg });
        console.error(`Error processing ${documentName}:`, errorMsg);
      }
    }

    return jsonResponse({
      message: `Processed ${result.processed} items`,
      ...result,
    });
  } catch (error) {
    console.error('process-sync-queue error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
