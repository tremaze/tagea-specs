# Feature: Case Number Ranges

> **Status:** 🚧 Spec drafted — backend exists, spec retrofit
> **Owner:** baumgart
> **Last updated:** 2026-05-05

## Vision (Elevator Pitch)

Each tenant generates monotonic, year-rollover-aware case numbers (e.g. `26-0001`) without administrators having to provision anything before the first case is created. Träger-Admins can later customize the pattern and start number per institution; the sequence keeps incrementing through year boundaries with optimistic concurrency control.

## User Stories

- As a **staff member** I want to create a case in a freshly onboarded institution, so that work can start without an admin first opening Settings to configure number ranges.
- As a **Träger-admin** I want to configure pattern and start number per institution, so that case IDs match the customer's existing numbering convention.
- As a **Träger-admin** I want to preview the next number, so that I see the effect of a pattern change before saving.
- As a **Träger-admin** I want to reset the sequence, so that I can recover from data imports or restores that broke the counter.

## Acceptance Criteria

### Auto-initialization (the contract `POST /institutions/:id/cases` relies on)

- [ ] **Given** an institution that has never generated a case number, **When** the first `POST /institutions/:id/cases` arrives, **Then** the backend creates a `case_number_ranges` row with the institution's `institution_id`, pattern `%YY-%NUMBER`, `start_number=1`, `current_sequence=1`, `current_year` = current year, and the case is created with the resulting number.
- [ ] **Given** a tenant where neither an institution-specific nor a tenant-default range exists, **When** any case-creating call hits `generateNextCaseNumber()`, **Then** auto-init runs (no `500 Failed to create case`).
- [ ] **Given** a Träger-admin opens **Settings → Case numbers** for the first time, **When** the page loads, **Then** `GET /cases/admin/number-range` returns the auto-initialized default (does **not** require a separate config call).

### Configuration

- [ ] **Given** `PATCH /cases/admin/number-range` with `{ pattern, start_number }`, **When** the pattern parses (`%YY` / `%YYYY` / `%NUMBER` placeholders), **Then** the row is updated and the next case uses the new pattern.
- [ ] **Given** an invalid pattern, **When** the PATCH fires, **Then** the backend responds `400` with the validation message.
- [ ] **Given** `GET /cases/admin/number-range/preview`, **When** called, **Then** the response shows what the next number **would be** without incrementing the sequence.
- [ ] **Given** `POST /cases/admin/number-range/reset`, **When** the user has `cases.edit`, **Then** `current_sequence` is set to `start_number` and `current_year` is set to the current year.

### Generation semantics

- [ ] **Given** the year flips from `current_year` to a new year, **When** the next number is generated, **Then** `current_year` is updated and the sequence resets per pattern semantics (year-prefix patterns restart numbering on year change).
- [ ] **Given** two concurrent `POST /institutions/:id/cases` calls, **When** both reach `generateNextCaseNumber()`, **Then** at most one succeeds per attempt; the other retries up to `MAX_RETRIES` via the optimistic-lock loop in `cases.service.ts:create`.
- [ ] **Given** a UNIQUE-violation on `cases_case_number_unique` (sequence drift after import/restore), **When** create retries, **Then** `syncSequenceToMax()` realigns the sequence to `MAX(case_number)+1` before the next attempt.

### Error contract

- [ ] **Given** any non-trivial failure inside `cases.service.ts:create`, **When** the catch block is hit, **Then** the thrown `InternalServerErrorException` carries the **underlying error message** (`Failed to create case: <reason>`) so Sentry shows the real cause instead of a generic title.

## Non-Goals

- **Per-user numbering** — sequences are tenant- or institution-scoped only.
- **Custom alphabets / locale-specific numerals** — pattern engine is `%YY` / `%YYYY` / `%NUMBER` only.
- **Backfill / mass-renumber UI** — reset is the only bulk operation; mass-renumber would have to be a separate spec.
- **History / audit of pattern changes** — not tracked in `case_number_ranges` itself; Träger-admins are trusted.

## Edge Cases

- **No tenant context** — `getInstitutionWhere()` returns `[]`, generator looks up the tenant-wide range (no institution filter). If still nothing, auto-init creates a row with `institution_id = null`.
- **Concurrent first-create** — auto-init runs inside `executeTransaction`. If two concurrent inserts both detect "no range" and both try to insert, the second hits a UNIQUE constraint (depends on schema); fallback is the existing retry loop in `cases.service.ts:create`. Documented because the behavior matters for high-throughput onboarding.
- **Sequence drift after database restore** — `syncSequenceToMax()` is the documented recovery path; the retry in `create` invokes it automatically on UNIQUE violation.
- **Year rollover on Dec 31 → Jan 1** — `generateNextCaseNumber` resets `current_sequence` when `current_year` changes, then increments. Verified via the `generateNextCaseNumber` unit tests.

## Permissions & Tenant/Institution

- **Required permission for create:** `cases.edit` (POST /institutions/:id/cases enforces this independently).
- **Required permission for read:** `cases.view` (`GET admin/number-range`, `GET admin/number-range/preview`).
- **Required permission for write:** `cases.edit` (`PATCH admin/number-range`, `POST admin/number-range/reset`).
- **Institution context:** when `req.institutionId` is present, range lookup is `institution_id = :id OR institution_id IS NULL`, ordered `institution_id DESC` (institution-specific wins). When not present, only the tenant-wide row (`institution_id IS NULL`) is considered.
- **Backend access checks:** `Auth({ scope: 'institution', permissions: [...] })` decorator; institution scope means the URL must carry the institution id, and the user must be assigned to that institution.

## Notifications (Push / In-App)

- Not a push target.

## i18n Keys

> User-facing strings remain in German.

- Pattern validation error messages live in `NumberRangePattern.validatePattern()` on the entity (returned as `400` body).
- No frontend translation keys are owned by this feature directly; the Settings page handles its own labels.

## Offline Behavior

- N/A — server-side only.

## References

- **Backend service:** [`apps/tagea-backend/src/cases/services/number-range.service.ts`](../../../apps/tagea-backend/src/cases/services/number-range.service.ts)
- **Backend controller:** [`apps/tagea-backend/src/cases/controllers/cases.controller.ts`](../../../apps/tagea-backend/src/cases/controllers/cases.controller.ts) — see endpoints `admin/number-range`, `admin/number-range/preview`, `admin/number-range/reset`
- **Entity:** [`apps/tagea-backend/src/cases/entities/case-number-range.entity.ts`](../../../apps/tagea-backend/src/cases/entities/case-number-range.entity.ts)
- **Caller:** `cases.service.ts:create` invokes `generateNextCaseNumber()` inside an optimistic-lock retry loop.
- **Migrations:**
  - `20251014120000-CreateCasesAndNumberRangeTables.ts` (initial table)
  - `20251110101000-AddInstitutionToCaseNumberRanges.ts` (per-institution column)
  - `20251110102000-AssignLegacyDataToMainInstitution.ts` (backfill for existing tenants)
- **Sentry context:** see endpoints `admin/number-range`, `admin/number-range/preview`, `admin/number-range/reset` in production. The 2026-05 Sentry triage uncovered tenants where neither institution-specific nor tenant-default rows existed — this spec captures the auto-init contract that closes that gap.
