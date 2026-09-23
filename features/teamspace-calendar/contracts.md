# Contracts: Teamspace Calendar

## Services

| Service               | Methods relevant here                                              | Purpose                                    |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `AppointmentsService` | `getTenantCalendarEvents(start, end)` | Range-scoped appointments for calendar. Hits `GET /appointments/calendar`. No `employeeId` param — the endpoint is self-scoped. |
| `AppointmentsService` | `getAppointment(id)`                                               | Full appointment for dialog edit mode. Already has an institution-less fallback to `GET /appointments/:id`. |
| `AppointmentsService` | `getVirtualOccurrence(anchorId, occurrenceDate)`                   | Materialize virtual series occurrences     |
| `AppointmentParticipantsService` | `updateParticipant(...)` | Self-RSVP for staff invitees. Route depends on the appointment scope (see endpoints below). |
| `WorkingHoursService` | `checkEmployeeAvailability(employeeId, start, end)` | Availability check for dialog conflict warnings. Hits `GET /employees/me/availability/check`. |
| `TeamspaceService`    | `hasAdminRole()`                                                   | Gate for availability-config FAB           |
| `UnifiedAuthService`  | `employee()` signal                                                | The "me" scope used in UI state (not sent to the backend — server resolves the caller). |

Exact method signatures live in the respective service files.

## Backend endpoints

The calendar read and RSVP paths below are **institution-independent** — the teamspace calendar surface must not depend on an `institution_id` in the URL. Visibility is participant-based; mutation rights for institution-scoped appointments remain gated by the institution mutation endpoints (which are **not** called from the teamspace calendar).

| Method + Path | Purpose | Controller |
| ------------- | ------- | ---------- |
| `GET /appointments/calendar?start=<iso>&end=<iso>` | Range-scoped calendar events for the authenticated employee (bare JSON array). Participant-based filter (staff participant row). Includes teamspace appointments (`institution_id IS NULL`), institution appointments where the employee is participant, virtual series occurrences (`id = virtual_<anchorId>_<YYYY-MM-DD>`, `is_virtual_series`, `anchor_appointment_id`) and booked events (`template_name = 'Veranstaltung'`). Cancelled appointments are included. | `tenant-appointments.controller.ts` |
| `GET /appointments/:id` | Detail incl. `participants`, `teamspace_id`, `institution_id`, `booking_category_id`, `recurrence_rule`. Accepts a uuid or `virtual_<anchorId>_<date>`. | `tenant-appointments.controller.ts` |
| `GET /appointments/:anchorId/occurrences/:dateIso` | Virtual/materialized occurrence detail: `{ isVirtual, appointment, anchorId, occurrenceDate }`. | `tenant-appointments.controller.ts` |
| `PATCH /appointment-participants/:id` | Self-RSVP on tenant-level appointments (`teamspace_id` and `institution_id` null): body `{ response_status }` only. | `tenant-appointment-participants.controller.ts` |
| `PATCH /teamspaces/:teamspaceId/appointment-participants/:id` | Self-RSVP on teamspace appointments (`teamspace_id` set). | `teamspace-appointment-participants.controller.ts` |
| `POST /teamspaces/:teamspaceId/appointment-participants/occurrence-response` | Answer a single occurrence of a teamspace series: `{ anchorId, occurrenceDate, action: 'confirm' \| 'decline' }`. Only available for teamspace series; tenant-level series are answered for the whole series. | `teamspace-appointment-participants.controller.ts` |
| `GET /employees/me/availability/check?employeeId=<uuid>&start=<iso>&end=<iso>` | Per-employee availability check used by the appointment dialog to warn about conflicts. Documented in [employee-availability spec](../employee-availability/spec.md). | `working-hours-self-service.controller.ts` |

**Visibility rule (authoritative):** an appointment is returned by `GET /appointments/calendar` only if the requesting employee has an `AppointmentParticipant` row on it. `institution_id` is not a read-time gate. Teamspace membership alone does not grant visibility — a participant entry is required.

**Deprecated for teamspace calendar:** the legacy `GET /institutions/:institutionId/appointments/calendar?include_my_teamspaces=true` is no longer called from `/teamspace/kalender`. It stays in place for the institution calendar (`/calendar-page` — see [calendar contracts](../calendar/contracts.md)). The `include_my_teamspaces` query param is dropped from the new path — participant-based visibility makes it redundant.

## FullCalendar Options

The desktop calendar uses `CalendarOptions` from `@fullcalendar/core` with:

- Plugins: `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`
- Views: month (`dayGridMonth`), week (`timeGridWeek`), work-week (`timeGridWorkWeek`), day (`timeGridDay`)
- Events are mapped from `CalendarEvent[]` → `EventInput[]` (see `mapToCalendarEvent` in `termine-page.component.ts`)
- `DatesSetArg` callback (`handleDatesSet`) triggers range-based fetch via `loadAppointments(start, end)`

## Data Models

```ts
// apps/tagea-frontend/src/app/models/appointments.model.ts
interface CalendarEvent {
  id: string;
  title: string;
  start_datetime: Date;
  end_datetime: Date;
  status: string;
  location?: string;
  description?: string;
  template_name?: string;
  is_all_day?: boolean;
  is_teamspace_appointment?: boolean;
  has_full_access?: boolean;
  is_virtual_series?: boolean;
  anchor_appointment_id?: string;
}

interface CalendarEventClickPayload {
  id: string;
  isEvent: boolean;
  isVirtualSeries?: boolean;
  anchorAppointmentId?: string;
  occurrenceDate?: Date;
  anchorStartDatetime?: Date | string;
}
```

## Series Action Dialog

```ts
// apps/tagea-frontend/src/app/components/series-action-dialog/series-action-dialog.component.ts
interface SeriesActionDialogData {
  anchorId: string;
  occurrenceDate: Date;
  anchorStartDate?: Date;
  title: string;
  action: 'edit' | 'delete' | 'status';
}

type SeriesActionResult = { scope: 'single' } | { scope: 'this_and_following' } | { scope: 'series' } | { scope: 'cancel' };
```

Caller treats `{ scope: 'cancel' }` (and an `undefined` afterClosed payload) as "dismissed — do nothing".

## Dialog vs. Route navigation

The click-handler on a calendar event resolves the target in this order:

1. **`booking_category_id` set and user is not a provider** → `/teamspace/buchung/:id` (booker read-only view).
2. **User is the organizer** (has an `AppointmentParticipant` row with `role === 'organizer'` for this appointment) → `AppointmentDialogV2Component` opens in edit mode.
3. **Otherwise** (any other participant, or not a participant — which in practice does not occur, since non-participants cannot see the appointment) → `/teamspace/kalender/:id` (detail page with RSVP affordances).

On **mobile**, step 2 is also routed to `/teamspace/kalender/:id` instead of opening a dialog (organizers get the read-only detail; editing happens on desktop).

Virtual series occurrences intercept step 2: `SeriesActionDialogComponent` opens first to resolve the scope (single / this-and-following / series), then the resulting flow continues as above.

> **Flutter port note:** mirror the responsive split — use `showDialog` on tablet/desktop and push a full `MaterialPageRoute` on mobile. The shared appointment-detail widget (see [appointment-detail](../appointment-detail/spec.md)) renders in both surfaces.
