# Contracts: Teamspace Calendar

## Services

| Service               | Methods relevant here                                              | Purpose                                    |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `AppointmentsService` | `getCalendarEvents(start, end, employeeId?, includeMyTeamspaces?)` | Range-scoped appointments for calendar     |
| `AppointmentsService` | `getAppointment(id)`                                               | Full appointment for dialog edit mode      |
| `AppointmentsService` | `getVirtualOccurrence(anchorId, occurrenceDate)`                   | Materialize virtual series occurrences     |
| `TeamspaceService`    | `hasAdminRole()`                                                   | Gate for availability-config FAB           |
| `UnifiedAuthService`  | `employee()` signal                                                | The "me" scope for `myAppointmentsOnly`    |
| `AuthorizationStore`  | `accessibleInstitutionIds()`                                       | Bootstrapping institution context on entry |

Exact method signatures live in the respective service files.

## Backend endpoint

```
GET /appointments/calendar?start=<iso>&end=<iso>&employee_id=<uuid>&include_my_teamspaces=true
```

Controller: `apps/tagea-backend/src/appointments/controllers/appointments.controller.ts` (`@Get('calendar')`).

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

- **Desktop click on event** → `AppointmentDialogV2Component` (inline dialog, keeps calendar context) via `openAppointmentDialog(id)`.
- **Mobile click on event** → `navigateToTermin(payload)` — routes differ by payload:
  - `payload.isEvent === true` → `/teamspace/events/:id`
  - virtual series occurrence → opens `SeriesActionDialogComponent` first, then edits
  - otherwise → opens `AppointmentDialogV2Component`
- **Invited staff (non-organizer) on a teamspace appointment** → `/teamspace/kalender/:id` (full detail page with RSVP).
- **Booker of a `booking_category_id` appointment** → `/teamspace/buchung/:id` (read-only booker view).

> **Flutter port note:** mirror the responsive split — use `showDialog` on tablet/desktop and push a full `MaterialPageRoute` on mobile. The shared appointment-detail widget (see [appointment-detail](../appointment-detail/spec.md)) renders in both surfaces.
