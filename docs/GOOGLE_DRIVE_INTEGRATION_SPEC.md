# Google Drive Integration -- Technical Research

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Research Phase

---

## 1. Overview

Google Drive API v3 allows third-party apps to upload, organize, and share files in a user's Google Drive. For ProjectWorks, this integration would enable automatic photo/document backup, per-project folder organization, and file sharing with collaborators.

---

## 2. API Architecture

### 2.1 Base URL
- **API:** `https://www.googleapis.com/drive/v3`
- **Upload:** `https://www.googleapis.com/upload/drive/v3`
- **Format:** JSON (metadata), multipart (uploads)

### 2.2 Authentication (OAuth 2.0)
- **Authorization URL:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL:** `https://oauth2.googleapis.com/token`
- **Required Scopes:**
  - `https://www.googleapis.com/auth/drive.file` (files created by the app only -- **recommended**)
  - `https://www.googleapis.com/auth/drive` (full Drive access -- use only if needed)
- **Token lifetime:** Access tokens expire in 1 hour; refresh tokens persist until revoked
- **Google Cloud Console:** Must create OAuth 2.0 credentials and configure consent screen

### 2.3 OAuth Flow for ProjectWorks
1. User clicks "Connect Google Drive" in Settings > Integrations
2. Redirect to Google consent screen requesting `drive.file` scope
3. User grants access, redirected back with authorization code
4. Exchange code for access + refresh tokens via Supabase edge function
5. Store encrypted tokens in Firestore (`integrations/{companyId}/google-drive`)
6. Auto-create "ProjectWorks" root folder in user's Drive

---

## 3. Key Features for Construction

### 3.1 Folder Organization
```
POST /drive/v3/files  (with mimeType: application/vnd.google-apps.folder)
```
- Auto-create folder structure:
  ```
  ProjectWorks/
    ├── {Project Name}/
    │   ├── Photos/
    │   │   ├── Before/
    │   │   ├── Progress/
    │   │   └── After/
    │   ├── Documents/
    │   ├── Reports/
    │   └── Checklists/
    └── {Another Project}/
  ```
- Create folders on project creation or first sync

### 3.2 File Upload
```
POST /upload/drive/v3/files?uploadType=multipart
```
- Upload photos automatically after capture
- Upload generated reports (PDF)
- Upload completed checklists
- **Multipart upload:** Metadata + file content in single request
- **Resumable upload:** For large files (>5MB recommended)
- Max file size: 5TB (more than sufficient)

### 3.3 File Download / Access
```
GET /drive/v3/files/{fileId}?alt=media
GET /drive/v3/files/{fileId}?fields=webViewLink,webContentLink
```
- Generate shareable links for files
- Download files back to ProjectWorks if needed
- `webViewLink` opens in Google Drive viewer
- `webContentLink` provides direct download

### 3.4 File Sharing
```
POST /drive/v3/files/{fileId}/permissions
```
- Share project folders with collaborators
- Permission types: `reader`, `writer`, `commenter`
- Share via email address or generate shareable link
- Useful for sharing project documentation with customers/subs

### 3.5 Thumbnails and Metadata
```
GET /drive/v3/files/{fileId}?fields=thumbnailLink,imageMediaMetadata
```
- Google auto-generates thumbnails for uploaded images
- Access EXIF data (GPS, dimensions, camera info)
- Search files by name, type, parent folder

### 3.6 Search
```
GET /drive/v3/files?q=name contains 'kitchen' and mimeType='image/jpeg'
```
- Search files by name, MIME type, folder, date range
- Full-text search within documents
- Useful for finding project photos by keyword

---

## 4. Google Picker API

### 4.1 Overview
- Allows users to browse and select files from their Google Drive within our app
- Renders Google's native file picker UI in an overlay/modal
- **No API calls needed** -- handled entirely client-side
- Returns file metadata (id, name, URL) to our app

### 4.2 Implementation
```javascript
// Load the Google Picker API
gapi.load('picker', () => {
  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.DOCS_IMAGES)
    .setOAuthToken(accessToken)
    .setDeveloperKey(API_KEY)
    .setCallback(pickerCallback)
    .build();
  picker.setVisible(true);
});
```
- Useful for importing existing documents/photos from Drive into ProjectWorks

---

## 5. JavaScript/TypeScript SDK

### 5.1 Options
- **`googleapis` (npm):** Official Google APIs Node.js client -- works in Node.js/Deno
- **`gapi` (browser):** Google's browser-side client library
- **Direct fetch:** Works well from Supabase edge functions

### 5.2 Recommended Approach
- **Edge functions:** Use direct `fetch` with OAuth tokens (same pattern as other integrations)
- **Client-side:** Use Google Picker API for file selection
- **Background sync:** Supabase edge function for automatic photo backup

```typescript
// Supabase edge function example
const response = await fetch(
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  }
);
```

---

## 6. Rate Limits and Quotas

### 6.1 Free Tier
- **Queries per day:** 1,000,000,000 (effectively unlimited)
- **Queries per 100 seconds per user:** 100
- **Uploads per day:** 750 per user (can be increased)
- **Shared drive limits:** 400,000 items max

### 6.2 Storage
- Files stored in the connected user's Google Drive count against their quota
- Google Workspace users typically have 30GB-unlimited storage
- Free Google accounts have 15GB shared across Gmail, Drive, Photos

---

## 7. Webhooks / Push Notifications

### 7.1 Changes API (Watch)
```
POST /drive/v3/files/watch  (watch specific file)
POST /drive/v3/changes/watch  (watch for any changes)
```
- Google pushes notifications to your registered webhook URL
- Notifications include resource URI and change type
- **Channel expiration:** Max 24 hours (must re-register periodically)
- **Use case:** Detect when files are added/modified/deleted externally

### 7.2 Practical Considerations
- Webhook channels expire and need renewal (cron job or scheduled function)
- Notifications are "something changed" signals -- you still need to poll for details
- For ProjectWorks, one-way push (ProjectWorks -> Drive) may be simpler initially

---

## 8. Implementation Plan

### Phase 1: OAuth Connection
1. Create Google Cloud project, configure OAuth consent screen
2. Create Supabase edge function `google-drive-auth` for OAuth flow
3. Add Google Drive connection UI to IntegrationSettings (replace "coming soon")
4. Store encrypted tokens in Firestore
5. Auto-create "ProjectWorks" root folder on first connect

### Phase 2: Photo Backup (Auto-Push)
1. Create Supabase edge function `google-drive-sync`
2. After photo upload to Firebase Storage, trigger Drive backup
3. Organize into project > category folder structure
4. Store Drive file ID in Firestore photo document for reference
5. Add "Backed up to Drive" indicator on photos
6. Add toggle in Settings: "Auto-backup photos to Google Drive"

### Phase 3: Document Sync
1. Backup generated reports (PDF) to Drive
2. Backup completed checklists to Drive
3. Allow importing documents from Drive via Picker API
4. Display Drive link on synced documents

### Phase 4: Collaboration
1. Share project folders with collaborators (customers, subs)
2. Generate shareable links for project documentation
3. Sync file permissions with ProjectWorks collaborator roles

---

## 9. Data Mapping

| ProjectWorks Entity | Google Drive Location | Sync Direction |
|---------------------|-----------------------|----------------|
| Project Photos | ProjectWorks/{Project}/Photos/{type}/ | Push to Drive |
| Reports (PDF) | ProjectWorks/{Project}/Reports/ | Push to Drive |
| Checklists (PDF) | ProjectWorks/{Project}/Checklists/ | Push to Drive |
| Uploaded Documents | ProjectWorks/{Project}/Documents/ | Push to Drive |
| External Documents | Drive (via Picker) | Pull to ProjectWorks |

---

## 10. Security Considerations

- Use `drive.file` scope (minimal access -- only files created by our app)
- OAuth tokens encrypted at rest in Firestore
- Token exchange and refresh done server-side only (edge functions)
- Google Picker API uses separate API key (restricted to our domain)
- File sharing respects Google Drive's built-in permission model
- Consider CORS configuration for direct upload from browser

---

*End of Google Drive research document.*
