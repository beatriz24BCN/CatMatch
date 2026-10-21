import { formatApiError } from './formatError';
import type { Person, CatsForPersonRequest, CatsForPersonResponse, MatchEvaluateRequest, MatchEvaluateResponse } from '../types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function buildUrl(path: string) {
  if (!API_BASE) return path;
  return API_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

async function handleResponse<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  let data: any = undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch (e) {
    data = text;
  }
  if (!resp.ok) {
    const err: any = new Error(formatApiError({ body: data }, resp.statusText || 'API error'));
    err.status = resp.status;
    err.body = data;
    throw err;
  }
  return data as T;
}

export async function createPerson(payload: Partial<Person>): Promise<Person> {
  const url = buildUrl('/api/persons/');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<Person>(resp);
}

export async function listCatsForPerson(payload: CatsForPersonRequest) : Promise<CatsForPersonResponse> {
  const url = buildUrl('/api/cats/for_person');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CatsForPersonResponse>(resp);
}

export async function getCat(catId: string) {
  const url = buildUrl(`/api/cats/${encodeURIComponent(catId)}`);
  const resp = await fetch(url, { method: 'GET' });
  return handleResponse<any>(resp);
}

export async function evaluateMatch(payload: MatchEvaluateRequest): Promise<MatchEvaluateResponse> {
  const url = buildUrl('/api/match/evaluate');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MatchEvaluateResponse>(resp);
}

export async function createAdoptionRequest(payload: { cat_id: string; contact_email: string; message?: string }) {
  const url = buildUrl('/api/adoption_requests/');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<any>(resp);
}

export async function listAdoptionRequests(status?: string, limit = 100, offset = 0) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const url = buildUrl(`/api/adoption_requests/${qs}`);
  const resp = await fetch(url, { method: 'GET' });
  return handleResponse<any>(resp);
}

export async function updateAdoptionRequestStatus(reqId: string, status: string) {
  const url = buildUrl(`/api/adoption_requests/${encodeURIComponent(reqId)}`);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return handleResponse<any>(resp);
}
