# Contracts: Employee Availability

## Endpoints

| Method + Path | Purpose | Controller | Notes |
| ------------- | ------- | ---------- | ----- |
| `GET /institutions/:institutionId/working-hours/availability?weekStart=<iso>` | Weekly availability overlay for the institution calendar (`/calendar-page`). Returns all employees assigned to the institution. | `working-hours.controller.ts` | Existing. Stays institution-scoped. |
| `GET /employees/me/availability/check?employeeId=<uuid>&start=<iso>&end=<iso>` | Single-employee conflict check. Used by the appointment dialog in both institution mode and teamspace mode. Institution-independent. | `working-hours-self-service.controller.ts` (new method) | **New.** Replaces `GET /institutions/:id/working-hours/employee/:id/check-availability` for callers that do not have institution context. |

### `GET /employees/me/availability/check`

**Request query params:**

- `employeeId` (uuid, required) — the target employee. May be the caller (self-check) or any other employee (see authorization rules below).
- `start` (ISO-8601 datetime, required)
- `end` (ISO-8601 datetime, required, must be `> start`)

**Response:**

> Documentation-only shape. The `AvailabilityCheckResponse` interface will be authored in `apps/tagea-frontend/src/app/models/working-hours.model.ts` alongside the existing `EmployeeAvailability`/`WeeklyAvailabilityResponse`. This spec defines the wire contract; the frontend type will match on implementation.

```ts
// documentation-only
interface AvailabilityCheckResponse {
  employeeId: string;
  workingHoursStatus: 'within' | 'outside' | 'unknown';
  absence: {
    absenceType: AbsenceType;
    startDate: string;   // YYYY-MM-DD
    endDate: string;     // YYYY-MM-DD
  } | null;
  conflicts: Array<{
    appointmentId?: string;  // omitted if redacted
    start: string;           // ISO datetime
    end: string;             // ISO datetime
    redacted: boolean;       // true when the caller lacks access to the conflict's institution
    title?: string;          // omitted when redacted
    location?: string;       // omitted when redacted
  }>;
}
```

**Error codes:**

- `400` — `start >= end`, or invalid `employeeId`
- `401` — not authenticated
- `403` — caller is not allowed to query the target employee's availability (see authorization rules in spec)
- `404` — target employee does not exist

### `GET /institutions/:institutionId/working-hours/availability`

Shape unchanged — consumed by the institution calendar weekly overlay. Returns the per-employee rows already documented in [calendar/contracts.md](../calendar/contracts.md). Listed here for completeness; authority stays with the calendar spec.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/working-hours.model.ts
interface EmployeeAvailability {
  employee_id: string;
  first_name: string;
  last_name: string;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  profile_picture?: string;
  absence_type?: AbsenceType | null;
  absence_start_date?: string | null;
  absence_end_date?: string | null;
}

type WeeklyAvailabilityResponse = Record<string, EmployeeAvailability[]>;

type AbsenceType =
  | 'vacation'
  | 'sickness'
  | 'parental_leave'
  | 'training'
  | 'other';
```

## Service Methods

| Service | Method | Hits |
| ------- | ------ | ---- |
| `WorkingHoursService` | `getWeeklyAvailability(weekStart)` | `GET /institutions/:id/working-hours/availability` (institution calendar only) |
| `WorkingHoursService` | `checkEmployeeAvailability(employeeId, start, end)` | `GET /employees/me/availability/check` |

## Redaction Rule (cross-institution)

When a conflict falls in an institution the caller does not have access to, the backend returns the time window but strips `title`, `location`, and `appointmentId`. The `redacted: true` flag allows the UI to render a neutral "belegt" chip without leaking the appointment's semantic content.

## Timezone

All times returned are ISO-8601 UTC strings; the UI converts to `Europe/Berlin`. `start_time`/`end_time` in `EmployeeAvailability` are HH:MM **local** (Berlin) — historical convention of the working-hours templates.

> **Flutter port note:** mirror the two-tier shape — one typed service method for each endpoint; do not collapse them into a single "availability" concept, because the permission models differ.
