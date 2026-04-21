# Feature: Teamspace Calendar (Kalender)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Personal calendar for staff appointments. Desktop uses FullCalendar with month/week/day views, a sidebar mini-calendar, and a toolbar (navigation + view switch). Mobile falls back to an infinite-scroll day list. Clicking an event opens the appointment dialog or the detail route; "new" routes into a dedicated booking flow.

## User Stories

- As a **staff member** I want to see my appointments as a calendar, so that I can understand my day/week/month at a glance.
- As a **staff member on mobile** I want an infinite-scroll day list, so that the calendar works naturally on a phone.
- As a **staff member** I want to create a new appointment from the calendar, so that I can add meetings without leaving the view.
- As a **staff member** I want to handle recurring series correctly, so that editing doesn't accidentally change the wrong occurrence.

## Acceptance Criteria

### Calendar shell (`/teamspace/kalender`)

- [ ] **Given** the viewport is desktop, **When** the page renders, **Then** FullCalendar displays month/week/day views with plugins `dayGrid`, `timeGrid`, `interaction`.
- [ ] **Given** the viewport is mobile, **When** `isMobile()` is true, **Then** the desktop calendar is replaced by `app-mobile-calendar` with `[myAppointmentsOnly]="true"` and infinite scroll.
- [ ] **Given** the user navigates months/weeks, **When** `DatesSetArg` fires, **Then** appointments for the visible range load via `AppointmentsService.getCalendarEvents(start, end, employeeId, true)`.
- [ ] **Given** the user clicks an event (desktop), **When** the handler fires, **Then** `AppointmentDialogV2Component` opens with edit/RSVP affordances.
- [ ] **Given** the user clicks an event (mobile), **When** the handler fires, **Then** navigate to `/teamspace/kalender/:id`.
- [ ] **Given** the user presses "Neuer Termin", **When** action fires, **Then** navigate to `/teamspace/kalender/neu` (`TermineNeuComponent`).

### Recurring series

- [ ] **Given** an event belongs to a recurring series, **When** the user attempts to edit or delete, **Then** `SeriesActionDialogComponent` prompts for scope: `single` / `this_and_following` / `series` (plus `cancel`).
- [ ] **Given** the user picks a scope, **When** the action executes, **Then** the backend receives the series-scoped instruction and the calendar reloads.
- [ ] **Given** the occurrence is the first in the series (`occurrenceDate == anchorStartDate`), **When** the dialog renders, **Then** the `this_and_following` option is hidden (it would be equivalent to `series`).

### Detail (`/teamspace/kalender/:id`)

- [ ] **Given** a specific appointment id is opened on mobile, **When** the detail loads, **Then** `TermineDetailComponent` renders the appointment (reuses the shared `AppointmentDetailComponent` pattern in booker mode — verify exact wiring).

### New booking (`/teamspace/kalender/neu`)

- [ ] **Given** the user enters the new-appointment flow, **When** the page loads, **Then** `TermineNeuComponent` renders the multi-step booking form (category → slot → details).

## UI States

| State               | When?                    | What does the user see?  | A11y notes      |
| ------------------- | ------------------------ | ------------------------ | --------------- |
| Loading             | Initial fetch            | Spinner                  | `role="status"` |
| Populated (desktop) | FullCalendar ready       | Toolbar + sidebar + grid | —               |
| Populated (mobile)  | Mobile calendar ready    | Infinite-scroll day list | —               |
| Empty               | No appointments in range | Empty slot rendering     | —               |
| Error               | Fetch failure            | Snackbar or error panel  | `role="alert"`  |

## Non-Goals

- **Group calendar** (view colleagues' calendars) — only "my appointments" scope (`myAppointmentsOnly: true`).
- **External calendar sync** (iCal / Google) — not in scope.
- **Drag-and-drop rescheduling** — potential FullCalendar feature, but not currently wired.

## Edge Cases

- **Timezone:** all times rendered in `Europe/Berlin` (tenant standard — see [appointment-detail spec](../appointment-detail/spec.md)).
- **Employee context:** `employeeId()` signal drives the scope (sourced from `UnifiedAuthService.employee()?.id`). If null/undefined, `loadAppointments` logs a warning and returns early; mobile calendar renders nothing rather than crashing.
- **Series action dialog result is `{ scope: 'cancel' }` or `undefined`** (user dismissed without picking) → the edit/delete is cancelled silently.
- **AuthorizationStore guard** — some actions may be gated by auth-store permissions; verify in implementation.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_calendar.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Booker detail:** `/teamspace/buchung/:id` is the appointment-detail mode `booker` — see [appointment-detail spec](../appointment-detail/spec.md).

## Notifications (Push / In-App)

- Appointment reminders (`APPOINTMENT_REMINDER`) deep-link to detail routes, not to the calendar.
- Invitations (`APPOINTMENT_INVITATION`) deep-link to detail with RSVP surfaced.

## i18n Keys

> User-facing strings remain in German. Owned by the external template.

## Offline Behavior

**Flutter-specific:**

- Cached range visible offline; range changes require online to fetch unseen periods.
- New-booking flow requires online (slot availability check).

## References

- **Angular implementation (desktop + mobile switch):** [`apps/tagea-frontend/src/app/pages/teamspace/termine-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-page.component.ts)
- **New booking:** [`termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts)
- **Detail:** [`termine-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-detail.component.ts)
- **FullCalendar:** `@fullcalendar/angular` + `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`
- **Services:** `AppointmentsService` (`getCalendarEvents`, `getAppointment`, `getVirtualOccurrence`), `TeamspaceService` (`hasAdminRole`), `AuthorizationStore` (`accessibleInstitutionIds`), `UnifiedAuthService` (`employee()` signal)
- **Dialogs:** `AppointmentDialogV2Component`, `SeriesActionDialogComponent`
- **Sub-components:** `CalendarToolbarComponent`, `TermineSidebarComponent`, `MobileCalendarComponent`
- **Model:** `Appointment`, `CalendarEvent`, `CalendarEventClickPayload`
- **Cross-cutting detail:** see [appointment-detail spec](../appointment-detail/spec.md) (booker mode)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
