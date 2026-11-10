/**
 * TypeScript API types for CatMatch frontend (Next.js + TypeScript target).
 *
 * These types are derived from the backend FastAPI Pydantic schemas and the
 * runtime behavior of the matching service (backend/app/services/matching.py)
 * and the endpoints POST /api/cats/for_person and POST /api/match/evaluate.
 *
 * Placement: frontend/types/api.ts is intended to be copied or imported into the
 * frontend-next (Next.js + TypeScript) application when the project is migrated.
 *
 * IMPORTANT: These types intentionally use optional fields for most properties
 * because the backend accepts partial person objects in requests and returns
 * cat records serialized from the DB which may omit nullable fields. Do not
 * assume presence of non-null fields unless your UI enforces and validates them.
 */

// Generic dictionary for opaque details returned by the backend
export type JsonObject = { [k: string]: any };

/** A factor returned by the matching service.
 *
 * Fields observed in runtime:
 * - type: short string identifying the factor (e.g. 'good_with_children', 'location', 'personality_overlap')
 * - match: boolean | null; True when factor matches, False when it is a confirmed incompatibility,
 *          null when informational or not applicable
 * - explanation: human readable explanation string
 * - details: optional object with extra debug/info fields (may vary by factor)
 */
export interface MatchFactor {
  type: string;
  // True / False / null according to evaluate_match implementation
  match?: boolean | null;
  explanation?: string;
  details?: JsonObject;
}

/** Result of evaluate_match(person, cat)
 *
 * Observed fields:
 * - recommended: False when a confirmed incompatibility exists; None (mapped to null) when
 *                no automatic recommendation is produced. The backend does not produce a
 *                True recommendation automatically with current rules.
 * - explanation: a readable summary string
 * - factors: list of MatchFactor
 */
export interface MatchResult {
  recommended?: boolean | null;
  explanation?: string;
  factors: MatchFactor[];
}

/** Cat shape based on backend.app.schemas.cat.CatRead
 *
 * All fields are optional (nullable/omitted) except the ones that are clearly required
 * by the model (id, name, age_stage in the DB model); here we conservatively mark
 * many fields optional because serialized records returned by the API may omit nullable columns.
 */
export interface Cat {
  id?: string; // UUID string
  name?: string;
  age_stage?: string;
  age_months?: number | null;
  sex?: string | null;
  breed?: string | null;
  size?: string | null;
  activity_level?: string | null;
  personality_traits?: any; // JSONB in backend; keep flexible
  good_with_children?: boolean | null;
  good_with_dogs?: boolean | null;
  vaccinated?: boolean | null;
  neutered?: boolean | null;
  health_status?: string | null;
  description?: string | null;
  image_urls?: any;
  location?: string | null;
  // ISO datetime strings as returned by JSON serialization of datetimes
  created_at?: string | null;
  updated_at?: string | null;
}

/** Person shape based on backend.app.schemas.person.PersonRead / PersonCreate
 *
 * Most fields are optional because the API accepts partial person objects for the
 * matching endpoints. Use Partial<Person> on the client if you want to send subsets.
 */
export interface Person {
  id?: string; // UUID string
  full_name?: string | null;
  bio?: string | null;
  location?: string | null;
  activity_level?: string | null;
  home_type?: string | null;
  home_size?: string | null;
  has_outdoor_space?: boolean | null;
  work_hours_per_day?: number | null;
  has_children?: boolean | null;
  has_other_pets?: boolean | null;
  other_pets_details?: any;
  personality_traits?: any;
  preferred_cat_traits?: any;
  time_outside?: string | null;
  time_available?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

/** Item returned by POST /api/cats/for_person
 *
 * - cat: Cat record (serialized)
 * - match: MatchResult from evaluate_match
 * - incompatibility_count: integer count of factors where match == false
 */
export interface CatsForPersonItem {
  cat: Cat;
  match: MatchResult;
  incompatibility_count: number;
}

/** Request payload for POST /api/cats/for_person
 *
 * Either provide person_id (string) or a person object (partial Person). The backend
 * requires at least one of them and will return 400 if none provided. This mirrors
 * the implementation behavior.
 */
export interface CatsForPersonRequest {
  person_id?: string;
  person?: Partial<Person>;
}

/** Request payload for POST /api/match/evaluate
 *
 * The backend accepts either identifiers (person_id, cat_id) or full objects
 * (person, cat). We keep both options optional here.
 */
export interface MatchEvaluateRequest {
  person_id?: string;
  cat_id?: string;
  person?: Partial<Person>;
  cat?: Partial<Cat>;
}

/** Response of POST /api/match/evaluate is MatchResult */
export type MatchEvaluateResponse = MatchResult;

/** Response of POST /api/cats/for_person is CatsForPersonItem[] */
export type CatsForPersonResponse = CatsForPersonItem[];

// Note on ambiguities discovered while typing:
// - The backend may return ORM objects serialized in a slightly different shape depending on
//   the DB driver/serialization. The Cat/Person interfaces are permissive (many optional fields)
//   to accommodate this. If the frontend requires stricter shapes, perform a normalize/mapper
//   step on the client that fills missing fields or transforms them to a stable DTO.

// End of types
