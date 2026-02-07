// JobTread OAuth2 Authorization Edge Function
//
// Handles the two-step OAuth2 flow for connecting a JobMate
// company to their JobTread account.
//
// Actions:
//   ?action=authorize  -- Redirect the user to JobTread's OAuth consent screen.
//   ?action=callback   -- Exchange the authorization code for tokens and store them.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const JOBTREAD_CLIENT_ID = Deno.env.get('JOBTREAD_CLIENT_ID') ?? '';
const JOBTREAD_CLIENT_SECRET = Deno.env.get('JOBTREAD_CLIENT_SECRET') ?? '';
const JOBTREAD_REDIRECT_URI = Deno.env.get('JOBTREAD_REDIRECT_URI') ?? '';

const JOBTREAD_AUTH_URL = 'https://app.jobtread.com/oauth/authorize';
const JOBTREAD_TOKEN_URL = 'https://app.jobtread.com/oauth/token';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, 'Location': url },
  });
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
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // ------------------------------------------------------------------
    // Step 1: Redirect to JobTread OAuth consent screen
    // ------------------------------------------------------------------

    if (action === 'authorize') {
      if (!JOBTREAD_CLIENT_ID || !JOBTREAD_REDIRECT_URI) {
        return jsonResponse(
          { error: 'JobTread OAuth is not configured on the server.' },
          500
        );
      }

      // state carries the companyId so we can associate the tokens on callback
      const companyId = url.searchParams.get('companyId') ?? '';
      if (!companyId) {
        return jsonResponse({ error: 'companyId query parameter is required.' }, 400);
      }

      const state = btoa(JSON.stringify({ companyId }));
      const scopes = 'read write';

      const authUrl = new URL(JOBTREAD_AUTH_URL);
      authUrl.searchParams.set('client_id', JOBTREAD_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', JOBTREAD_REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', state);

      return redirectResponse(authUrl.toString());
    }

    // ------------------------------------------------------------------
    // Step 2: Exchange code for tokens
    // ------------------------------------------------------------------

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const errorParam = url.searchParams.get('error');

      if (errorParam) {
        const errorDesc = url.searchParams.get('error_description') ?? errorParam;
        return jsonResponse({ error: `JobTread authorization denied: ${errorDesc}` }, 400);
      }

      if (!code) {
        return jsonResponse({ error: 'Missing authorization code.' }, 400);
      }

      // Decode state to retrieve companyId
      let companyId = '';
      if (stateParam) {
        try {
          const parsed = JSON.parse(atob(stateParam));
          companyId = parsed.companyId ?? '';
        } catch {
          return jsonResponse({ error: 'Invalid state parameter.' }, 400);
        }
      }

      if (!companyId) {
        return jsonResponse({ error: 'Could not determine companyId from state.' }, 400);
      }

      // Exchange the code for access + refresh tokens
      const tokenResponse = await fetch(JOBTREAD_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: JOBTREAD_CLIENT_ID,
          client_secret: JOBTREAD_CLIENT_SECRET,
          redirect_uri: JOBTREAD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error('Token exchange failed:', errorBody);
        return jsonResponse(
          { error: `Token exchange failed (${tokenResponse.status}): ${errorBody}` },
          502
        );
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      };

      // Return the tokens to the client so it can store them via useConnectIntegration.
      // In a more secure setup you could write directly to Firestore from here using
      // the Firebase Admin SDK, but that requires additional Deno dependencies.
      return jsonResponse({
        success: true,
        companyId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresIn: tokens.expires_in ?? null,
        tokenType: tokens.token_type ?? 'Bearer',
      });
    }

    // ------------------------------------------------------------------
    // Unknown action
    // ------------------------------------------------------------------

    return jsonResponse(
      { error: `Unknown action: "${action}". Use "authorize" or "callback".` },
      400
    );
  } catch (error) {
    console.error('jobtread-auth error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
