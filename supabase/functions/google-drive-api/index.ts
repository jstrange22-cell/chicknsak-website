// Google Drive API Edge Function
//
// Proxies requests to Google Drive API. Uses OAuth2 service account or
// user credentials passed from the client.
//
// Actions:
//   test-connection   -- Validate credentials by listing root folder
//   create-folder     -- Create a project folder in Drive
//   upload-photo      -- Upload a photo to a project folder
//   list-files        -- List files in a project folder
//   get-or-create-project-folder -- Get existing or create new project folder

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DriveCredentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  rootFolderId?: string;
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

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Refresh access token using refresh token
async function refreshAccessToken(creds: DriveCredentials): Promise<string> {
  if (creds.accessToken) return creds.accessToken;

  if (!creds.refreshToken) {
    throw new Error('No access token or refresh token available. Please re-authenticate.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Make an authenticated request to Drive API
async function driveFetch(
  creds: DriveCredentials,
  endpoint: string,
  method = 'GET',
  body?: Record<string, unknown> | FormData,
  isUpload = false,
): Promise<unknown> {
  const baseUrl = isUpload ? UPLOAD_API : DRIVE_API;
  const url = `${baseUrl}/${endpoint}`;

  const accessToken = await refreshAccessToken(creds);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  let fetchBody: string | FormData | undefined;

  if (body instanceof FormData) {
    fetchBody = body;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: fetchBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API error (${response.status}): ${errorText}`);
  }

  return response.json();
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
    const { action, credentials, data } = await req.json() as {
      action: string;
      credentials: DriveCredentials;
      data?: Record<string, unknown>;
    };

    if (!credentials?.clientId || !credentials?.clientSecret) {
      return jsonResponse({ error: 'Missing Google Drive credentials.' }, 400);
    }

    // ------------------------------------------------------------------
    // Test Connection — list files in root/specified folder
    // ------------------------------------------------------------------
    if (action === 'test-connection') {
      try {
        const folderId = credentials.rootFolderId || 'root';
        const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
        const result = await driveFetch(
          credentials,
          `files?q=${query}&pageSize=5&fields=files(id,name,mimeType)`
        );
        return jsonResponse({
          success: true,
          message: 'Google Drive connection verified!',
          files: (result as Record<string, unknown>).files ?? [],
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Connection test failed',
        });
      }
    }

    // ------------------------------------------------------------------
    // Create Folder
    // ------------------------------------------------------------------
    if (action === 'create-folder') {
      if (!data?.name) {
        return jsonResponse({ error: 'Folder name required.' }, 400);
      }

      const parentId = (data.parentId as string) || credentials.rootFolderId || 'root';

      const metadata = {
        name: data.name as string,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const result = await driveFetch(credentials, 'files', 'POST', metadata);
      return jsonResponse({ success: true, folder: result });
    }

    // ------------------------------------------------------------------
    // Get or Create Project Folder
    // ------------------------------------------------------------------
    if (action === 'get-or-create-project-folder') {
      if (!data?.projectName) {
        return jsonResponse({ error: 'projectName required.' }, 400);
      }

      const parentId = credentials.rootFolderId || 'root';
      const projectName = data.projectName as string;

      // Search for existing folder
      const searchQuery = encodeURIComponent(
        `name = '${projectName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      const searchResult = await driveFetch(
        credentials,
        `files?q=${searchQuery}&fields=files(id,name)`
      ) as { files: Array<{ id: string; name: string }> };

      if (searchResult.files?.length > 0) {
        return jsonResponse({
          success: true,
          folder: searchResult.files[0],
          created: false,
        });
      }

      // Create new folder
      const metadata = {
        name: projectName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const newFolder = await driveFetch(credentials, 'files', 'POST', metadata);
      return jsonResponse({
        success: true,
        folder: newFolder,
        created: true,
      });
    }

    // ------------------------------------------------------------------
    // Upload Photo (from URL)
    // ------------------------------------------------------------------
    if (action === 'upload-photo') {
      if (!data?.photoUrl || !data?.fileName) {
        return jsonResponse({ error: 'photoUrl and fileName required.' }, 400);
      }

      const folderId = (data.folderId as string) || credentials.rootFolderId || 'root';

      // Fetch the photo
      const photoResponse = await fetch(data.photoUrl as string);
      if (!photoResponse.ok) {
        return jsonResponse({ error: 'Failed to fetch photo from URL.' }, 400);
      }

      const photoBlob = await photoResponse.blob();

      // Create file metadata
      const metadata = {
        name: data.fileName as string,
        parents: [folderId],
        description: (data.description as string) || '',
      };

      // Use multipart upload
      const accessToken = await refreshAccessToken(credentials);
      const boundary = 'boundary_' + Date.now();

      const metadataStr = JSON.stringify(metadata);
      const photoArray = new Uint8Array(await photoBlob.arrayBuffer());

      // Build multipart body
      const encoder = new TextEncoder();
      const parts = [
        encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`),
        encoder.encode(`--${boundary}\r\nContent-Type: ${photoBlob.type}\r\n\r\n`),
        photoArray,
        encoder.encode(`\r\n--${boundary}--`),
      ];

      // Combine parts
      const totalLength = parts.reduce((sum, p) => sum + p.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        combined.set(part, offset);
        offset += part.byteLength;
      }

      const uploadResponse = await fetch(
        `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: combined,
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      return jsonResponse({ success: true, file: uploadResult });
    }

    // ------------------------------------------------------------------
    // List Files in a folder
    // ------------------------------------------------------------------
    if (action === 'list-files') {
      const folderId = (data?.folderId as string) || credentials.rootFolderId || 'root';
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
      const result = await driveFetch(
        credentials,
        `files?q=${query}&pageSize=50&fields=files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)&orderBy=modifiedTime desc`
      );
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Unknown action
    // ------------------------------------------------------------------
    return jsonResponse(
      { error: `Unknown action: "${action}".` },
      400
    );
  } catch (error) {
    console.error('google-drive-api error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
