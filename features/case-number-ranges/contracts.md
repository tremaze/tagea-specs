# Contracts: Case Number Ranges

> All endpoints are mounted under the cases controller and require `Auth({ scope: 'institution', ... })`.

## Endpoints

### `GET /cases/admin/number-range`

Returns the active range for the current `(tenant, institution)`. Auto-initializes if missing (so the first call from a fresh institution returns the default rather than `404`).

**Permission:** `cases.view`

**Response 200:** `CaseNumberRange`

### `PATCH /cases/admin/number-range`

Updates the pattern and start number for the active range.

**Permission:** `cases.edit`

**Request body:** `UpdateNumberRangeDto`

```ts
interface UpdateNumberRangeDto {
  pattern: string;       // e.g. "%YY-%NUMBER", "%YYYY/%NUMBER"
  start_number: number;  // >= 1
}
```

**Response 200:** `CaseNumberRange`
**Errors:** `400` (invalid pattern), `500` (write failure)

### `GET /cases/admin/number-range/preview`

Shows what the next case number would be without incrementing.

**Permission:** `cases.view`

**Response 200:**

```ts
interface PreviewResponse {
  preview: string; // e.g. "26-0042"
}
```

### `POST /cases/admin/number-range/reset`

Resets `current_sequence` to `start_number` and `current_year` to the current year. Idempotent.

**Permission:** `cases.edit`

**Response 200:** `CaseNumberRange`

## Internal contract (implicit)

### `POST /institutions/:institutionId/cases`

The case-create endpoint **must** succeed against an institution that has never generated a case number before. The service-level invariant is:

```
generateNextCaseNumber(req)
  ⇒ returns a number string
  ⇒ MUST NOT throw "Number range not initialized" — auto-init runs first
```

When the underlying transaction does fail for other reasons (DB outage, write-queue collapse), `cases.service.ts:create` rethrows as `InternalServerErrorException("Failed to create case: <underlying>")` so the underlying message survives in Sentry.

## Data Models

```ts
// Source: apps/tagea-backend/src/cases/entities/case-number-range.entity.ts
@Entity('case_number_ranges')
class CaseNumberRange {
  id: string;                    // uuid
  institution_id: string | null; // null = tenant-wide default
  pattern: string;               // "%YY-%NUMBER" | "%YYYY-%NUMBER" | …
  start_number: number;
  current_sequence: number;
  current_year: number;
  created_at: Date;
  updated_at: Date;
}
```

**Lookup precedence** (in `getInstitutionWhere`):

1. `institution_id = :requestInstitutionId`
2. `institution_id IS NULL` (tenant-wide default)

`ORDER BY institution_id DESC` ensures the institution-specific row wins when both exist.
