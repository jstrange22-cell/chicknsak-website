// QuickBooks Online Sync Service
//
// Handles syncing data between ProjectWorks and QuickBooks Online.
// Uses a PHP proxy on the Hostinger server since Firebase Cloud Functions
// require the Blaze (paid) plan.

const PROXY_URL = `${window.location.origin}/api/quickbooks-proxy.php`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QBOConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  environment: 'sandbox' | 'production';
  accessToken?: string;
}

export interface QBOInvoiceLine {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

export interface QBOInvoiceData {
  lineItems: QBOInvoiceLine[];
  customerRef?: string;
  memo?: string;
  dueDate?: string;
  docNumber?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callQBOProxy(
  action: string,
  credentials: QBOConfig,
  data?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, credentials, data }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'QBO request failed');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Test the QBO connection with stored credentials */
export async function testQBOConnection(config: QBOConfig): Promise<{
  success: boolean;
  company?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const result = await callQBOProxy('test-connection', config);
    return { success: true, company: result.company as Record<string, unknown> | undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection test failed',
    };
  }
}

/** Fetch customers from QBO */
export async function getQBOCustomers(config: QBOConfig) {
  return callQBOProxy('get-customers', config);
}

/** Create an invoice in QBO from an estimate */
export async function createQBOInvoice(
  config: QBOConfig,
  invoiceData: QBOInvoiceData,
) {
  return callQBOProxy('create-invoice', config, invoiceData as unknown as Record<string, unknown>);
}

/** Fetch invoices from QBO */
export async function getQBOInvoices(config: QBOConfig) {
  return callQBOProxy('get-invoices', config);
}

/** Fetch payments from QBO */
export async function getQBOPayments(config: QBOConfig) {
  return callQBOProxy('get-payments', config);
}

/** Check payment status for a specific invoice */
export async function syncQBOPayment(config: QBOConfig, invoiceId: string) {
  return callQBOProxy('sync-payment', config, { invoiceId });
}
