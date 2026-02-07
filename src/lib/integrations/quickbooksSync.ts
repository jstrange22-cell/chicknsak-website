// QuickBooks Online Sync Service
//
// Handles syncing data between ProjectWorks and QuickBooks Online.
// Uses a Firebase Cloud Function as a proxy to avoid exposing QBO
// credentials in the browser.

import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QBOConfig {
  clientId: string;
  clientSecret: string;
  realmId: string;
  environment: 'sandbox' | 'production';
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

async function callQBOFunction(
  action: string,
  credentials: QBOConfig,
  data?: Record<string, unknown>,
) {
  const quickbooksApi = httpsCallable<Record<string, unknown>, Record<string, unknown>>(functions, 'quickbooksApi');
  const response = await quickbooksApi({ action, credentials, data });
  const result = response.data;

  if (result && !result.success) {
    throw new Error((result.error as string) || 'QBO request failed');
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
    const result = await callQBOFunction('test-connection', config);
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
  return callQBOFunction('get-customers', config);
}

/** Create an invoice in QBO from an estimate */
export async function createQBOInvoice(
  config: QBOConfig,
  invoiceData: QBOInvoiceData,
) {
  return callQBOFunction('create-invoice', config, invoiceData as unknown as Record<string, unknown>);
}

/** Fetch invoices from QBO */
export async function getQBOInvoices(config: QBOConfig) {
  return callQBOFunction('get-invoices', config);
}

/** Fetch payments from QBO */
export async function getQBOPayments(config: QBOConfig) {
  return callQBOFunction('get-payments', config);
}

/** Check payment status for a specific invoice */
export async function syncQBOPayment(config: QBOConfig, invoiceId: string) {
  return callQBOFunction('sync-payment', config, { invoiceId });
}
