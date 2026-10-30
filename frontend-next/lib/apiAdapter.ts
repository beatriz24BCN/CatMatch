// Lightweight API adapter helpers for frontend-next.
// NOTE: This file does NOT integrate or re-export the existing frontend/services/api.ts client.
// The existing client uses Vite's import.meta.env; integrating it into Next.js requires adapting
// the client to accept a base URL or copying a separate client implementation. That integration
// is intentionally left pending and documented here.

export function getApiBase(): string {
  return (typeof process !== 'undefined' && (process.env as any).NEXT_PUBLIC_API_BASE) || '';
}

export function buildUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  if (!base) return path;
  return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

// TODO: Integration notes
// - Option A (recommended): modify frontend/services/api.ts to accept an optional base URL
//   parameter or to detect NEXT_PUBLIC_API_BASE when import.meta.env is not available.
// - Option B: copy a small safe client into frontend-next that uses NEXT_PUBLIC_API_BASE.
// This file intentionally avoids performing that adaptation automatically to preserve the
// existing Vite client untouched.

