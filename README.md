# JobMate

Jobsite photo documentation and project management PWA.

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Firebase (Auth, Firestore, Storage, Cloud Functions)
- Supabase Edge Functions
- Capacitor (iOS/Android)
- Zustand + TanStack Query
- Dexie (IndexedDB offline support)

## Getting Started

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Production files are output to `dist/`.

## Deploy to Hostinger

1. Run `npm run build`
2. Upload the contents of `dist/` to your Hostinger `public_html` directory
3. Add a `.htaccess` file for SPA routing (see below)

### .htaccess for SPA routing

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```
