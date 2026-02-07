/**
 * Firebase Cloud Functions for JobMate
 *
 * Replaces the previous Supabase Edge Functions with native Firebase
 * Cloud Functions (2nd gen where possible, v1 for Firestore triggers).
 *
 * Functions:
 *   jobtreadAuth         - OAuth2 flow for connecting to JobTread
 *   jobtreadWebhook      - Receives webhooks from JobTread
 *   processSyncQueue     - Scheduled processor for the syncQueue collection
 *   onPhotoCreated       - Firestore trigger that auto-enqueues photo syncs
 *   onMessageCreated     - Firestore trigger that sends push notifications for new messages
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";

// Re-export Stripe payment functions
export { createCheckoutSession, stripeWebhook } from "./stripe";

// Re-export push notification functions
export { onMessageCreated } from "./notifications";

// Re-export AI / JobMate functions
export { jobmateChat } from "./jobmate";

// ============================================================================
// Initialisation
// ============================================================================

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// Secrets / Config  (set via `firebase functions:secrets:set <KEY>`)
// ============================================================================

const jobtreadClientId = defineSecret("JOBTREAD_CLIENT_ID");
const jobtreadClientSecret = defineSecret("JOBTREAD_CLIENT_SECRET");
const jobtreadWebhookSecret = defineSecret("JOBTREAD_WEBHOOK_SECRET");

// ============================================================================
// Constants
// ============================================================================

const JOBTREAD_AUTH_URL = "https://app.jobtread.com/oauth/authorize";
const JOBTREAD_TOKEN_URL = "https://app.jobtread.com/oauth/token";
const JOBTREAD_REDIRECT_URI =
  "https://us-central1-projectworks-8b692.cloudfunctions.net/jobtreadAuth?action=callback";

// After a successful OAuth callback, redirect the user back to the app.
const APP_REDIRECT_URL = "https://gray-barracuda-245114.hostingersite.com/integrations";

// ============================================================================
// Helpers
// ============================================================================

/** Build a JSON response with CORS headers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonResponse(
  res: any,
  body: Record<string, unknown>,
  status = 200
): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type"
  );
  res.status(status).json(body);
}

/** Compute HMAC-SHA256 hex digest using Node crypto. */
function hmacSha256(secret: string, payload: string): string {
  const crypto = require("crypto") as typeof import("crypto");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

// ============================================================================
// 1. jobtreadAuth  --  OAuth2 flow (2nd gen HTTPS)
// ============================================================================

/**
 * Handles the two-step OAuth2 flow for connecting a JobMate
 * company to their JobTread account.
 *
 * Query parameters:
 *   ?action=authorize&companyId=xxx  -- Redirect to JobTread consent screen
 *   ?action=callback&code=xxx&state=xxx -- Exchange code, store tokens
 */
export const jobtreadAuth = onRequest(
  {
    region: "us-central1",
    secrets: [jobtreadClientId, jobtreadClientSecret],
    cors: true,
  },
  async (req, res) => {
    try {
      const action = req.query.action as string | undefined;

      // ----------------------------------------------------------------
      // Step 1: Redirect to JobTread OAuth consent screen
      // ----------------------------------------------------------------
      if (action === "authorize") {
        const clientId = jobtreadClientId.value();
        if (!clientId) {
          jsonResponse(
            res,
            { error: "JobTread OAuth is not configured on the server." },
            500
          );
          return;
        }

        const companyId = req.query.companyId as string | undefined;
        if (!companyId) {
          jsonResponse(
            res,
            { error: "companyId query parameter is required." },
            400
          );
          return;
        }

        // Encode companyId into the state parameter so we can retrieve it
        // in the callback.
        const state = Buffer.from(JSON.stringify({ companyId })).toString(
          "base64"
        );

        const authUrl = new URL(JOBTREAD_AUTH_URL);
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", JOBTREAD_REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "read write");
        authUrl.searchParams.set("state", state);

        res.redirect(302, authUrl.toString());
        return;
      }

      // ----------------------------------------------------------------
      // Step 2: Exchange code for tokens, store in Firestore
      // ----------------------------------------------------------------
      if (action === "callback") {
        const errorParam = req.query.error as string | undefined;
        if (errorParam) {
          const errorDesc =
            (req.query.error_description as string) || errorParam;
          jsonResponse(
            res,
            { error: `JobTread authorization denied: ${errorDesc}` },
            400
          );
          return;
        }

        const code = req.query.code as string | undefined;
        if (!code) {
          jsonResponse(res, { error: "Missing authorization code." }, 400);
          return;
        }

        // Decode state to get companyId
        const stateParam = req.query.state as string | undefined;
        let companyId = "";
        if (stateParam) {
          try {
            const parsed = JSON.parse(
              Buffer.from(stateParam, "base64").toString("utf-8")
            );
            companyId = parsed.companyId ?? "";
          } catch {
            jsonResponse(res, { error: "Invalid state parameter." }, 400);
            return;
          }
        }

        if (!companyId) {
          jsonResponse(
            res,
            { error: "Could not determine companyId from state." },
            400
          );
          return;
        }

        // Exchange the authorization code for access + refresh tokens
        const tokenRes = await fetch(JOBTREAD_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: jobtreadClientId.value(),
            client_secret: jobtreadClientSecret.value(),
            redirect_uri: JOBTREAD_REDIRECT_URI,
          }),
        });

        if (!tokenRes.ok) {
          const errorBody = await tokenRes.text();
          console.error("Token exchange failed:", errorBody);
          jsonResponse(
            res,
            {
              error: `Token exchange failed (${tokenRes.status}): ${errorBody}`,
            },
            502
          );
          return;
        }

        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          token_type?: string;
        };

        // Store tokens in Firestore integrations collection
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null;

        await db
          .collection("integrations")
          .doc(`${companyId}_jobtread`)
          .set(
            {
              companyId,
              provider: "jobtread",
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token ?? null,
              tokenType: tokens.token_type ?? "Bearer",
              expiresIn: tokens.expires_in ?? null,
              expiresAt,
              isActive: true,
              config: {},
              connectedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        console.log(
          `JobTread OAuth tokens stored for company ${companyId}`
        );

        // Redirect the user back to the app with a success indicator
        const redirectUrl = new URL(APP_REDIRECT_URL);
        redirectUrl.searchParams.set("jobtread", "connected");
        redirectUrl.searchParams.set("companyId", companyId);
        res.redirect(302, redirectUrl.toString());
        return;
      }

      // ----------------------------------------------------------------
      // Unknown action
      // ----------------------------------------------------------------
      jsonResponse(
        res,
        {
          error: `Unknown action: "${action}". Use "authorize" or "callback".`,
        },
        400
      );
    } catch (error) {
      console.error("jobtreadAuth error:", error);
      jsonResponse(
        res,
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        500
      );
    }
  }
);

// ============================================================================
// 2. jobtreadWebhook  --  Receive webhooks from JobTread (2nd gen HTTPS)
// ============================================================================

interface JobTreadWebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

/**
 * Map a JobTread webhook event type to a sync queue action.
 * Returns null for events we do not process.
 */
function mapEventToAction(
  event: string
): { action: string; entityType: string } | null {
  switch (event) {
    case "job.created":
      return { action: "sync_from_jobtread", entityType: "job" };
    case "job.updated":
      return { action: "sync_from_jobtread", entityType: "job" };
    case "file.created":
      return { action: "sync_from_jobtread", entityType: "file" };
    default:
      return null;
  }
}

export const jobtreadWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [jobtreadWebhookSecret],
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      jsonResponse(res, { error: "Method not allowed" }, 405);
      return;
    }

    try {
      const rawBody =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      // ------------------------------------------------------------------
      // HMAC-SHA256 signature verification (optional)
      // ------------------------------------------------------------------
      const webhookSecret = jobtreadWebhookSecret.value();
      if (webhookSecret) {
        const signatureHeader = req.headers["x-jobtread-signature"] as
          | string
          | undefined;

        if (!signatureHeader) {
          console.warn("Missing webhook signature header");
          jsonResponse(res, { error: "Missing signature" }, 401);
          return;
        }

        const expectedSignature = hmacSha256(webhookSecret, rawBody);
        if (expectedSignature !== signatureHeader) {
          console.warn("Invalid webhook signature");
          jsonResponse(res, { error: "Invalid signature" }, 401);
          return;
        }
      }

      // ------------------------------------------------------------------
      // Parse and process payload
      // ------------------------------------------------------------------
      let payload: JobTreadWebhookPayload;
      try {
        payload =
          typeof req.body === "object" ? req.body : JSON.parse(rawBody);
      } catch {
        jsonResponse(res, { error: "Invalid JSON body" }, 400);
        return;
      }

      const { event, data, timestamp } = payload;

      if (!event) {
        jsonResponse(res, { error: "Missing event type in payload" }, 400);
        return;
      }

      console.log(`Received JobTread webhook: ${event}`);

      // Enqueue if it's an event we care about
      const mapping = mapEventToAction(event);

      if (mapping) {
        await db.collection("syncQueue").add({
          provider: "jobtread",
          entityType: mapping.entityType,
          entityId: (data?.id as string) ?? "",
          action: mapping.action,
          status: "pending",
          retryCount: 0,
          maxRetries: 3,
          payload: data ?? {},
          webhookEvent: event,
          receivedAt: timestamp ?? new Date().toISOString(),
          companyId: (data?.companyId as string) ?? "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Enqueued sync item for event: ${event}`);
      } else {
        console.log(`Ignoring unhandled event type: ${event}`);
      }

      // Always return 200 to acknowledge receipt
      jsonResponse(res, { received: true, event });
    } catch (error) {
      console.error("jobtreadWebhook error:", error);
      // Return 200 even on internal errors to prevent JobTread from retrying
      jsonResponse(res, { received: true, error: "Internal processing error" });
    }
  }
);

// ============================================================================
// 3. processSyncQueue  --  Scheduled every 5 minutes (2nd gen scheduler)
// ============================================================================

/**
 * Queries Firestore for pending sync queue items and processes each one.
 * Items are marked as "processing" during execution and then "completed"
 * or "failed" afterwards. Failed items with retries remaining are set back
 * to "pending" with an incremented retryCount.
 */
export const processSyncQueue = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 300,
  },
  async () => {
    try {
      // Query for pending items, oldest first, limited batch size
      const snapshot = await db
        .collection("syncQueue")
        .where("status", "==", "pending")
        .orderBy("createdAt", "asc")
        .limit(50)
        .get();

      if (snapshot.empty) {
        console.log("No pending items in sync queue");
        return;
      }

      console.log(`Found ${snapshot.size} pending sync queue items`);

      let succeeded = 0;
      let failed = 0;

      for (const doc of snapshot.docs) {
        const item = doc.data();
        const docRef = doc.ref;

        // Mark as processing
        await docRef.update({
          status: "processing",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
          await processSyncItem(item);

          // Mark completed
          await docRef.update({
            status: "completed",
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          succeeded++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const retryCount = (item.retryCount as number) || 0;
          const maxRetries = (item.maxRetries as number) || 3;

          if (retryCount < maxRetries) {
            // Put back to pending with incremented retryCount
            await docRef.update({
              status: "pending",
              retryCount: retryCount + 1,
              lastError: errorMsg,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          } else {
            // Max retries exceeded -- mark as failed permanently
            await docRef.update({
              status: "failed",
              lastError: errorMsg,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          failed++;
          console.error(`Error processing ${doc.id}:`, errorMsg);
        }
      }

      console.log(
        `Sync queue processing complete: ${succeeded} succeeded, ${failed} failed`
      );
    } catch (error) {
      console.error("processSyncQueue error:", error);
    }
  }
);

/**
 * Process a single sync queue item based on its action and entity type.
 *
 * In a full implementation each branch would use the company's stored
 * JobTread access token to call the JobTread API. The skeleton below
 * demonstrates the dispatch pattern.
 */
async function processSyncItem(
  item: Record<string, unknown>
): Promise<void> {
  const action = item.action as string;
  const entityType = item.entityType as string;
  const entityId = item.entityId as string;
  const provider = item.provider as string;

  console.log(
    `Processing: provider=${provider}, action=${action}, entityType=${entityType}, entityId=${entityId}`
  );

  switch (action) {
    case "sync_from_jobtread": {
      // In production:
      // 1. Look up the integration record for the companyId to get the access token
      //    const integrationDoc = await db.collection('integrations')
      //      .doc(`${item.companyId}_jobtread`).get();
      // 2. Instantiate a JobTread API client with the token
      // 3. Fetch the specific entity (job, file) from JobTread
      // 4. Upsert the corresponding Firestore document
      console.log(`Would sync ${entityType} ${entityId} from JobTread`);
      break;
    }

    case "sync_to_jobtread": {
      // Push local changes to JobTread (e.g., upload a new photo)
      // 1. Look up integration tokens
      // 2. Read the local entity from Firestore
      // 3. Push to JobTread via their API
      console.log(`Would sync ${entityType} ${entityId} to JobTread`);
      break;
    }

    case "create":
    case "update":
    case "delete": {
      console.log(`Would perform ${action} on ${entityType} ${entityId}`);
      break;
    }

    default:
      throw new Error(`Unknown sync action: ${action}`);
  }
}

// ============================================================================
// 4. jobtreadProxy  --  CORS proxy for browser → JobTread Pave API (2nd gen)
// ============================================================================

/**
 * Proxies Pave queries from the browser to the JobTread API.
 *
 * The JobTread API at https://api.jobtread.com/pave does not include CORS
 * headers, so browser-originated requests fail. This function accepts the
 * same JSON body and Authorization header, forwards the request server-side,
 * and returns the response with appropriate CORS headers.
 *
 * Usage from the client:
 *   POST /jobtreadProxy
 *   Headers: Authorization: Bearer <grant-key>
 *   Body:    { "query": { ... } }
 */
export const jobtreadProxy = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set(
        "Access-Control-Allow-Headers",
        "authorization, content-type"
      );
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Max-Age", "86400");
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      jsonResponse(res, { error: "Method not allowed" }, 405);
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      jsonResponse(
        res,
        { error: "Missing Authorization header" },
        401
      );
      return;
    }

    try {
      const response = await fetch("https://api.jobtread.com/pave", {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body:
          typeof req.body === "string"
            ? req.body
            : JSON.stringify(req.body),
      });

      const data = await response.text();

      res.set("Access-Control-Allow-Origin", "*");
      res.status(response.status);
      res.set("Content-Type", response.headers.get("content-type") || "application/json");
      res.send(data);
    } catch (error) {
      console.error("jobtreadProxy error:", error);
      jsonResponse(
        res,
        {
          error:
            error instanceof Error
              ? error.message
              : "Proxy request failed",
        },
        502
      );
    }
  }
);

// ============================================================================
// 6. onPhotoCreated  --  Firestore trigger (v1, onCreate)
// ============================================================================

export const onPhotoCreated = onDocumentCreated(
  {
    document: "photos/{photoId}",
    region: "us-central1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data in photo event, skipping");
      return;
    }

    const photoData = snapshot.data();
    const photoId = event.params.photoId;

    if (!photoData) {
      console.log(`Photo ${photoId} has no data, skipping`);
      return;
    }

    const projectId = photoData.projectId as string | undefined;
    const companyId = photoData.companyId as string | undefined;

    if (!projectId) {
      console.log(`Photo ${photoId} has no projectId, skipping`);
      return;
    }

    try {
      // Look up the project to check for a JobTread link
      const projectDoc = await db
        .collection("projects")
        .doc(projectId)
        .get();

      if (!projectDoc.exists) {
        console.log(`Project ${projectId} not found, skipping`);
        return;
      }

      const projectData = projectDoc.data();
      const jobtreadJobId = projectData?.jobtreadJobId as string | undefined;

      if (!jobtreadJobId) {
        console.log(
          `Project ${projectId} is not linked to JobTread, skipping`
        );
        return;
      }

      // The project is linked to a JobTread job -- enqueue a sync item
      await db.collection("syncQueue").add({
        provider: "jobtread",
        entityType: "photo",
        entityId: photoId,
        action: "sync_to_jobtread",
        status: "pending",
        retryCount: 0,
        maxRetries: 3,
        payload: {
          photoId,
          projectId,
          jobtreadJobId,
          photoUrl: photoData.url ?? "",
          fileName: photoData.fileName ?? "",
        },
        companyId: companyId ?? projectData?.companyId ?? "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `Enqueued photo sync to JobTread: photo=${photoId}, job=${jobtreadJobId}`
      );
    } catch (error) {
      console.error(`onPhotoCreated error for ${photoId}:`, error);
    }
  }
);
