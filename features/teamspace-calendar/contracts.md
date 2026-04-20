# Contracts: Teamspace Calendar

## Services

| Service               | Methods relevant here                                                  | Purpose                                       |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `AppointmentsService` | `getForRange(startIso, endIso, { employeeId? })` (or similar — verify) | Range-scoped appointments for calendar        |
| `TeamspaceService`    | `getMyTeamspaces()`                                                    | Teamspace scoping (if applied)                |
| `UnifiedAuthService`  | `currentEmployeeId`                                                    | The "me" scope for myAppointmentsOnly         |
| `AuthorizationStore`  | permission flags                                                       | Action gating (edit/delete/series operations) |

Exact method signatures live in the respective service files.

## FullCalendar Options

The desktop calendar uses `CalendarOptions` from `@fullcalendar/core` with:

- Plugins: `dayGridPlugin`, `timeGridPlugin`, `interactionPlugin`
- Views: month (`dayGridMonth`), week (`timeGridWeek`), day (`timeGridDay`)
- Events are mapped from `Appointment[]` → `EventInput[]` (implementation detail; verify mapper)
- `DatesSetArg` callback triggers range-based fetch

## Data Models

```ts
// apps/tagea-frontend/src/app/models/appointments.model.ts
interface CalendarEvent {
  id: string;
  start: string; // ISO
  end?: string; // ISO
  title: string;
  // + metadata mapped to FullCalendar EventInput
}

interface CalendarEventClickPayload {
  id: string;
  // + context data for dialogs/routing
}
```

## Series Action Dialog

```ts
// apps/tagea-frontend/src/app/components/series-action-dialog/series-action-dialog.component.ts
interface SeriesActionDialogData {
  appointmentId: string;
  anchorId?: string;
  action: 'edit' | 'delete' | /* other */;
}

type SeriesActionResult =
  | { scope: 'this' }
  | { scope: 'thisAndFollowing' }
  | { scope: 'all' }
  | null;  // dismissed
```

## Dialog vs. Route navigation

- **Desktop click on event** → `AppointmentDialogV2Component` (inline dialog, keeps calendar context)
- **Mobile click on event** → `navigateToTermin($event)` → `/teamspace/kalender/:id` (full page)

> **Flutter port note:** mirror the responsive split — use `showDialog` on tablet/desktop and push a full `MaterialPageRoute` on mobile. The shared appointment-detail widget (see [appointment-detail](../appointment-detail/spec.md)) renders in both surfaces.
