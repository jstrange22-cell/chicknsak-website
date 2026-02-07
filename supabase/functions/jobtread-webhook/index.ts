// JobTread Webhook Listener Edge Function
//
// Receives webhook POST events from JobTread and enqueues them in the
// `syncQueue` Firestore collection for asynchronous processing by the
// process-sync-queue function.
//
// Supported event types:
//   - job.created
//   - job.updated
//   - file.created
//
// All other events are acknowledged (200 OK) but not enqueued.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

// Optional: set a webhook signing secret for verification
const JOBTREAD_WEBHOOK_SECRET = Deno.env.get('JOBTREAD_WEBHOOK_SECRET') ?? '';

// Supabase/Firestore REST endpoint for writing sync queue items.
// Using the Supabase project URL + Firestore REST is one option; for
// production you would ideally use Firebase Admin SDK. For this edge function
// we write via the Firestore REST API.
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JobTreadWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
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

/** Minimal HMAC-SHA256 signature verification (if a signing secret is set). */
async function verifySignature(
  payload: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!JOBTREAD_WEBHOOK_SECRET) {
    // No secret configured -- skip verification (development mode)
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(JOBTREAD_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return expectedSignature === signatureHeader;
}

/**
 * Map a JobTread webhook event type to a sync queue action.
 * Returns null for events we do not process.
 */
function mapEventToAction(
  event: string
): { action: string; entityType: string } | null {
  switch (event) {
    case 'job.created':
      return { action: 'sync_from_jobtread', entityType: 'job' };
    case 'job.updated':
      return { action: 'sync_from_jobtread', entityType: 'job' };
    case 'file.created':
      return { action: 'sync_from_jobtread', entityType: 'file' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Write to Firestore via REST (lightweight, no Firebase Admin SDK required)
// ---------------------------------------------------------------------------

async function enqueueSyncItem(item: Record<string, unknown>): Promise<void> {
  if (!FIREBASE_PROJECT_ID) {
    console.warn(
      'FIREBASE_PROJECT_ID not set -- sync queue item logged but not persisted.'
    );
    console.log('Sync queue item:', JSON.stringify(item));
    return;
  }

  // Firestore REST API endpoint for creating a document in syncQueue
  const firestoreUrl =
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/syncQueue`;

  // Convert the item into Firestore Value format
  const fields: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'object') {
      fields[key] = { stringValue: JSON.stringify(value) };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }

  const response = await fetch(firestoreUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to write sync queue item:', errorText);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const rawBody = await req.text();

    // Verify webhook signature if a secret is configured
    const signatureHeader = req.headers.get('x-jobtread-signature');
    const isValid = await verifySignature(rawBody, signatureHeader);
    if (!isValid) {
      console.warn('Invalid webhook signature');
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }

    // Parse the payload
    let payload: JobTreadWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const { event, data, timestamp } = payload;

    if (!event) {
      return jsonResponse({ error: 'Missing event type in payload' }, 400);
    }

    console.log(`Received JobTread webhook: ${event}`);

    // Determine whether we care about this event
    const mapping = mapEventToAction(event);

    if (mapping) {
      const syncItem = {
        provider: 'jobtread',
        entityType: mapping.entityType,
        entityId: (data?.id as string) ?? '',
        action: mapping.action,
        status: 'pending',
        retryCount: '0',
        maxRetries: '3',
        payload: data,
        webhookEvent: event,
        receivedAt: timestamp ?? new Date().toISOString(),
        // companyId will be resolved during processing since the webhook
        // payload does not always include it directly
        companyId: (data?.companyId as string) ?? '',
      };

      await enqueueSyncItem(syncItem);
      console.log(`Enqueued sync item for event: ${event}`);
    } else {
      console.log(`Ignoring unhandled event type: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    return jsonResponse({ received: true, event });
  } catch (error) {
    console.error('jobtread-webhook error:', error);
    // Return 200 even on internal errors to prevent JobTread from retrying
    // (the error is logged for investigation)
    return jsonResponse({ received: true, error: 'Internal processing error' });
  }
});
