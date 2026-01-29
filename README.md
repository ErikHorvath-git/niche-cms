# SaaS Platform (formerly “Niche CMS”)

This repository now hosts a multi-tenant SaaS experience for managing client-specific content with:

### Structure
- `backend/` – Express + Supabase API serving `client_content`, with CORS configured via `ALLOWED_ORIGINS`.
- `admin-frontend/` – Vue 3 admin interface that picks up the active client via env/URL parameters.
- `public/` – Static marketing/widget assets that can be embedded anywhere.
- `src/components/PriceSection.vue` – shared Vue component that fetches pricing for the current client.

### Environment
- `backend/.env` (ignored) must provide:
  - `SAAS_PLATFORM_SUPABASE_URL`
  - `SAAS_PLATFORM_SUPABASE_ANON_KEY`
  - Optional `ALLOWED_ORIGINS` (comma-separated, use `*` for wildcard).
- `admin-frontend/.env` (ignored) should define:
  - `VITE_BACKEND_URL` (e.g., `http://localhost:3000/api`)
  - `VITE_SAAS_CLIENT_ID` (`your-client-id` fallback for the admin panel)

### Running
```bash
npm install         # installs workspaces
npm run start:backend
npm run dev:admin   # runs the Vue admin UI
```

Use `clientId` query parameters or the env vars to switch clients:
```
http://localhost:5173/?clientId=client-b
```

### Widget integration
In any site:
```html
<div id="saas-widget" data-client="client-b"></div>
<script src="/widget.js" data-backend-url="https://api.saashost.com/api"></script>
```
The script first checks the widget container for `data-client`, then the script tag, and falls back to `saas-default-client`.

### Backend API highlights
- `GET /api/obsah/:clientId` – returns `client_content` records for a tenant.
- `POST /api/obsah/:clientId` – inserts a payload and overwrites `client_id` for consistency.
- `DELETE /api/obsah/:clientId/:id` – removes a single entry only when the client matches.

CORS honors `ALLOWED_ORIGINS` or falls back to localhost origins for development.
