import type {
  Person,
  CatsForPersonRequest,
  CatsForPersonResponse,
  MatchEvaluateRequest,
  MatchEvaluateResponse,
} from "../types/api";

// Small runtime wrapper to read the API base URL from common frontend envs.
// Priority:
// 1. import.meta.env.VITE_API_BASE (Vite)
// 2. process.env.REACT_APP_API_BASE (CRA / other env)
// 3. fallback to empty string (relative paths)
const API_BASE: string = (typeof (import.meta as any) !== "undefined" && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || (typeof process !== 'undefined' && (process.env as any).REACT_APP_API_BASE) || '';

function buildUrl(path: string) {
  // Ensure no double slashes
  if (!API_BASE) return path;
  return API_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

async function handleResponse<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch (e) {
    // If response is not JSON, keep raw text
    data = text;
  }
  if (!resp.ok) {
    const err: any = new Error((data && data.detail) || resp.statusText || 'API error');
    err.status = resp.status;
    err.body = data;
    throw err;
  }
  return data as T;
}

// Create a Person profile (POST /api/persons/)
export async function createPerson(payload: Partial<Person>): Promise<Person> {
  const url = buildUrl('/api/persons/');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Person>(resp);
}

// Get a Person profile by id (GET /api/persons/{person_id})
export async function getPerson(personId: string): Promise<Person> {
  const url = buildUrl(`/api/persons/${encodeURIComponent(personId)}`);
  const resp = await fetch(url, { method: 'GET' });
  return handleResponse<Person>(resp);
}

// List cats for a person (POST /api/cats/for_person)
export async function listCatsForPerson(payload: CatsForPersonRequest): Promise<CatsForPersonResponse> {
  const url = buildUrl('/api/cats/for_person');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CatsForPersonResponse>(resp);
}

// Evaluate a single match (wrapper over POST /api/match/evaluate)
export async function evaluateMatch(payload: MatchEvaluateRequest): Promise<MatchEvaluateResponse> {
  const url = buildUrl('/api/match/evaluate');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MatchEvaluateResponse>(resp);
}

// Export utility to get current base
export function getApiBase() {
  return API_BASE || '';
}
