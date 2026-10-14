Next.js scaffold for CatMatch

This folder contains a minimal Next.js + TypeScript scaffold for CatMatch. It is intentionally
minimal and does not install dependencies or rewire the existing Vite frontend.

Files created:
- package.json (Next.js 16 + React 19 + TypeScript versions suggested)
- tsconfig.json (TypeScript strict mode)
- next-env.d.ts
- pages/_app.tsx
- pages/index.tsx
- lib/apiAdapter.ts (helper; DOES NOT integrate the existing Vite client)
- components/PlaceholderNotice.tsx

How to proceed (manual steps — do not run yet):
1. cd frontend-next
2. npm install
3. Set environment variable: NEXT_PUBLIC_API_BASE=http://localhost:8000
4. npm run dev

Notes on integrating the existing client and types:
- The existing client (frontend/services/api.ts) uses import.meta.env.VITE_API_BASE and is
  targeted at the Vite app. To reuse it in Next.js, either adapt the client to accept a base URL
  parameter or copy a small client into this folder that uses NEXT_PUBLIC_API_BASE.
- The existing TypeScript types are in frontend/types/api.ts. Copy or import them after you have
  configured the project build; importing across folders may require adjusting build settings.
