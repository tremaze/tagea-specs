# Feature: Appointment Detail (Cross-Cutting)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

A detail view of an appointment for several user roles — staff (full edit), booker (teamspace booking), client (read-only + cancel) and invited staff participant (read-only + RSVP) — with mode-specific affordances. RSVP (Accept/Decline for an invited staff participant) lives on the **detail page**, not in the notification center: notifications are strictly informational.

## Modes

**The same detail surface is reached from multiple routes**, each wired via dependency injection and route data:

| Mode                   | Route                                                | Component                                                                           | Notes                                                                                            |
| ---------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `staff`                | `/einrichtung/:institutionId/staff/appointments/:id` | `AppointmentDetailComponent` → `AppointmentDetailStaffViewComponent`                | Full staff edit affordances. Uses `APPOINTMENT_DETAILS_SERVICE: AppointmentsService`.            |
| `booker`               | `/teamspace/buchung/:id`                             | `AppointmentDetailComponent` → `AppointmentDetailStaffViewComponent` (booker flavor) | Teamspace booking detail for the booker role.                                                   |
| `client`               | `/client-portal/termine/:id`                         | `AppointmentDetailComponent` → `AppointmentDetailClientViewComponent`               | Client self-serve view. Uses `APPOINTMENT_DETAILS_SERVICE: ClientAppointmentsService`.           |
| `termine-detail` (staff invitee) | `/teamspace/kalender/:id`                            | `TermineDetailComponent` (uses `AppointmentDetailClientViewComponent` for layout)  | Read-only detail for staff invited to a teamspace appointment; adds Accept/Decline RSVP buttons. |

The `AppointmentDetailComponent` route-driven modes read `route.data.mode` (`'staff' | 'booker' | 'client'`) and branch rendering between `AppointmentDetailStaffViewComponent` and `AppointmentDetailClientViewComponent`. The `termine-detail` mode is a separate component (`TermineDetailComponent`) that reuses the client view's layout and layers in participant RSVP logic; it is not a route-data branch.

## User Stories

### Staff

- As a **staff member** I want to open an appointment I booked, so that I can edit details, notes, participants, and financial support records.
- As a **staff member (organizer)** I want to cancel or reschedule, so that I can manage changes.
- As a **staff member (invited participant)** I want to RSVP (accept/decline), so that the organizer knows my availability.

### Booker (Teamspace)

- As a **teamspace staff member** I want to see appointment context for bookings I'm involved in, so that I can prepare.
- As an **invited staff participant** I want to RSVP directly from the detail, so that I don't need a separate UI.

### Client

- As a **client** I want to see my appointment details (time, location, staff, notes), so that I know what to expect.
- As a **client** I want to cancel an appointment I can no longer attend, so that I don't no-show.
- As a **client** I want to join a video session when the appointment time arrives, so that I can attend remotely.

## Acceptance Criteria

### All Modes

- [ ] **Given** the detail route loads, **When** the data fetch resolves, **Then** core fields render (title, date/time in `Europe/Berlin` timezone, location, organizer, participants).
- [ ] **Given** the appointment is cancelled, **When** the detail renders, **Then** a prominent "cancelled" banner + cancellation reason (if any) is shown, and most edit affordances are hidden.
- [ ] **Given** a managed-client context is passed via query param `?managedClientId=`, **When** the detail loads, **Then** the data is scoped to that managed client.
- [ ] **Given** the component reads `route.data.mode`, **When** the value is `'staff' | 'booker'`, **Then** render the staff view; **when** it is `'client'`, **Then** render the client view.

### Staff Mode

- [ ] **Given** the user is the organizer, **When** the detail renders, **Then** edit, cancel, and reschedule actions are available.
- [ ] **Given** the user is an invited participant (not organizer), **When** the detail renders, **Then** only RSVP (accept/decline) is available, and edit affordances are hidden (read-only view — see commit `78d19fd6a`).
- [ ] **Given** the appointment has custom fields configured by the tenant, **When** the detail renders, **Then** `TageaCustomFieldsComponent` renders them with current values.
- [ ] **Given** the institution has the `billing` feature, **When** financial support records exist, **Then** the staff view shows them with edit affordances.

### Client Mode

- [ ] **Given** the appointment is `scheduled` **or** `confirmed` and in the future, **When** the client views it, **Then** a "Cancel" action is visible. (Both statuses represent a bookable/active appointment in the client-facing shape — see [contracts.md](./contracts.md) for the full `ClientAppointment.status` union.)
- [ ] **Given** the client cancels, **When** they confirm in the dialog, **Then** the backend marks the appointment as cancelled, and the UI updates to the cancelled state.
- [ ] **Given** `is_video_meeting === true` and the `videoMeeting` tenant feature is enabled, **When** the current time is within the join window (15 min before start until 30 min after end), **Then** a "Join video" button is shown and invokes `VideoSessionService.startSession(appointmentId)`.

### Booker Mode

- [ ] **Given** the user has `teamspace_calendar.view`, **When** they access `/teamspace/buchung/:id`, **Then** the staff view renders with mode-specific UI (verify details against `AppointmentDetailStaffViewComponent`).

### RSVP (Staff Invited)

> RSVP (Accept / Decline) is surfaced on the **appointment detail page** (`TermineDetailComponent` at `/teamspace/kalender/:id`), **not** in the notification center. The notification center is strictly informational: clicking a notification marks it read and navigates to the detail page. RSVP persists by `PATCH /employees/me/appointment-participants/:id` with `{ response_status }` ('confirmed' | 'no_show_with_notice' | 'no_show_short_notice'). The endpoint is institution-independent: the backend validates that the participant row belongs to the authenticated employee, so the RSVP works for employees without any institution assignment (e.g. staff invited only via teamspace membership).

- [ ] **Given** the user is listed as a staff participant on a teamspace appointment, **When** the detail renders, **Then** their own participant entry is resolved via `participants.find(p => p.participant_employee_id === me && p.participant_type === 'staff')`.
- [ ] **Given** the resolved participant has `role !== 'organizer'` and the appointment is in the future, **When** the detail renders, **Then** Accept and Decline buttons are visible with the current `response_status` shown alongside.
- [ ] **Given** the user presses Accept, **When** the request fires, **Then** the backend patches `response_status` to `'confirmed'` and the UI refreshes the response state read-only.
- [ ] **Given** the user presses Decline, **When** the request fires, **Then** the backend patches `response_status` to `'no_show_with_notice'` (or `'no_show_short_notice'` depending on the time until start) and the UI refreshes the response state read-only.
- [ ] **Given** the appointment is in the past, **When** the detail renders, **Then** the Accept and Decline buttons are hidden (RSVP is no longer actionable).
- [ ] **Given** the user is the organizer (own participant entry has `role === 'organizer'`), **When** the detail renders, **Then** no Accept/Decline buttons are shown — the organizer label is displayed instead.
- [ ] **Given** the user receives an `appointment_invitation` notification, **When** they click the notification item, **Then** the notification is marked as read and the user is navigated to `/teamspace/kalender/:id` — there is no inline Accept/Decline inside the notification item itself.

## UI States

| State              | When?                                                                                                                                       | Rendering                                       | A11y notes                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------- |
| Loading            | Initial fetch                                                                                                                               | Full-page spinner                               | `role="status"`            |
| Loaded (active)    | `status` is `'scheduled'` or `'confirmed'` (client shape)                                                                                   | Normal detail layout                            | —                          |
| Loaded (cancelled) | `status ∈ { 'cancelled', 'cancelled_by_client', 'cancelled_by_counselor', 'partially_cancelled' }` (union spans both staff + client shapes) | "Cancelled" banner + reason + read-only content | Banner uses `role="alert"` |
| Saving             | Edit action in-flight                                                                                                                       | Progress bar + disabled form                    | —                          |
| RSVP changing      | Accept/decline request in-flight                                                                                                            | Buttons disabled with inline spinner            | `aria-busy`                |
| Error              | Fetch/save error                                                                                                                            | Snackbar + retry affordance                     | `role="alert"`             |

## Flows

### Mode resolution

```
route.data.mode ──┬── 'staff' / 'booker'  ──▶ AppointmentDetailStaffViewComponent
                  │
                  └── 'client'             ──▶ AppointmentDetailClientViewComponent
```

### Staff participant RSVP (via detail page)

```
appointment_invitation notification arrives
            │
            ▼
user clicks the notification item
            │
            ▼
notification marked as read; router navigates to /teamspace/kalender/:id
            │
            ▼
TermineDetailComponent renders with Accept / Decline buttons
(own participant resolved; canConfirm / canDecline derived from
 role ≠ 'organizer' and appointment not yet past)
            │
            ▼
user presses Accept / Decline
            │
            ▼
PATCH /employees/me/appointment-participants/:participantId
{ response_status: 'confirmed' | 'no_show_with_notice' | 'no_show_short_notice' }
(institution-independent — backend validates the participant row
 belongs to the authenticated employee)
            │
            ▼
response_status re-rendered read-only; notification center is informational only
```

## Non-Goals

- **Appointment creation** — covered by separate booking flows (staff calendar, `/client-portal/termine/buchen`).
- **Rescheduling UI** — may live in a separate component invoked from here; verify.

## Edge Cases

- **Timezone:** appointment times are rendered in `Europe/Berlin` (tenant-wide). Cross-reference recent commit `c3d6ab66c` that fixed a reminder timezone bug.
- **Recurring appointments:** not covered here (or covered by separate spec if applicable).
- **Guardian/managed-client:** `?managedClientId=` query param scopes data; without it, the calling user's own context is used.
- **Staff participants in cancelled appointments:** reminders are suppressed (see commit `860a00d1e`); RSVP UI should also hide.
- **Custom fields missing schema:** if the tenant added fields after the appointment was created, render the new fields as empty.

## Permissions & Tenant/Institution

| Mode   | Permission gate                                       | Provider                    |
| ------ | ----------------------------------------------------- | --------------------------- |
| staff  | `appointments.view` via `permissionGuard`             | `AppointmentsService`       |
| booker | `teamspace_calendar.view` via `tenantPermissionGuard` | `AppointmentsService`       |
| client | `clientPortalGuard`                                   | `ClientAppointmentsService` |

All modes rely on backend row-level checks (client can only see own/managed-client appointments; staff can only see within institution).

## Notifications (Push / In-App)

- `APPOINTMENT_INVITATION`, `APPOINTMENT_REMINDER`, cancellation notifications all deep-link to an appropriate detail route (for a staff participant: `/teamspace/kalender/:id`).
- Notifications are strictly informational: there are no inline mutation affordances (Accept/Decline buttons) inside notification items. RSVP happens on the detail page.
- A notification is marked as read when the user clicks it; dismissal happens automatically on read/navigation.
- Cancellations trigger notifications to participants (covered by the reminder/dispatcher spec).

## i18n Keys

> User-facing strings remain in German.

Owned by component templates + child view components. Full list should be compiled during the port.

## Offline Behavior

**Flutter-specific:**

- Read-only view offline (cached detail).
- Cancel / RSVP / edit actions require online.
- Video-join requires online + WebRTC capability.

## References

- **Angular implementation (staff / booker / client):** [`apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts)
- **Termine-Detail (staff invitee on teamspace appointments):** [`apps/tagea-frontend/src/app/pages/teamspace/termine-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-detail.component.ts)
- **Staff view:** `AppointmentDetailStaffViewComponent`
- **Client view:** `AppointmentDetailClientViewComponent`
- **Services:**
  - `APPOINTMENT_DETAILS_SERVICE` interface — injected `AppointmentsService` or `ClientAppointmentsService`
  - `AppointmentParticipantsService` — participant CRUD. `manageAppointmentParticipants` runs during staff save (institution-scoped). RSVP uses `selfRsvp(participantId, { response_status })` which hits the institution-independent `PATCH /employees/me/appointment-participants/:id`.
  - `AppointmentTimeService`, `AppointmentFormService`, `CustomFieldsService`, `FinancialSupportService`
  - `VideoSessionService` — `startSession(appointmentId)` opens the pre-join dialog and shows the floating video widget
- **Related commits of interest:**
  - `c3d6ab66c` — timezone fix for reminders (`Europe/Berlin`)
  - `78d19fd6a` — non-organizer read-only view
  - `2c8e4540c` — staff-RSVP feature complete
  - `860a00d1e` — reminder suppression for cancelled staff participants
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
