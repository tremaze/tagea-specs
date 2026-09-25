# Contracts: Meine Arbeitszeit (My Working Time)

> API endpoints, DTOs and models behind `/meine-arbeitszeit`. Verified against the backend controllers, DTOs and entities on 2026-09-25. All routes are tenant-scoped (tenant header as everywhere) and relative to the API base (`apiConfig.getApiUrl(...)`).

## Endpoints

| Method + path | Permission / guard | Purpose |
| --- | --- | --- |
| `GET /users/me/timeTracking/isEnabled` | `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` | Effective provider, `enabled`, `hasValidContract` → `TimeTrackingEnabledResult` |
| `POST /users/me/timeTracking/vivendi/link-check` | same; effective provider must be `VIVENDI` | Verify (and persist) the link to the Vivendi employee record → `VivendiLinkCheckResult` (200 also for a failed link — the verdict is in `status`) |
| `GET /users/me/timeTracking/vivendi/status` | same; `VIVENDI` | Open booking today + last 2 bookings → `VivendiStatusRaw` |
| `POST /users/me/timeTracking/vivendi/kommen` | same; `VIVENDI` | Book "Kommen" in Vivendi at server time → `VivendiStatusRaw` (200) |
| `POST /users/me/timeTracking/vivendi/gehen` | same; `VIVENDI` | Book "Gehen" in Vivendi at server time → `VivendiStatusRaw` (200) |
| `GET /users/me/timeTracking/pendingTimestamps` | same; not `VIVENDI` | Segments of the open session (chronological) → `{ entries, vivendiAdopted }` |
| `POST /users/me/timeTracking/checkIn` | same; not `VIVENDI` | Open session if needed, open a segment at server time (idempotent while one is open) → segment + `vivendiAdopted` (200) |
| `POST /users/me/timeTracking/checkOut` | same; not `VIVENDI` | Close the open segment at server time → segment (200) |
| `POST /users/me/timeTracking/cancel` | same; not `VIVENDI` | Delete the open session incl. segments → `{ cancelled: true }` (200) |
| `POST /users/me/timeTracking/submit` | same; not `VIVENDI` | Close the open session with corrected start/end/break/comment (`SubmitTrackingDto`) → tracked time (200) |
| `GET /users/me/trackedTimes?startDate&endDate` | `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` | Own history (`TrackedTimeFiltersDto`); from Vivendi for Vivendi punchers → tracked time[] |
| `POST /users/me/trackedTimes` | same | Manual entry ("Zeit nachtragen", `CreateTrackedTimeDto`); for Vivendi punchers a closed Zeitbuchung in Vivendi → tracked time (201) |
| `GET /employees/me/working-time-targets?from&to` | `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` | Own targets per day, per month, period, absence work-days (`WorkingTimeTargetRangeDto`) → `SollAntwort` |
| `GET /employees/me/schedule?start&end` | same | Own shift assignments across all assigned institutions (`PepScheduleFiltersDto`; `start` inclusive, `end` **exclusive**) → `MyScheduleRow[]` |
| `GET /employees/me/vacation-quota?year` | same | Own vacation balance for a year (default: current year; invalid → current year) → `UrlaubsKontoAntwort` |
| `GET /employees/me/working-hours/absences` | `@Auth({ scope: 'authenticated' })` (no user-type restriction; employee resolved from the principal) | Own absences incl. `decided_by_name` → `AbsencePeriod[]` (ordered by `start_date` desc) |
| `POST /employees/me/working-hours/absences` | same | Create own absence (`CreateAbsenceDto`) → `AbsencePeriod` (201) |
| `PATCH /employees/me/working-hours/absences/:id` | same; `:id` must be a UUID | Update own absence (`UpdateAbsenceDto`, partial) → `AbsencePeriod` |
| `DELETE /employees/me/working-hours/absences/:id` | same | Withdraw (→ `cancelled`) a request, or hard-delete a never-requested absence → `204` |

**Not used by this page but related:** `GET /employees/me/working-hours/templates` (read-only own weekly pattern). No person-scoped time-account endpoint exists; month closings (`time_account_entries`) are only readable through institution/tenant HR endpoints.

**No tenant permission** is checked on any of these endpoints, and the backend does **not** check the `timeTracking` feature flag on the punch endpoints — the effective-provider rule decides (feature off ⇒ `DISABLED`; Tagea paths still accept `DISABLED`/`FACTORIAL`, only Tagea↔Vivendi mismatches are rejected). The absence endpoints are independent of `timeTracking`.

### Effective provider rule (`resolveEffectiveTimeTrackingProvider`)

| Tenant `timeTracking` | Result |
| --- | --- |
| feature not enabled | `DISABLED` |
| `provider` = `TAGEA` / `VIVENDI` / `FACTORIAL` | that provider (personal setting ignored) |
| `provider` = `DISABLED` | `DISABLED` |
| `provider` = `BOTH` | employee `time_tracking_provider` if `TAGEA`/`VIVENDI`, else tenant `defaultProvider`, else `TAGEA` |
| no provider stored | `TAGEA` |

`isEnabled` answers `enabled = provider !== 'DISABLED'`.

## Request DTOs

> Documentation-only shape. Backend DTOs (`apps/tagea-backend/src/time-tracking/dto/`, `workforce-planning/dto/`); validation via class-validator.

```ts
// submit-tracking.dto.ts and create-tracked-time.dto.ts are identical
class SubmitTrackingDto {
  start: string;          // @IsDateString — ISO timestamp
  end: string;            // @IsDateString — must be > start, else 400 "End time must be after start time"
  breakDuration: number;  // @IsInt @Min(0) — minutes
  comment?: string;       // @IsOptional @IsString
}

class TrackedTimeFiltersDto {
  startDate: string;      // @IsDateString — ISO timestamp (inclusive), filter on booking start
  endDate: string;        // @IsDateString — ISO timestamp
}

class WorkingTimeTargetRangeDto {
  from: string;           // @IsNotEmpty @IsDateString — YYYY-MM-DD, inclusive
  to: string;             // @IsNotEmpty @IsDateString — YYYY-MM-DD, inclusive
}

class PepScheduleFiltersDto {
  start: string;          // @IsNotEmpty @IsDateString — YYYY-MM-DD, inclusive
  end: string;            // @IsNotEmpty @IsDateString — YYYY-MM-DD, exclusive
}
```

Absence create / update (frontend mirror in `models/absence-period.model.ts`; backend `working-hours/dto/create-absence.dto.ts`, `UpdateAbsenceDto = PartialType(CreateAbsenceDto)`):

```ts
interface CreateAbsenceDto {
  start_date: string;   // YYYY-MM-DD — required ("Startdatum ist erforderlich"); must be <= end_date
  end_date: string;     // YYYY-MM-DD — required ("Enddatum ist erforderlich")
  type: AbsenceType;    // 'vacation' | 'sick' | 'training' | 'other'
  description?: string; // max 500 chars ("Beschreibung darf maximal 500 Zeichen haben")
  is_active?: boolean;  // default true (soft-delete flag; the page never sends it)
}

interface UpdateAbsenceDto {
  start_date?: string;
  end_date?: string;
  type?: AbsenceType;
  description?: string;
  is_active?: boolean;
}
```

`AbsenceType` is a **fixed enum** (backend `absences/absence-type.ts`), not a tenant-configurable table. Only the approval requirement per type is tenant-configurable (feature `absenceApproval.requiresApproval`; default vacation/training/other `true`, `sick` always `false`).

## Response shapes

### `isEnabled` / Vivendi

```ts
// packages/time-tracking/src/lib/models/time-tracking.models.ts (consumed by the frontend data source)
interface TimeTrackingEnabledResult {
  enabled: boolean;
  provider: TimeTrackingProvider; // 'DISABLED' | 'TAGEA' | 'FACTORIAL' | 'VIVENDI' (never 'BOTH')
  hasValidContract: boolean;      // active contract covering today (Europe/Berlin)
}

// apps/tagea-frontend/src/app/data-sources/http-time-tracking.data-source.ts
interface VivendiStatusRaw {
  isRunning: boolean;
  kommen: string | null;          // start of the open booking
  recentBookings: Array<{ id: number; kommen: string; gehen: string | null; pause: number }>;
}
```

> Documentation-only shape. `VivendiLinkCheckResult` (backend `time-tracking/vivendi-link-check.service.ts`, mirrored in `@tagea/time-tracking`).

```ts
type VivendiLinkStatus = 'ok' | 'no_source' | 'no_personnel_number' | 'not_found' | 'ambiguous' | 'connection_failed';

interface VivendiLinkCheckResult {
  status: VivendiLinkStatus;
  mitarbeiterId: number | null;    // only with 'ok'
  personnelNumber: string | null;  // number that was looked up
  persisted: boolean;              // employees.external_reference written by this check
  checkedAt: string;               // ISO timestamp
}
```

### Tracked times and segments

The punch and history endpoints return the **raw TypeORM entity** (snake_case; no DTO mapping). Note the two field names that differ from the package model: segments arrive as `entries` (model: `times`), the break as `break_duration` (model: `breakDuration`).

> Documentation-only shape. Entities `tracked_time` / `time_tracking_entry` (`apps/tagea-backend/src/time-tracking/entities/`).

```ts
interface TrackedTimeEntity {
  id: string;                         // uuid; for Vivendi: String(Zeitbuchung id), or "vivendi-{mitarbeiterId}-{startMs}" right after a manual entry
  employee_id: string;
  start: string;                      // ISO timestamptz
  end: string | null;                 // null = open session
  break_duration: number;             // minutes
  comment: string;                    // '' when none; always '' for Vivendi rows
  vivendi_adopted: boolean;
  vivendi_zeitbuchung_id: number | null;
  corrected_by: string | null;        // set when HR corrected the time
  corrected_at: string | null;
  entries: TimeTrackingEntryEntity[]; // eager; empty for manual entries and all Vivendi rows
  created_at: string;
  updated_at: string;
}

interface TimeTrackingEntryEntity {
  id: string;
  start: string;
  end: string | null;                 // null = running segment
  tracked_time_id: string;
}

// pendingTimestamps → { entries: TimeTrackingEntryEntity[]; vivendiAdopted: boolean }
// checkIn           → TimeTrackingEntryEntity & { vivendiAdopted: false }
// checkOut          → TimeTrackingEntryEntity
// cancel            → { cancelled: true }
```

"Origin" of a row is derived client-side: Vivendi puncher → "Aus Vivendi"; otherwise `entries.length > 0` → "Gestempelt", else "Nachgetragen". Worked minutes = `round((end − start) / 60000) − break_duration`, clamped at 0.

### Targets (`employees/me/working-time-targets`)

```ts
// apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit.service.ts
interface SollAntwort {
  days: SollTag[];
  months: SollMonat[];
  period: SollZeitraum;
  absences: SollAbwesenheit[];
  pattern_comparisons: MusterVergleich[];
}

interface SollTag {
  date: string;                                // YYYY-MM-DD
  target_minutes: number | null;               // null = no daily target (NOT 0)
  absence_credit_minutes: number;
  is_work_day: boolean;
  active_contracts: number;
  has_contracts_without_daily_target: boolean; // → hint "keinTagessoll"
  has_contracts_with_unknown_volume: boolean;  // → hint "volumenFehlt" (wins over the other)
}

interface SollZeitraum {
  target_minutes: number | null;
  absence_minutes: number;
  work_days: number;
  contract_days: number;
  has_contracts_without_target: boolean;
  has_contracts_with_unknown_volume: boolean;
}

interface SollMonat extends SollZeitraum {
  year: number;
  month: number;                               // 1-based
}

interface SollAbwesenheit {
  absence_id: string;
  work_days: number | null;                    // over the FULL absence period; null = not determinable
}

interface MusterVergleich {
  contract_id: string;
  pattern_minutes: number;
  contract_minutes: number;
  deviation_minutes: number;
}
```

The backend additionally sends `from`/`to` on `period` and months and `start_date`/`end_date` on each absence entry (unused by the page). Monthly targets must **not** be re-summed from daily values (rounding happens once per period).

### Roster and vacation quota

```ts
// meine-arbeitszeit.service.ts — backend MyScheduleShift
interface MyScheduleRow {
  id: string;
  date: string;               // YYYY-MM-DD
  shift_template_id: string;
  name: string;
  start_time: string;         // HH:MM:SS
  end_time: string;           // HH:MM:SS
  institution_id: string;
  institution_name: string;
}

// meine-arbeitszeit.service.ts — backend VacationQuotaResult
interface UrlaubsKontoAntwort {
  entitlement_days: number;   // pro rata per full contract month; multiple contracts add up; 0 without contract
  taken_days: number;         // approved vacation work days
  requested_days: number;     // requested, undecided
  remaining_days: number;     // entitlement − taken − requested; may be negative
}
```

### Absences

```ts
// apps/tagea-frontend/src/app/models/absence-period.model.ts (backend entity absence_periods + decided_by_name)
interface AbsencePeriod {
  id: string;
  employee_id: string;
  institution_id?: string | null;  // always null for self-service (absences are global per employee)
  start_date: string;              // YYYY-MM-DD
  end_date: string;
  type: AbsenceType;
  description?: string | null;
  source?: string;                 // 'manual' = created in Tagea; anything else (e.g. 'vivendi-sync', 'vivendi-dienste') = synced, read-only
  status?: AbwesenheitStatus;      // 'requested' | 'approved' | 'rejected' | 'cancelled'; missing = approved
  requested_at?: string | null;    // set only when created as a request
  decided_by_name?: string | null; // resolved name of the decider
  decision_comment?: string | null;// mandatory on rejection
  is_active: boolean;              // soft-delete flag; the page shows only active rows
  created_at?: string;
  updated_at?: string;
}
```

The backend entity also carries `external_id`, `decided_by`, `decided_at` (unused by the page).

**Server rules** (`working-hours.service.ts`, `absence-status.logic.ts`):

- Initial status on create: `requested` iff `absenceApproval.enabled` and the type requires approval (never for `sick`); else `approved`. `requested_at` is set only for requests.
- Overlap: rejected when overlapping another active absence with status `requested` or `approved` of the same employee.
- Edit (`PATCH`) and withdraw/delete (`DELETE`) allowed only if `status = requested`, or `status = approved` and never requested (`canEdit` / `canWithdraw`); a type change re-derives status and `requested_at`.
- `DELETE` on a request → status `cancelled` (row kept); on a never-requested absence → hard delete.
- Synced rows (`source` ≠ `manual`) cannot be edited or deleted.
- A foreign absence id answers 404 (not 403).

## Error codes

| Endpoint(s) | Status | Body / message | Client handling |
| --- | --- | --- | --- |
| all | 401 | — | session layer (redirect to session-expired), no inline message |
| punch paths | 400 | `{ code: 'TIME_TRACKING_PROVIDER_MISMATCH', message: 'Diese Person stempelt über Vivendi.' \| 'Diese Person stempelt über Tagea.' }` | generic `timeTracking.error.*` (client mix-up) |
| Vivendi paths, `trackedTimes` (Vivendi punchers) | 400 | `{ code: 'VIVENDI_LINK_NO_SOURCE' \| 'VIVENDI_LINK_NO_PERSONNEL_NUMBER' \| 'VIVENDI_LINK_NOT_FOUND' \| 'VIVENDI_LINK_AMBIGUOUS' \| 'VIVENDI_LINK_CONNECTION_FAILED', message }` | set link status → hint + lock + FAB warning; no generic banner |
| `vivendi/kommen` | 400 | "Es gibt bereits eine offene Zeitbuchung in Vivendi." | show message |
| `vivendi/gehen` | 400 | "Keine offene Zeitbuchung in Vivendi vorhanden." | show message |
| `checkOut` | 400 | "No active time tracking session" / "No active time tracking entry" | generic `timeTracking.error.checkOut` |
| `submit` | 400 | "No active time tracking session to submit", "Invalid start or end date", "End time must be after start time", validation errors | generic `timeTracking.error.submit` |
| `trackedTimes` POST | 400 | validation / "End time must be after start time" (Vivendi) | code-less 400 → generic `timeTracking.error.manualEntry`; coded 400 → its message |
| `trackedTimes` GET | 400 | validation (missing/invalid dates) | banner `meineArbeitszeit.fehler.zeiten` |
| any `me` path | 404 | "Mitarbeitende:r nicht gefunden" | generic error |
| absences POST/PATCH | 400 | "Startdatum muss vor dem Enddatum liegen", "Abwesenheit überschneidet sich mit bestehendem Eintrag (dd.mm.yyyy - dd.mm.yyyy)", validation messages (German), "Über diese Abwesenheit wurde bereits entschieden und sie kann nicht mehr geändert werden.", "Diese Abwesenheit wird aus einem anderen System synchronisiert und kann in Tagea nicht bearbeitet werden." | snackbar with server `message` |
| absences DELETE | 400 | "Über diese Abwesenheit wurde bereits entschieden und sie kann nicht mehr zurückgezogen werden.", "… kann in Tagea nicht gelöscht werden." | Angular: no feedback (gap) |
| absences PATCH/DELETE | 404 | "Abwesenheit mit ID {id} nicht gefunden" (also for foreign ids) | generic error |
| targets / schedule / vacation-quota | 400 | validation (missing/invalid dates) | targets → banner `fehler.soll` (Soll stays unknown "–"); schedule → empty week; quota → banner `fehler.urlaubskonto` |

## Events (WebSocket / Push)

No WebSocket events. Push / in-app / e-mail on absence decision (`APPROVAL_GRANTED` / `APPROVAL_DENIED`, `data.route = /meine-arbeitszeit?tab=abwesenheiten&antrag={id}`) — see [spec.md § Notifications](./spec.md#notifications-push--in-app).

## Client-side state (Angular)

- `TimeTrackingService` (`@tagea/time-tracking`, root singleton) owns the clock for page and FAB: `isEnabled`, `provider`, `hasValidContract`, `probeSettled`, `pendingEntries`, `vivendiStatus`, `vivendiLinkStatus` (`'idle' | 'checking' | VivendiLinkStatus`), `kannStempeln`, `elapsedMs`, `liveBreakDuration`. Tick every 500 ms (while paused only on minute change); sync `pendingTimestamps` every 10 s; initialised once per session for employees.
- `MeineArbeitszeitService` (page) aggregates the reads listed above and exposes the view models in `meine-arbeitszeit.model.ts` (`HeuteStatus`, `ZeitEintrag`, `SchichtEintrag`, `AbwesenheitEintrag`, `UrlaubsKonto`, `ZeitkontoStand`).
- Visibility rule `sichtbareFlaechen({ dienstplanungAktiv, hatArbeitsvertrag })` → `{ dienstplan, zeitkonto, tagesbilanz, urlaubskonto }`.

> **Flutter port note:** keep the JSON contract exactly (snake_case entity fields, `entries` / `break_duration` on tracked times, `target_minutes: null` ≠ `0`, `work_days: null` ≠ `0`). Model the punch clock as one app-wide state holder shared by FAB and page, as Angular does, so both can never disagree about whether the clock runs.
