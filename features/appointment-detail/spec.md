# Feature: Appointment Detail (Cross-Cutting)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

A single component that renders the detail view of an appointment for three user roles — staff, booker (teamspace participant), and client — with mode-specific affordances. Staff see full editing, client sees read-only + RSVP/cancellation, booker sees the teamspace-flavored view.

## Modes

**The same route component is mounted three times** via dependency injection:

| Mode     | Route                                                | DI provider                                                                               |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `staff`  | `/einrichtung/:institutionId/staff/appointments/:id` | `APPOINTMENT_DETAILS_SERVICE: AppointmentsService`                                        |
| `booker` | `/teamspace/buchung/:id`                             | `APPOINTMENT_DETAILS_SERVICE: AppointmentsService` (data scoped by teamspace permissions) |
| `client` | `/client-portal/termine/:id`                         | `APPOINTMENT_DETAILS_SERVICE: ClientAppointmentsService`                                  |

The component reads `route.data.mode` (`'staff' | 'booker' | 'client'`) and branches rendering between `AppointmentDetailStaffViewComponent` and `AppointmentDetailClientViewComponent`.

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
- [ ] **Given** the appointment has a video session configured, **When** the start time is within join window, **Then** a "Join video" button is shown (uses `VideoSessionService`).

### Booker Mode

- [ ] **Given** the user has `teamspace_calendar.view`, **When** they access `/teamspace/buchung/:id`, **Then** the staff view renders with mode-specific UI (verify details against `AppointmentDetailStaffViewComponent`).

### RSVP (Staff Invited)

- [ ] **Given** the user is listed as a staff participant with `invited` status, **When** they click "Accept" / "Decline", **Then** `AppointmentParticipantsService` persists the RSVP, and the UI updates in place.
- [ ] **Given** the user is an RSVP'd participant, **When** they open the detail again, **Then** their current RSVP status is shown and can be changed.

## UI States

| State              | When?                            | Rendering                                       | A11y notes                 |
| ------------------ | -------------------------------- | ----------------------------------------------- | -------------------------- |
| Loading            | Initial fetch                    | Full-page spinner                               | `role="status"`            |
| Loaded (active)    | `status === 'scheduled'`         | Normal detail layout                            | —                          |
| Loaded (cancelled) | `status === 'cancelled'`         | "Cancelled" banner + reason + read-only content | Banner uses `role="alert"` |
| Saving             | Edit action in-flight            | Progress bar + disabled form                    | —                          |
| RSVP changing      | Accept/decline request in-flight | Buttons disabled with inline spinner            | `aria-busy`                |
| Error              | Fetch/save error                 | Snackbar + retry affordance                     | `role="alert"`             |

## Flows

### Mode resolution

```
route.data.mode ──┬── 'staff' / 'booker'  ──▶ AppointmentDetailStaffViewComponent
                  │
                  └── 'client'             ──▶ AppointmentDetailClientViewComponent
```

### Staff participant RSVP

```
Open detail
    │
    ▼
isStaffInvited?  ── yes ──▶ show Accept / Decline buttons
    │                           │
    │                           ▼
    │                     user clicks
    │                           │
    │                           ▼
    │                     appointmentParticipantsService.respondToInvitation()
    │                           │
    │                           ▼
    │                     UI reflects new status
    │
    └── no ──▶ normal staff view
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

- `APPOINTMENT_INVITATION`, `APPOINTMENT_REMINDER`, cancellation notifications all deep-link here.
- RSVP actions update invitation-notification dismissal state (see commit `ee93f8f49`).
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

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts)
- **Staff view:** `AppointmentDetailStaffViewComponent`
- **Client view:** `AppointmentDetailClientViewComponent`
- **Services:**
  - `APPOINTMENT_DETAILS_SERVICE` interface — injected `AppointmentsService` or `ClientAppointmentsService`
  - `AppointmentParticipantsService` — RSVP
  - `AppointmentTimeService`, `AppointmentFormService`, `CustomFieldsService`, `FinancialSupportService`
  - `VideoSessionService` — join video
- **Related commits of interest:**
  - `c3d6ab66c` — timezone fix for reminders (`Europe/Berlin`)
  - `78d19fd6a` — non-organizer read-only view
  - `2c8e4540c` — staff-RSVP feature complete
  - `860a00d1e` — reminder suppression for cancelled staff participants
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
