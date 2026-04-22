# Feature: Teamspace Calendar (Kalender)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-22 (institution-independence: participant-scoped endpoints under `employees/me/…`)

## Vision (Elevator Pitch)

Personal calendar for staff appointments — Outlook-style. Appointments are cross-cutting across the organization (any staff member can invite any other staff member). Visibility is strictly **participant-based**: you only see appointments where you are a participant. Teamspace membership is **not** a visibility grant — it is only a pre-fill helper in the creation dialog. Desktop uses FullCalendar with month/week/day views, a sidebar mini-calendar, and a toolbar. Mobile falls back to an infinite-scroll day list. Clicking an event opens the edit dialog (organizer only) or the detail route (all other participants).

## User Stories

- As a **staff member** I want to see appointments I am invited to as a calendar, so that I can understand my day/week/month at a glance.
- As a **staff member on mobile** I want an infinite-scroll day list, so that the calendar works naturally on a phone.
- As an **organizer** I want to create a new appointment from the calendar and optionally pre-fill participants by picking one or more teamspaces, so that I can invite a group quickly without manually adding every member.
- As an **organizer** I want to open appointments I created and edit them in the dialog, so that I can change time, location, participants, or notes.
- As an **invited staff member** I want to open a read-only detail view of an appointment I was invited to with Accept/Decline affordances, so that I can RSVP without accidentally editing the appointment.
- As a **staff member** I want to handle recurring series correctly, so that editing doesn't accidentally change the wrong occurrence.

## Acceptance Criteria

### Calendar shell (`/teamspace/kalender`)

- [ ] **Given** the viewport is desktop, **When** the page renders, **Then** FullCalendar displays month/week/day views with plugins `dayGrid`, `timeGrid`, `interaction`.
- [ ] **Given** the viewport is mobile, **When** `isMobile()` is true, **Then** the desktop calendar is replaced by `app-mobile-calendar` with `[myAppointmentsOnly]="true"` and infinite scroll.
- [ ] **Given** the user navigates months/weeks, **When** `DatesSetArg` fires, **Then** appointments for the visible range load via `AppointmentsService.getCalendarEvents(...)`.
- [ ] **Given** the user clicks an event (desktop) **and** is the organizer (has a participant entry with `role === 'organizer'` for this appointment), **When** the handler fires, **Then** `AppointmentDialogV2Component` opens in edit mode.
- [ ] **Given** the user clicks an event (desktop) **and** is not the organizer (any other participant, or not a participant at all), **When** the handler fires, **Then** the user is navigated to `/teamspace/kalender/:id` (the detail page) — the dialog does **not** open.
- [ ] **Given** the user clicks an event (mobile), **When** the handler fires, **Then** navigate to `/teamspace/kalender/:id`.
- [ ] **Given** the appointment has `booking_category_id` and the user is not a provider, **When** the click handler fires, **Then** navigate to `/teamspace/buchung/:id` (booker read-only view) — overrides the organizer rule above.
- [ ] **Given** the user presses "Neuer Termin", **When** action fires, **Then** navigate to `/teamspace/kalender/neu` (`TermineNeuComponent`).

### Visibility rule (backend-enforced)

Teamspace appointments are persisted with `institution_id IS NULL` and `teamspace_id IS NULL` — the teamspace dropdown is a transient pre-fill helper that leaves no trace on the persisted row (see "Creation dialog behavior" below). The cross-cutting nature is therefore expressed entirely through `AppointmentParticipant` rows; visibility follows participants, not institution or teamspace columns. The institution-scoped counterpart (`institution_id` set) is described in [calendar spec — Visibility rule](../calendar/spec.md).

- [ ] **Given** an appointment exists, **When** the calendar endpoint is called by the authenticated employee, **Then** the appointment is visible **only** if that employee has an `AppointmentParticipant` row (any role: `organizer`, `required`, `invited`, etc.).
- [ ] **Given** an employee is a member of a teamspace, **When** the backend decides visibility, **Then** teamspace membership alone does **not** grant visibility — a participant entry is required.
- [ ] **Given** an administrator or tenant admin has no participant entry on an appointment, **When** they load the calendar, **Then** they do **not** see that appointment (no special admin exemption in the calendar endpoint).
- [ ] **Given** the requesting employee is a participant on an appointment with `institution_id IS NOT NULL` (i.e. an institution appointment, not a teamspace one), **When** the teamspace calendar loads, **Then** that appointment is also visible here regardless of whether the employee has access to that institution — the participant filter applies uniformly, `institution_id` is not a read-time gate. Edit rights remain governed by institution guards on the institution-scoped mutation endpoints.

### Institution independence

The teamspace calendar is a personal surface — it must load for any authenticated employee, including employees without any institution assignment. All read endpoints used by this surface live under `employees/me/…` and do not take an `institution_id` in the path.

- [ ] **Given** the employee has zero institution assignments but is a member of at least one teamspace, or is a participant on at least one appointment, **When** `/teamspace/kalender` loads, **Then** the calendar renders without attempting to set an institution context and without throwing `"No institution context available"`.
- [ ] **Given** the page previously seeded the institution context via `AuthorizationStore.accessibleInstitutionIds()[0]` in `TerminePageComponent.ngOnInit`, **When** the new participant-scoped endpoints are in place, **Then** this bootstrap fallback is removed — the teamspace calendar no longer writes to `InstitutionContextService`.
- [ ] **Given** the calendar fetches events, **When** the request fires, **Then** it hits `GET /employees/me/appointments/calendar?start=<iso>&end=<iso>` — the legacy path `GET /institutions/:id/appointments/calendar?include_my_teamspaces=true` is **not** used from `/teamspace/kalender` (that path remains in place for the institution calendar — see [calendar spec](../calendar/spec.md)).

### Creation dialog behavior (`AppointmentDialogV2Component` in teamspace mode)

- [ ] **Given** the user opens the dialog in teamspace mode, **When** they pick a teamspace from the dropdown, **Then** the active members of that teamspace are appended to the participants list (existing selections are kept; duplicates are deduplicated).
- [ ] **Given** the user picks a second (different) teamspace, **When** the change fires, **Then** members of the second teamspace are appended to the participants list without removing members from the first — the dropdown acts as a cumulative pre-fill helper.
- [ ] **Given** the user saves a new appointment, **When** the payload is built, **Then** `teamspace_id` is **not** set on the appointment. The teamspace selection is a transient pre-fill helper and leaves no trace on the persisted appointment. (Exception: bookings, which follow a different creation flow and keep `teamspace_id` via `booking_category_id` semantics.)
- [ ] **Given** the dialog renders the staff participant list and a participant has `role === 'organizer'`, **When** their status badge is rendered, **Then** the label reads "Organisator" (not "Eingeladen") regardless of the underlying `response_status`. The organizer does not RSVP to themselves; the dialog must reflect that distinction.
- [ ] **Given** the dialog opens in teamspace mode (`isTeamspaceMode === true`), **When** the dialog renders, **Then** the appointment-template dropdown is **not** rendered and no `GET …/appointment-templates/active` request is issued. Templates are institution-scoped — they may be assigned to one or more institutions — and have no role in teamspace appointments.
- [ ] **Given** the dialog checks a prospective participant's availability for the chosen time window, **When** the check fires, **Then** it hits `GET /employees/me/availability/check?employeeId=<uuid>&start=<iso>&end=<iso>` (see [employee-availability spec](../employee-availability/spec.md)). The dialog must not require the caller's institution context.

### Recurring series

- [ ] **Given** an event belongs to a recurring series, **When** the user attempts to edit or delete, **Then** `SeriesActionDialogComponent` prompts for scope: `single` / `this_and_following` / `series` (plus `cancel`).
- [ ] **Given** the user picks a scope, **When** the action executes, **Then** the backend receives the series-scoped instruction and the calendar reloads.
- [ ] **Given** the occurrence is the first in the series (`occurrenceDate == anchorStartDate`), **When** the dialog renders, **Then** the `this_and_following` option is hidden (it would be equivalent to `series`).

### Detail (`/teamspace/kalender/:id`)

- [ ] **Given** a specific appointment id is opened on mobile, **When** the detail loads, **Then** `TermineDetailComponent` renders the appointment (reuses the shared `AppointmentDetailComponent` pattern in booker mode — verify exact wiring).
- [ ] **Given** a staff invitee RSVPs on `/teamspace/kalender/:id` (Accept or Decline), **When** the request fires, **Then** it hits `PATCH /employees/me/appointment-participants/:id` — the self-RSVP endpoint — **not** the institution-scoped `PATCH /institutions/:id/appointment-participants/:id`. The RSVP must work for employees without any institution assignment. See [appointment-detail spec — RSVP section](../appointment-detail/spec.md) for the full semantics.

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

- **Group calendar** (view colleagues' calendars) — only "my appointments" scope. Visibility is strictly participant-based; there is no team-wide or org-wide view.
- **External calendar sync** (iCal / Google) — not in scope.
- **Drag-and-drop rescheduling** — potential FullCalendar feature, but not currently wired.
- **Migration of pre-existing appointments** — appointments created under the previous (teamspace-membership-based) visibility model that have incomplete participant lists will lose visibility for non-participant teamspace members. No automated data migration is applied. If such an appointment needs to be visible to a colleague, the organizer must add them explicitly as a participant.

## Edge Cases

- **Timezone:** all times rendered in `Europe/Berlin` (tenant standard — see [appointment-detail spec](../appointment-detail/spec.md)).
- **Employee context:** `employeeId()` signal drives the scope (sourced from `UnifiedAuthService.employee()?.id`). If null/undefined, `loadAppointments` logs a warning and returns early; mobile calendar renders nothing rather than crashing.
- **Series action dialog result is `{ scope: 'cancel' }` or `undefined`** (user dismissed without picking) → the edit/delete is cancelled silently.
- **AuthorizationStore guard** — some actions may be gated by auth-store permissions; verify in implementation.
- **Organizer removed from own participant list:** if an organizer somehow ends up without a participant entry with `role === 'organizer'` on their own appointment, they lose dialog-edit access from the calendar. The appointment remains owned by the tenant; administrative recovery is out of scope of this feature.
- **Pre-existing appointments with `teamspace_id` set and incomplete participants:** per the Non-Goal above, these silently disappear from the calendars of non-participants. No warning, no migration.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_calendar.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Booker detail:** `/teamspace/buchung/:id` is the appointment-detail mode `booker` — see [appointment-detail spec](../appointment-detail/spec.md).

## Notifications (Push / In-App)

- Appointment reminders (`APPOINTMENT_REMINDER`) deep-link to detail routes, not to the calendar.
- Invitations (`APPOINTMENT_INVITATION`) deep-link to `/teamspace/kalender/:id` (the participant detail page). RSVP is handled on the detail page, **not** inside the notification. The notification center is strictly informational — clicking a notification marks it read and navigates to the deep-link; it never triggers a mutation.

### Acceptance Criteria (notifications)

- [ ] **Given** an `appointment_invitation` notification is rendered in the notification center, **When** the list renders, **Then** it shows title, body and relative time — but **no** Accept/Decline buttons.
- [ ] **Given** a user clicks an `appointment_invitation` notification item, **When** the click fires, **Then** the notification is marked as read and the user is navigated to `/teamspace/kalender/:id`.
- [ ] **Given** the backend creates an `appointment_invitation` for a staff participant, **When** the notification payload is built, **Then** the `route` field is `/teamspace/kalender/:id` (not `/staff/appointments/:id`).

## Staff Invitation Email

When a staff member is added as a participant to an appointment, they receive an email invitation. This email uses a **staff-specific template** — distinct from the client invitation template — because staff are internal users (they do not register for the client portal and do not see client-facing language).

### Acceptance Criteria (staff email)

- [ ] **Given** a participant with `participant_type === 'staff'` is added to an appointment, **When** the invitation email is generated, **Then** the template `appointment-invitation-staff.hbs` is used — not the client template.
- [ ] **Given** the staff invitation email is rendered, **When** the content is inspected, **Then** it does **not** contain: the client-portal registration call-to-action (`Portal-Zugang einrichten`), the "Sie können Ihre Termine auch jederzeit online einsehen" client copy, or any `portalRegistrationUrl` link.
- [ ] **Given** the staff invitation email is rendered, **When** the call-to-action is rendered, **Then** it deep-links to the participant detail page (`/teamspace/kalender/:id`) where Accept/Decline can happen.
- [ ] **Given** the recipient is a staff member, **When** the salutation renders, **Then** it uses the formal "Sie" form (consistent with internal tenant communication).
- [ ] **Given** an organizer is known for the appointment, **When** the email body is rendered, **Then** the organizer's name is included in the invitation sentence (e.g. "{{organizerName}} hat Sie zu einem Termin eingeladen.").
- [ ] **Given** a participant with `participant_type === 'client'` is added, **When** the invitation email is generated, **Then** the existing client template is used — the staff template must not leak into the client flow.

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
