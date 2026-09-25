# Contracts: Teamspace Offer Booking

## Endpoints (verified against `employee-appointments.controller.ts` + `appointments.service.ts`, 2026-09-25)

All four endpoints: `@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.EMPLOYEE] })`. There is no tenant permission, teamspace access or module guard. The tenant comes from `x-tenant-id` as usual.

| Method + path | Purpose | Used by the page |
| --- | --- | --- |
| `GET /teamspaces/accessible` | Teamspaces of the caller (incl. `active_modules`) | ✅ step 1 |
| `GET /appointments/booking-categories/teamspace/:teamspaceId` | Active, non-archived categories of one teamspace (`:teamspaceId` must be a UUID → else `400`) | ✅ step 2 |
| `GET /appointments/booking-categories/all-accessible` | Active, non-archived categories of **all** teamspaces in the tenant (no access filter), ordered by teamspace name, `display_order`, name | ❌ (service method exists, unused) |
| `GET /appointments/teamspace-booking/available-slots` | Free slots of a category | ✅ step 3 |
| `POST /appointments/teamspace-booking` | Book a slot for oneself → creates the appointment | ✅ step 5 |

### Booking category (both category endpoints)

```ts
// apps/tagea-frontend/src/app/services/teamspace-appointments.service.ts
interface AccessibleBookingCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;               // Material icon name
  is_active: boolean;
  is_archived: boolean;
  display_order: number;
  default_duration_minutes: number;
  default_location?: string;
  max_participants?: number;
  color?: string;
  teamspace_id: string;
  teamspace_name: string;     // backend falls back to "Unbekannt"
  created_at: string;
  updated_at: string;
}
```

Backend nullability: `description`, `default_location`, `max_participants`, `color` are `null` (not absent) when unset.

### `GET /appointments/teamspace-booking/available-slots`

Query (`GetTeamspaceAvailableSlotsDto`):

| Param | Type | Notes |
| --- | --- | --- |
| `teamspace_id` | uuid v4, required | |
| `booking_category_id` | uuid v4, required | must belong to `teamspace_id` and not be archived → else `404` |
| `from_date` | ISO 8601, optional | default now |
| `to_date` | ISO 8601, optional | default now + 30 days; the backend may extend the end to reach a bounded plan further out |
| `limit` | int 1–500, optional | default 200; Angular sends 300 |

Response: array, sorted by time, already filtered against all conflict sources (appointments, series occurrences, absences, teamspace events, Outlook busy, working hours). No published plan → `[]`.

```ts
// apps/tagea-frontend/src/app/services/teamspace-appointments.service.ts
interface TeamspaceAvailableSlot {
  start_datetime: string;     // ISO instant (generated in Europe/Berlin)
  end_datetime: string;
  duration_minutes: number;   // category default_duration_minutes (fallback 30)
  booking_category_id: string;
  employee_id?: string;       // provider (plan owner)
  employee_name?: string;     // "First Last", '' if unknown
  allowed_settings: string[]; // subset of the setting ids; [] = all allowed
}
```

Errors: `400` invalid query, or any unexpected failure (wrapped as "Failed to find available slots: …"); `404` category not found/archived.

### `POST /appointments/teamspace-booking`

```ts
// apps/tagea-frontend/src/app/services/teamspace-appointments.service.ts
interface CreateTeamspaceBookingDto {
  booking_category_id: string;   // uuid v4, required
  teamspace_id: string;          // uuid v4, required (category must belong to it)
  start_datetime: string;        // ISO date string, required
  duration_minutes?: number;     // int 5–480; default = category default_duration_minutes
  setting: 'vor-ort' | 'telefonat' | 'video' | 'chat'; // required
  custom_data?: Record<string, unknown>; // object; Angular sends the form value { textField, dropdown, checkboxes, file }
  provider_employee_id?: string; // uuid v4; honoured only if that employee has a covering plan
}

interface TeamspaceBookingCreatedResponse {
  id: string;                    // appointment id
  title: string;                 // = category name
  start_datetime: string;
  end_datetime: string;
  duration_minutes: number;
  location?: string;             // category default_location
  booking_category_name: string;
  teamspace_name: string;
  setting: string;
  message: string;               // "Termin erfolgreich gebucht"
}
```

Server behaviour (201):

- Loads the category (`id` + `teamspace_id`) and requires `is_active && !is_archived`.
- In **one** transaction: re-validates the slot (a covering published plan for the category/teamspace, the requested provider if given, the chosen `setting` against the plan's `allowed_settings`, and the provider free across all conflict sources), then inserts the appointment.
- Appointment: `title = category.name`, `description = category.description`, `location = category.default_location`, `status = scheduled`, `teamspace_id`, `booking_category_id`, `setting`, `is_video_meeting = (setting === 'video')`, `visibility = 'internal'`, `custom_fields_summary = { setting, setting_label, ...custom_data }`. The provider is `assigned_to_employee_id`.
- Participants: provider as `organizer`; booker as `participant` unless the booker is the provider. Both `response_status = 'scheduled'`.
- Notifies provider and booker (push + in-app + e-mail, `APPOINTMENT_CREATED`, `data.route = /teamspace/buchung/:id`). This happens after the commit and never fails the request.

| Status | When |
| --- | --- |
| `400` | DTO validation (messages e.g. "Booking category ID must be a valid UUID", "Setting is required", "Duration must be at least 5 minutes") |
| `400` | Category inactive/archived: "This booking category is not available for bookings" |
| `400` | Slot covered but nobody free anymore: "Der gewählte Zeitpunkt ist nicht mehr frei." |
| `400` | Slot not (or no longer) covered by a plan / setting not allowed: "Der gewählte Zeitpunkt ist nicht (mehr) als Verfügbarkeit buchbar." |
| `403` | Caller is not an employee |
| `404` | Category not found for the teamspace, or teamspace not found |

`setting` is validated only as a non-empty string by the DTO; an unknown value finds no covering plan unless the plan's whitelist is empty.

## Data Models (UI)

> Documentation-only shape.

```ts
// Setting catalogue (hard-coded in the page, labels from bookingPage.settings.*)
type BookingSetting = 'vor-ort' | 'telefonat' | 'video' | 'chat';
```

> **Flutter port note:** keep the setting ids exactly as above; they are stored on the appointment (`setting`) and matched against `allowed_settings`.
