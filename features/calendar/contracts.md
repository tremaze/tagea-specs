# Contracts: Institution Calendar

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
  // Non-materialized RRULE occurrences
  anchor_appointment_id: string;
  start_datetime: string;
  end_datetime: string;
  // + metadata used for display
}

// apps/tagea-frontend/src/app/models/personal-preferences.model.ts
type CalendarViewType =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek'
  | /* other */;

interface PersonalPreferences {
  calendar_default_view?: CalendarViewType;           // not `calendarView`
  calendar_business_hours_start?: string;             // HH:mm
  calendar_business_hours_end?: string;               // HH:mm
  calendar_selected_employee_ids?: string[] | null;
  interface_language?: LanguageCode;
  timezone?: string;
  // + submissions-filter prefs, etc.
}

// apps/tagea-frontend/src/app/models/working-hours.model.ts
interface EmployeeAvailability {
  // per-day availability for one employee
}

interface WeeklyAvailabilityResponse {
  // response shape for weekly availability queries
}
```

## FullCalendar integration

The component passes `CalendarOptions` with:

- `plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]`
- `eventClick`, `eventDrop`, `eventResize` handlers wired to `CalendarEventService`
- `datesSet` triggers range-based fetch via `CalendarDataService`
- Custom background-event rendering for working hours + holidays

## Timezone

Events rendered in `Europe/Berlin` — same convention as [appointment-detail](../appointment-detail/spec.md) and [teamspace-calendar](../teamspace-calendar/spec.md).
