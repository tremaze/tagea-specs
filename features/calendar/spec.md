# Feature: Institution Calendar

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Full institution-scoped calendar at `/einrichtung/:institutionId/calendar`. FullCalendar (desktop) / mobile calendar (mobile), with per-employee colors, working-hours overlays, public-holiday markers, Outlook sync, and the same series-action dialog as [teamspace-calendar](../teamspace-calendar/spec.md) for recurring appointments.

## User Stories

- As a **staff member** I want to see all institution appointments and my colleagues' availability, so that I can schedule effectively.
- As a **staff member** I want working hours and public holidays overlaid, so that I don't book into empty slots or holidays.
- As a **staff member** I want Outlook sync, so that my calendar stays consistent with my external calendar.

## Acceptance Criteria

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
