# Contracts: Institution Calendar

> **Scope:** this contract covers the institution calendar at `/calendar-page`. The teamspace calendar at `/teamspace/kalender` uses participant-scoped counterparts under `employees/me/…` — see [teamspace-calendar/contracts.md](../teamspace-calendar/contracts.md). Availability queries shared by both surfaces are documented in [employee-availability/contracts.md](../employee-availability/contracts.md).

## Services

| Service                                      | Role                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `AppointmentsService`                        | CRUD + list for appointments                                            |
| `CalendarConfigService`                      | Per-user calendar preferences (stored server-side)                      |
| `CalendarEventService`                       | Maps `Appointment` → FullCalendar `EventInput`; handles click branching |
| `CalendarDataService`                        | Batched loader for visible range                                        |
| `CalendarEventTooltipService`                | Builds tooltip content for events                                       |
| `EmployeeAvailabilityTooltipService`         | Builds tooltip content for availability columns                         |
| `PublicHolidaysService`                      | Holiday calendar for tenant region                                      |
| `WorkingHoursService`                        | `EmployeeAvailability` + `WeeklyAvailabilityResponse`                   |
| `OutlookSyncService`                         | Optional push/pull sync with Outlook                                    |
| `InstitutionsHttpService`                    | Institution metadata for color mapping                                  |
| `ClientCacheService`, `EmployeeCacheService` | In-memory caches to avoid re-fetch per event                            |

## Data Models

See [appointment-detail/contracts.md](../appointment-detail/contracts.md) for the full `Appointment` shape. Additional calendar-specific:

```ts
// apps/tagea-frontend/src/app/models/appointments.model.ts
interface VirtualOccurrenceResponse {
  // Non-materialized RRULE occurrences (generated server-side on demand)
  isVirtual: boolean;
  appointment: Appointment;
  anchorId: string;
  occurrenceDate: string; // ISO date
}

// apps/tagea-frontend/src/app/models/personal-preferences.model.ts
type CalendarViewType = 'timeGridWeek' | 'timeGridWorkWeek' | 'timeGridDay' | 'dayGridMonth' | 'listWeek' | 'listMonth' | 'listDay';

interface PersonalPreferences {
  calendar_default_view?: CalendarViewType; // not `calendarView`
  calendar_business_hours_start?: string; // HH:mm
  calendar_business_hours_end?: string; // HH:mm
  calendar_selected_employee_ids?: string[] | null;
  interface_language?: LanguageCode;
  timezone?: string;
  // + submissions-filter prefs, etc.
}

// apps/tagea-frontend/src/app/models/working-hours.model.ts
interface EmployeeAvailability {
  employee_id: string;
  first_name: string;
  last_name: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  profile_picture?: string;
  absence_type?: AbsenceType | null;
  absence_start_date?: string | null;
  absence_end_date?: string | null;
}

// Weekly availability is a map of YYYY-MM-DD → employees available that day
type WeeklyAvailabilityResponse = Record<string, EmployeeAvailability[]>;
```

## FullCalendar integration

The component passes `CalendarOptions` with:

- `plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]`
- `eventClick`, `eventDrop`, `eventResize` handlers wired to `CalendarEventService`
- `datesSet` triggers range-based fetch via `CalendarDataService`
- Custom background-event rendering for working hours + holidays

## Backend endpoints

All institution-scoped endpoints require `Auth({ scope: 'institution', permissions: [...] })` guards.

| Method + Path                                                                      | Permission            | Purpose                                                                |
| ---------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| `GET /institutions/:institutionId/appointments/calendar`                           | `APPOINTMENTS_VIEW`   | Optimized range query (`start`, `end`, `view`) for calendar rendering  |
| `GET /institutions/:institutionId/appointments/:id`                                | `APPOINTMENTS_VIEW`   | Single appointment detail (used by tooltip + click handler)            |
| `PATCH /institutions/:institutionId/appointments/:id`                              | `APPOINTMENTS_UPDATE` | Drag / resize reschedule; series branching handled via split/truncate  |
| `GET /institutions/:institutionId/appointments/:id/occurrences/:date`              | `APPOINTMENTS_VIEW`   | Resolve a virtual RRULE occurrence to a `VirtualOccurrenceResponse`    |
| `POST /institutions/:institutionId/appointments/:id/occurrences/:date/materialize` | `APPOINTMENTS_UPDATE` | Materialize a virtual occurrence before editing                        |
| `POST /institutions/:institutionId/appointments/:id/split-series`                  | `APPOINTMENTS_UPDATE` | "From this date on" series action                                      |
| `POST /institutions/:institutionId/appointments/:id/truncate-series`               | `APPOINTMENTS_UPDATE` | "Only this and earlier" series action                                  |
| `GET /institutions/:institutionId/working-hours/availability`                      | institution scope     | Weekly availability for overlay (returns `WeeklyAvailabilityResponse`) |
| `GET /public-holidays`                                                             | authenticated         | Holiday list for tenant region overlays                                |
| `GET /outlook-sync/config`                                                         | authenticated         | Current user's Outlook sync configuration                              |
| `PUT /outlook-sync/config`                                                         | authenticated         | Update Outlook sync configuration                                      |
| `POST /outlook-sync/trigger`                                                       | authenticated         | Kick off a sync run                                                    |
| `GET /outlook-sync/events`                                                         | authenticated         | Fetch Outlook events to overlay on the institution calendar            |

## Timezone

Events rendered in `Europe/Berlin` — same convention as [appointment-detail](../appointment-detail/spec.md) and [teamspace-calendar](../teamspace-calendar/spec.md).
