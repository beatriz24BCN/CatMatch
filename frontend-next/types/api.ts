// Minimal TypeScript types for the frontend-next client.
// These are a small subset copied from frontend/types/api.ts to avoid cross-root imports.
// Keep in sync with backend/frontend/types/api.ts; this copy is intentional and may be
// reconciled later to avoid duplication.

export type JsonObject = { [k: string]: any };

export interface MatchFactor {
  type: string;
  match?: boolean | null;
  explanation?: string;
  details?: JsonObject;
}

export interface MatchResult {
  recommended?: boolean | null;
  explanation?: string;
  factors: MatchFactor[];
}

export interface Cat {
  id?: string;
  name?: string;
  age_stage?: string;
  [k: string]: any;
}

export interface Person {
  id?: string;
  full_name?: string | null;
  [k: string]: any;
}

export interface CatsForPersonItem {
  cat: Cat;
  match: MatchResult;
  incompatibility_count: number;
}

export interface CatsForPersonRequest {
  person_id?: string;
  person?: Partial<Person>;
}

export type CatsForPersonResponse = CatsForPersonItem[];

export interface MatchEvaluateRequest {
  person_id?: string;
  cat_id?: string;
  person?: Partial<Person>;
  cat?: Partial<Cat>;
}

export type MatchEvaluateResponse = MatchResult;

export interface AdoptionRequestRead {
  id: string;
  cat_id: string;
  person_id?: string | null;
  contact_email: string;
  contact_phone?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserRead {
  id: string;
  email: string;
  role: 'user' | 'admin' | string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
