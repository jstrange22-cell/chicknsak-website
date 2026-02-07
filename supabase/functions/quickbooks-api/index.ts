// QuickBooks Online API Edge Function
//
// Proxies requests to the QuickBooks Online API. The client passes stored
// credentials (Client ID, Client Secret, Realm ID) in the request body.
//
// Actions:
//   test-connection -- Validate credentials by fetching CompanyInfo
//   get-company     -- Fetch company info
//   get-customers   -- Fetch customers
//   create-invoice  -- Create an invoice from an estimate
//   get-invoices    -- Fetch invoices
//   get-payments    -- Fetch payments
//   sync-payment    -- Sync a specific payment status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/claude.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QBOCredentials {
  clientId: string;
  clientSecret: string;
  realmId: string;
  environment: 'sandbox' | 'production';
  accessToken?: string;
  refreshToken?: string;
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

function getBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';
}

// Get an OAuth2 access token using client credentials
async function getAccessToken(creds: QBOCredentials): Promise<string> {
  // If we already have an access token, use it
  if (creds.accessToken) return creds.accessToken;

  // Otherwise do client credentials exchange
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const basicAuth = btoa(`${creds.clientId}:${creds.clientSecret}`);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Make an authenticated request to the QBO API
async function qboFetch(
  creds: QBOCredentials,
  endpoint: string,
  method = 'GET',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const baseUrl = getBaseUrl(creds.environment);
  const url = `${baseUrl}/v3/company/${creds.realmId}/${endpoint}`;

  const accessToken = await getAccessToken(creds);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QBO API error (${response.status}): ${errorText}`);
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
      credentials: QBOCredentials;
      data?: Record<string, unknown>;
    };

    if (!credentials?.clientId || !credentials?.clientSecret || !credentials?.realmId) {
      return jsonResponse({ error: 'Missing QBO credentials.' }, 400);
    }

    // ------------------------------------------------------------------
    // Test Connection — fetch CompanyInfo
    // ------------------------------------------------------------------
    if (action === 'test-connection') {
      try {
        const result = await qboFetch(credentials, 'companyinfo/' + credentials.realmId);
        return jsonResponse({
          success: true,
          company: (result as Record<string, unknown>).CompanyInfo ?? result,
        });
      } catch (err) {
        return jsonResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Connection test failed',
        });
      }
    }

    // ------------------------------------------------------------------
    // Get Company Info
    // ------------------------------------------------------------------
    if (action === 'get-company') {
      const result = await qboFetch(credentials, 'companyinfo/' + credentials.realmId);
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Get Customers
    // ------------------------------------------------------------------
    if (action === 'get-customers') {
      const query = encodeURIComponent("SELECT * FROM Customer MAXRESULTS 100");
      const result = await qboFetch(credentials, `query?query=${query}`);
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Create Invoice from Estimate
    // ------------------------------------------------------------------
    if (action === 'create-invoice') {
      if (!data) {
        return jsonResponse({ error: 'Invoice data required.' }, 400);
      }

      const invoice = {
        Line: (data.lineItems as Array<Record<string, unknown>>)?.map((item) => ({
          DetailType: 'SalesItemLineDetail',
          Amount: item.amount,
          Description: item.description,
          SalesItemLineDetail: {
            Qty: item.quantity ?? 1,
            UnitPrice: item.unitPrice ?? item.amount,
          },
        })) ?? [],
        CustomerRef: data.customerRef ? { value: data.customerRef } : undefined,
        CustomerMemo: data.memo ? { value: data.memo } : undefined,
        DueDate: data.dueDate ?? undefined,
        DocNumber: data.docNumber ?? undefined,
      };

      const result = await qboFetch(credentials, 'invoice', 'POST', invoice);
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Get Invoices
    // ------------------------------------------------------------------
    if (action === 'get-invoices') {
      const query = encodeURIComponent("SELECT * FROM Invoice ORDERBY MetaData.CreateTime DESC MAXRESULTS 50");
      const result = await qboFetch(credentials, `query?query=${query}`);
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Get Payments
    // ------------------------------------------------------------------
    if (action === 'get-payments') {
      const query = encodeURIComponent("SELECT * FROM Payment ORDERBY MetaData.CreateTime DESC MAXRESULTS 50");
      const result = await qboFetch(credentials, `query?query=${query}`);
      return jsonResponse({ success: true, data: result });
    }

    // ------------------------------------------------------------------
    // Sync Payment — check payment status for a specific invoice
    // ------------------------------------------------------------------
    if (action === 'sync-payment') {
      if (!data?.invoiceId) {
        return jsonResponse({ error: 'invoiceId required.' }, 400);
      }

      const query = encodeURIComponent(`SELECT * FROM Payment WHERE Line.LinkedTxn.TxnId = '${data.invoiceId}'`);
      const result = await qboFetch(credentials, `query?query=${query}`);
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
    console.error('quickbooks-api error:', error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500
    );
  }
});
