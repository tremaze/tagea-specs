# Feature: Employee Availability

> **Status:** ⏳ Planned
> **Owner:** sb
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

A unified read surface for "is this employee available at this time?" questions — used by the institution calendar (weekly overlay, conflict warnings) and by the teamspace calendar's appointment dialog (per-invitee conflict check during scheduling). Working Hours, Absences and overlapping Appointments fold into a single answer. The availability surface is institution-independent at the URL level: the caller does not need to pass an institution in the path, and employees without any institution assignment can be queried as participants in cross-institution appointments.

## User Stories

- As a **scheduler (institution calendar)** I want to see a weekly overlay of who is working when, so that I can book appointments into open slots.
- As an **organizer (teamspace calendar dialog)** I want to be warned if an invitee I'm adding has a conflict at the chosen time, so that I can move the meeting before inviting the wrong people.
- As an **employee without any institution assignment** I want to be invited to appointments and shown as (un)available based on my personal schedule (if any), so that cross-institution teamspace collaboration does not fail with a missing-context error.

## Acceptance Criteria

### Weekly availability (institution overlay)

- [ ] **Given** the institution calendar renders a week view, **When** the availability service is queried for that week, **Then** it returns a map `YYYY-MM-DD → EmployeeAvailability[]` for employees who are assigned to that institution.
- [ ] **Given** an employee has a working-hours template for a weekday, **When** that weekday is in the requested range, **Then** the employee appears with `start_time` and `end_time` set to the template's times.
- [ ] **Given** an employee has an active absence covering that date, **When** the range is queried, **Then** the employee appears with `absence_type`, `absence_start_date`, `absence_end_date` populated and `start_time`/`end_time` reflecting the absence (or a conventional marker value).
- [ ] **Given** a day has no configured working hours and no absence for an employee, **When** the range is queried, **Then** the employee does not appear on that day (sparse map).

### Per-employee availability check (dialog)

- [ ] **Given** the appointment dialog (institution mode or teamspace mode) needs to know whether a specific invitee is free at a chosen time window, **When** it calls the availability-check endpoint, **Then** the response reports whether `[start, end)` conflicts with: (a) the employee's working-hours template for that weekday, (b) any active absence covering the date, (c) any existing appointment the employee is a participant on that overlaps the window.
- [ ] **Given** the employee has no working-hours template configured (e.g. no institution assignment), **When** the check runs, **Then** the working-hours dimension reports "unknown" rather than "unavailable" — absence and appointment conflicts are still evaluated.
- [ ] **Given** the check is called for a `start >= end`, **When** the request arrives, **Then** the backend returns HTTP 400.

### Institution independence at the URL layer

The institution calendar may still consume the existing institution-scoped overlay endpoint (it is already inside an institution route). The teamspace calendar and any future cross-institution surface must be able to run the check without institution context.

- [ ] **Given** the caller is an authenticated employee with any number of institution assignments (zero, one, or many), **When** they call `GET /employees/me/availability/check?employeeId=<uuid>&start=<iso>&end=<iso>`, **Then** the backend resolves the target employee's context internally (working-hours + absences + participation list) without requiring an institution id in the URL.
- [ ] **Given** the target employee belongs to an institution the caller does not have access to, **When** the caller runs the availability check, **Then** the response reports availability at the **coarse** level needed for scheduling (busy/free boundaries and conflict flag) but does **not** leak sensitive scheduling details beyond what is needed to warn the caller (exact conflict titles are suppressed; only conflict count + busy time ranges are returned).

## UI States

| State                | When?                                                | What does the user see?                                                  | A11y notes      |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ | --------------- |
| Loading              | Initial fetch                                        | Spinner / skeleton overlay                                               | `role="status"` |
| Available            | No conflicts for the window                          | Green check / neutral (dialog)                                           | —               |
| Conflict detected    | Working-hours, absence, or overlap hit               | Warning chip with the conflict reason (absence / outside-hours / busy)   | `role="alert"`  |
| Unknown              | Target employee has no working-hours data            | Neutral "keine Arbeitszeiten hinterlegt" note; does **not** block saving | —               |
| Error                | Fetch failure                                        | Snackbar + continue (do not block saving on a lookup failure)            | `role="alert"`  |

## Non-Goals

- **Scheduling / auto-suggest free slots** — the availability read surface returns facts; picking a slot is a separate feature (see `teamspace-availability` for booking-windows, `calendar` for the weekly overlay).
- **Capacity planning across teams** — single-employee queries only for now. Group-availability and team-level planning are out of scope.
- **Editing working-hours or absences** — mutations live in the working-hours module (see `working-hours-self-service.controller.ts` + the institution admin surface).

## Edge Cases

- **Timezone:** all windows are interpreted in `Europe/Berlin` (tenant standard).
- **Cross-day windows:** a window that spans midnight is split internally into two day-local intervals before matching against working-hours templates.
- **Series appointments (virtual occurrences):** the check must also consider anchor appointments projected into the requested window, not only materialized rows — otherwise conflicts on recurring meetings are missed.
- **Employee without working-hours template:** reported as `workingHoursStatus: 'unknown'`. Treated as "can be invited" by the UI; the organizer gets an informational note, not a blocker.
- **Employee with overlapping appointment in another institution the caller cannot access:** the conflict flag is set; details (title, location, participants) are redacted.
- **Cancelled appointments:** do not count as conflicts.
- **Appointments where the employee has `response_status = 'no_show_with_notice'` or `'no_show_short_notice'`:** do not count as conflicts (they already declined).

## Permissions & Tenant/Institution

- **Institution-scoped overlay endpoint (existing):** `GET /institutions/:institutionId/working-hours/availability` — gated by institution access + working-hours view permission.
- **Self-scoped check endpoint (new):** `GET /employees/me/availability/check?employeeId=<uuid>&start=<iso>&end=<iso>` — authenticated employee only. Backend authorizes:
  - The caller may query **themselves** unconditionally.
  - The caller may query **another employee** only if there is a legitimate scheduling context: at least one shared teamspace, OR the caller has institution access to at least one of the target's institutions, OR the target is already a participant on an appointment the caller organizes. (Exact policy to be verified in implementation; a permissive default during development is OK, but production must tighten this to avoid a scheduling-metadata enumeration oracle.)
- **Field-level redaction** (cross-institution): conflict entries outside the caller's accessible institutions are returned with title/location stripped.

## Flows

```
Dialog collects invitees ──▶ for each invitee + time window
                                   │
                                   ▼
                GET /employees/me/availability/check
                 ?employeeId=…&start=…&end=…
                                   │
                                   ▼
              { workingHoursStatus: 'within' | 'outside' | 'unknown',
                absence: AbsencePeriod | null,
                conflicts: [{ appointmentId?, start, end, redacted: boolean }] }
                                   │
                                   ▼
                  UI renders availability chips per invitee
```

## i18n Keys

> User-facing strings stay in German. Key namespace: `availability.*`.

- `availability.status.within` — "verfügbar"
- `availability.status.outsideHours` — "außerhalb der Arbeitszeit"
- `availability.status.onAbsence` — "abwesend ({{absenceType}})"
- `availability.status.busy` — "belegt ({{count}} Termin(e))"
- `availability.status.unknown` — "keine Arbeitszeiten hinterlegt"
- `availability.error.lookupFailed` — "Verfügbarkeit konnte nicht geprüft werden."

## Offline Behavior

**Flutter-specific:**

- Availability results are **not** cached offline — they reflect live state and stale data would mislead scheduling.
- If offline, the dialog shows the "Unknown" state with a hint that conflict checks require a connection.

## References

- **Angular implementation:**
  - `apps/tagea-frontend/src/app/services/working-hours.service.ts` — `checkEmployeeAvailability`, `getWeeklyAvailability`
  - `apps/tagea-frontend/src/app/services/employee-availability.service.ts`
  - `apps/tagea-frontend/src/app/components/appointment-dialog-v2/appointment-dialog-v2.component.ts` — `checkEmployeesAvailability`
- **Backend endpoints:** see [contracts.md](./contracts.md)
- **Related features:**
  - [calendar](../calendar/spec.md) — weekly overlay consumer
  - [teamspace-calendar](../teamspace-calendar/spec.md) — per-invitee dialog check consumer
  - [appointment-detail](../appointment-detail/spec.md) — RSVP affects conflict set (declined invites do not count)
