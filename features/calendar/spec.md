# Feature: Institution Calendar

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

Institution-scoped working calendar at `/einrichtung/:institutionId/calendar`. Shows all appointments that belong to **this institution** — client-bound appointments as well as purely internal staff appointments (1:1, small groups). Visibility is **institution-scoped**, not participant-scoped: every staff member with `appointments.view` sees the institution's calendar (subject to department-level access control on client data). Teamspace appointments belong to the cross-cutting personal/Outlook calendar in [teamspace-calendar](../teamspace-calendar/spec.md) and are deliberately **not** shown here. FullCalendar (desktop) / mobile calendar (mobile), with per-employee colors, working-hours overlays, public-holiday markers, Outlook sync, and the same series-action dialog as [teamspace-calendar](../teamspace-calendar/spec.md) for recurring appointments.

## User Stories

- As a **staff member** I want to see all of my institution's appointments — including colleagues' internal ones — so that I can coordinate scheduling at the institution level.
- As a **staff member** I want working hours and public holidays overlaid, so that I don't book into empty slots or holidays.
- As a **staff member** I want Outlook sync, so that my calendar stays consistent with my external calendar.

## Acceptance Criteria

### Visibility rule (backend-enforced)

The institution calendar and the [teamspace calendar](../teamspace-calendar/spec.md) share the same backend endpoint (`GET /institutions/:id/appointments/calendar`) but use **disjoint visibility semantics** keyed off the appointment's `institution_id` column:

- **Institution appointment** — created from any non-teamspace flow → `institution_id = <institution>`, `teamspace_id IS NULL`.
- **Teamspace appointment** — created from the teamspace calendar/booking flow → `institution_id IS NULL`, `teamspace_id IS NULL` on the persisted row (the teamspace dropdown is a transient pre-fill helper; see [teamspace-calendar spec](../teamspace-calendar/spec.md)). Visibility flows exclusively through `AppointmentParticipant` rows.

Resolution policy at write time lives in `appointments.service.ts → resolveInstitutionIdForNewAppointment`.

- [ ] **Given** the calendar endpoint is called **without** an `employee_id` query param (institution-mode), **When** the SQL filter is built, **Then** only rows with `appointment.institution_id = :currentInstitutionId` are returned. The legacy `OR appointment.institution_id IS NULL` branch must **not** be applied here — that would surface other employees' teamspace appointments in the institution view.
- [ ] **Given** an appointment has only staff participants and no client/case (a purely internal 1:1 or small-group meeting), **When** it carries the institution's `institution_id`, **Then** it is visible in the institution calendar to every staff member with `appointments.view` (subject to the department/client access-control CASE statements that already redact title/description for unauthorised viewers).
- [ ] **Given** an appointment has `institution_id IS NULL` (i.e. a teamspace appointment), **When** the institution calendar loads, **Then** it is **not** returned, regardless of whether the requesting user is a participant. Participants see it in the teamspace calendar.
- [ ] **Given** the calendar endpoint is called **with** an `employee_id` query param (teamspace/personal mode), **When** the SQL filter is built, **Then** the participant-based visibility rule from the [teamspace-calendar spec](../teamspace-calendar/spec.md) applies and `OR institution_id IS NULL` may remain so teamspace appointments are reachable.

### Calendar shell

- [ ] **Given** the user opens `/calendar`, **When** FullCalendar initializes, **Then** month/week/day/list views are available (plugins: `dayGrid`, `timeGrid`, `interaction`, `list`).
- [ ] **Given** `PersonalPreferences.calendar_default_view` is set, **When** the page loads, **Then** the saved view type (e.g. `timeGridWeek`) is applied.
- [ ] **Given** the viewport is mobile, **When** detected by `BreakpointObserver`, **Then** the FullCalendar grid is replaced by `MobileCalendarComponent`.

### Events + colors

- [ ] **Given** appointments resolve, **When** events render, **Then** each event's color is derived from the assigned employee via `getEmployeeColor()`.
- [ ] **Given** working hours are loaded, **When** they render, **Then** weekly availability / unavailability is overlaid as background events (`EmployeeAvailability` / `WeeklyAvailabilityResponse`).
- [ ] **Given** public holidays for the tenant's region resolve, **When** they render, **Then** holiday dates are overlaid as all-day background events.

### Drag-drop / resize

- [ ] **Given** the user drags an event to a new time (`EventDropArg`), **When** dropped, **Then** the appointment is rescheduled via `AppointmentsService.updateAppointment(...)`; series appointments prompt `SeriesActionDialogComponent`.
- [ ] **Given** an event is resized (`EventResizeDoneArg`), **When** resize fires, **Then** duration updates accordingly (series handling identical).

### Click behavior

- [ ] **Given** an event is clicked, **When** the handler fires, **Then** either the appointment dialog opens or navigation to detail runs (verify exact branching in `CalendarEventService`).

### Outlook sync

- [ ] **Given** `OutlookSyncService` is enabled for the tenant, **When** the user triggers sync, **Then** appointments flow between the institution calendar and the user's Outlook.

### Filters + tooltips

- [ ] **Given** the filters FAB fires, **When** the sheet opens, **Then** `CalendarFiltersBottomSheetComponent` exposes employee filters + category filters.
- [ ] **Given** the user hovers an event, **When** the tooltip delay elapses, **Then** `CalendarEventTooltipService` shows event details.
- [ ] **Given** the user hovers an employee column, **When** the tooltip fires, **Then** `EmployeeAvailabilityTooltipService` shows that employee's availability.

## UI States

| State     | When?         | Rendering                                 |
| --------- | ------------- | ----------------------------------------- |
| Loading   | Initial fetch | Spinner overlay on calendar               |
| Populated | Events loaded | Grid + sidebar/toolbar                    |
| Mobile    | `isMobile`    | `MobileCalendarComponent` instead of grid |
| Error     | Fetch failure | Snackbar + retry                          |

## Non-Goals

- **Cross-institution calendar** — scoped to the single institution in the URL.
- **Teamspace appointments** — not surfaced here. They live in [teamspace-calendar](../teamspace-calendar/spec.md) under participant-based (Outlook) semantics.
- **Recurring-series bulk editor** — series edits happen per-occurrence / per-anchor via `SeriesActionDialogComponent`.

## Edge Cases

- **Virtual series occurrences** — `VirtualOccurrenceResponse` (`isVirtual`, `appointment`, `anchorId`, `occurrenceDate`) represents non-materialized occurrences generated from an RRULE; UI renders them distinctly from materialized appointments and materializes on edit via the backend `/occurrences/:date/materialize` endpoint.
- **Timezone:** `Europe/Berlin` (tenant-wide — same as [teamspace-calendar](../teamspace-calendar/spec.md)).
- **Client / Employee cache** — `ClientCacheService`, `EmployeeCacheService` keep these in-memory to avoid re-fetching for tooltip rendering.
- **Outlook sync conflicts** — verify `OutlookSyncService` conflict-resolution semantics (last-write-wins? prompt?).

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'appointments.view'`.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Appointment invitations / reminders deep-link to detail routes, not the calendar.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific (if ported):**

- P2 / non-goal for Flutter. Documentation only.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/calendar-page/calendar-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/calendar-page/calendar-page.component.ts)
- **FullCalendar:** `@fullcalendar/angular` with `dayGrid`, `timeGrid`, `interaction`, `list` plugins
- **Services:** `AppointmentsService`, `CalendarConfigService`, `CalendarEventService`, `CalendarEventTooltipService`, `CalendarDataService`, `PublicHolidaysService`, `WorkingHoursService`, `OutlookSyncService`, `InstitutionsHttpService`, `ClientCacheService`, `EmployeeCacheService`, `EmployeeAvailabilityTooltipService`
- **Dialogs:** `SeriesActionDialogComponent`
- **Sub-components:** `CalendarToolbarComponent`, `CalendarSidebarComponent`, `MobileCalendarComponent`
- **Models:** `Appointment`, `CalendarEvent`, `CalendarEventClickPayload`, `VirtualOccurrenceResponse`, `PersonalPreferences`, `CalendarViewType`, `EmployeeAvailability`, `WeeklyAvailabilityResponse`
- **Utilities:** `getEmployeeColor`
- **E2E tests:** [`apps/tagea-frontend-e2e/src/tests/calendar-agenda-view.spec.ts`](../../../apps/tagea-frontend-e2e/src/tests/calendar-agenda-view.spec.ts)
- **Backend endpoints:** see [contracts.md](./contracts.md)
