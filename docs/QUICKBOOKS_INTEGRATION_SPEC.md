# QuickBooks Online Integration -- Technical Research

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Research Phase

---

## 1. Overview

QuickBooks Online (QBO) provides a REST API that allows third-party apps to create invoices, record payments, manage customers, and sync financial data. This integration would allow ProjectWorks to push invoices/payment requests to QBO and pull payment status back.

---

## 2. API Architecture

### 2.1 Base URL
- **Sandbox:** `https://sandbox-quickbooks.api.intuit.com`
- **Production:** `https://quickbooks.api.intuit.com`
- **API Version:** v3 (minor version 73+)
- **Format:** JSON

### 2.2 Authentication (OAuth 2.0)
- **Authorization URL:** `https://appcenter.intuit.com/connect/oauth2`
- **Token URL:** `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- **Scopes:** `com.intuit.quickbooks.accounting` (full accounting access)
- **Token lifetime:** Access tokens expire in 1 hour; refresh tokens expire in 100 days
- **Required:** Redirect URI registration in Intuit Developer portal

### 2.3 OAuth Flow for ProjectWorks
1. User clicks "Connect QuickBooks" in Settings > Integrations
2. Redirect to Intuit OAuth consent screen
3. User grants access, redirected back with authorization code
4. Exchange code for access + refresh tokens via Supabase edge function
5. Store encrypted tokens in Firestore (`integrations/{companyId}/quickbooks`)
6. Use refresh token to renew access token before expiry

---

## 3. Key Endpoints for Construction

### 3.1 Customer Management
```
POST /v3/company/{realmId}/customer
GET  /v3/company/{realmId}/customer/{id}
GET  /v3/company/{realmId}/query?query=SELECT * FROM Customer WHERE ...
```
- Create/update customers to match ProjectWorks project customers
- Sync customer name, email, phone, address

### 3.2 Invoice Creation
```
POST /v3/company/{realmId}/invoice
GET  /v3/company/{realmId}/invoice/{id}
```
- Create invoices from ProjectWorks payment requests
- Map line items (description, quantity, amount)
- Include project reference in memo/description field
- Support for custom fields (project name, PO number)

### 3.3 Payment Recording
```
POST /v3/company/{realmId}/payment
GET  /v3/company/{realmId}/payment/{id}
```
- Record payments received against invoices
- Auto-update ProjectWorks payment status when QBO payment is recorded

### 3.4 Estimate/Quote
```
POST /v3/company/{realmId}/estimate
```
- Push AI-generated estimates from the chat assistant to QBO as quotes
- Convert estimates to invoices when approved

### 3.5 Items (Services/Products)
```
POST /v3/company/{realmId}/item
GET  /v3/company/{realmId}/query?query=SELECT * FROM Item
```
- Sync service items for line item consistency
- Map CSI divisions to QBO income accounts

---

## 4. JavaScript/TypeScript SDK

### 4.1 Official SDK
- **Package:** `intuit-oauth` (npm) -- handles OAuth 2.0 flow
- **No official REST client SDK for Node.js** -- use direct fetch/axios calls
- **Alternative:** `node-quickbooks` (community package, decent maintenance)

### 4.2 Recommended Approach
Use direct `fetch` calls from Supabase edge functions (same pattern as JobTread sync):
```typescript
// In Supabase edge function
const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(invoiceData),
  }
);
```

---

## 5. Rate Limits and Pricing

### 5.1 Rate Limits
- **Throttle limit:** 500 requests per minute per company (realmId)
- **Concurrent connections:** 10 per company
- **Batch operations:** Not natively supported; use individual API calls

### 5.2 Pricing
- **Development:** Free sandbox access with test companies
- **Production:** Free API access (no per-call charges)
- **Requirement:** App must be published on Intuit Marketplace for production use
- **Alternative:** Use development keys for internal/private apps (limited)

---

## 6. Webhook Support

### 6.1 Available Webhooks
- QBO supports webhooks for entity change notifications
- **Events:** Create, Update, Delete, Void, Merge
- **Entities:** Invoice, Payment, Customer, Estimate, Bill, etc.
- **Delivery:** HTTP POST to your registered endpoint
- **Verification:** HMAC-SHA256 signature validation

### 6.2 Use Cases for ProjectWorks
- Listen for Payment events to auto-update payment request status
- Listen for Invoice status changes (sent, viewed, paid)
- Sync customer updates back to ProjectWorks

---

## 7. Implementation Plan

### Phase 1: OAuth Connection
1. Create Supabase edge function `quickbooks-auth` for OAuth flow
2. Add QuickBooks connection UI to IntegrationSettings (replace "coming soon")
3. Store encrypted tokens in Firestore
4. Implement token refresh logic

### Phase 2: Invoice Sync (Push)
1. Create Supabase edge function `quickbooks-sync`
2. Add "Sync to QuickBooks" button on PaymentsPage
3. Map ProjectWorks payment requests to QBO invoices
4. Create/update customers as needed
5. Store QBO invoice ID in Firestore for reference

### Phase 3: Payment Status Sync (Pull)
1. Register webhook endpoint for Payment events
2. Create Supabase edge function `quickbooks-webhook`
3. Auto-update ProjectWorks payment status when QBO payment recorded
4. Add last-synced timestamp and sync status indicators

### Phase 4: Estimate Sync
1. Push AI-generated estimates to QBO as Estimate entities
2. Allow conversion to Invoice from QBO

---

## 8. Data Mapping

| ProjectWorks Entity | QBO Entity | Sync Direction |
|---------------------|------------|----------------|
| Payment Request | Invoice | Push to QBO |
| Payment (paid status) | Payment | Pull from QBO |
| Project Customer | Customer | Push to QBO |
| AI Estimate | Estimate | Push to QBO |
| Line Items | Invoice Line | Push to QBO |

---

## 9. Security Considerations

- OAuth tokens must be encrypted at rest in Firestore
- Token refresh should happen server-side (edge function), never client-side
- Webhook endpoint must validate HMAC signatures
- QBO realmId (company ID) should be stored per-company, not per-user
- Rate limit handling with exponential backoff

---

*End of QuickBooks research document.*
