# IntelVault Frontend

React + Vite + TypeScript frontend for IntelVault.

## Prerequisites

- Node.js 18+
- IntelVault backend running locally

## Environment

Create a `.env` file in the `frontend` folder:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

If this value is not provided, the app defaults to `http://127.0.0.1:8000/api/v1`.

## Install and run

```bash
npm install
npm run dev
```

## Validation

```bash
npm run lint
npm run build
npm test
```

## Backend route expectations

The frontend is wired to these backend route groups:

- `/auth/*`
- `/workspaces/*`
- `/workspaces/{workspace_id}/documents/*`
- `/workspaces/{workspace_id}/chat/*`
- `/workspaces/{workspace_id}/audit`
- `/workspaces/{workspace_id}/documents/{document_id}/shares/*`
- `/shares/{share_token}` and `/shares/{share_token}/download`

## Notes

- Public share links in the UI now copy the frontend route format: `/shares/{share_token}`.
- The public page then calls backend endpoints to fetch metadata and download files.
