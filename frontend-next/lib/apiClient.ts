import { formatApiError } from './formatError';
import {
  Person,
  Cat,
  CatsForPersonRequest,
  CatsForPersonResponse,
  MatchEvaluateRequest,
  MatchEvaluateResponse,
} from '../types/api';

function getApiBase(): string {
  return (typeof process !== 'undefined' && (process.env as any).NEXT_PUBLIC_API_BASE) || '';
}

function buildUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, '');
  if (!base) return path;
  return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
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
    throw new ApiError(formatApiError({ body: data }, resp.statusText || 'API error'), resp.status, data);
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

export async function getPerson(personId: string): Promise<Person> {
  const url = buildUrl(`/api/persons/${encodeURIComponent(personId)}`);
  const resp = await fetch(url, { method: 'GET' });
  return handleResponse<Person>(resp);
}

export async function listCatsForPerson(payload: CatsForPersonRequest): Promise<CatsForPersonResponse> {
  const url = buildUrl('/api/cats/for_person');
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<CatsForPersonResponse>(resp);
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
