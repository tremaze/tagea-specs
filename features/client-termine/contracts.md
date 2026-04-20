# Contracts: Client Termine

## List Endpoint

- `ClientAppointmentsService.getMyAppointments({ lang, page, limit })`
- Returns `ClientAppointmentsPaginatedResponse`:

```ts
// apps/tagea-frontend/src/app/services/client-appointments.service.ts
interface ClientAppointmentsPaginatedResponse {
  items: ClientAppointment[];
  total: number;
  page: number;
  pages: number; // total pages
  limit: number;
}
```

## Appointment Model (Client Perspective)

```ts
// Source: apps/tagea-frontend/src/app/services/client-appointments.service.ts
interface ClientAppointment {
  id: string;
  title: string;
  description?: string;
  start_datetime: string; // ISO
  end_datetime: string; // ISO
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'cancelled_by_client' | 'no_show';
  location?: string;
  setting?: string | null;
  is_video_meeting?: boolean;
  has_acknowledged?: boolean;
  acknowledged_at?: Date | null;
  is_seen?: boolean;
  duration_minutes?: number;
  template_id?: string;
  participants?: /* see appointment-detail/contracts.md for full shape */ unknown[];
  // + additional fields — see the full interface in the service file
}
```

> **Managed-client scoping** is computed from the `participants` list (participant with `participant_type: 'client'` other than the calling user); see `utils/feed-card-mappers.ts`. The resulting `managedClientId` (camelCase) propagates through the UI as a query param — it is **not** a root field on `ClientAppointment`.

## Booking Flow

`ClientBookingService` handles the wizard:

- `getAvailableCategories()` — returns `AppointmentTemplate[]` the client can book
- `getAvailableSlots(categoryId, dateRange)` — returns `AvailableSlot[]`
- `submitBooking(payload)` — creates the appointment

> See `apps/tagea-frontend/src/app/services/client-booking.service.ts` for exact payload shape. Payload includes chosen category + slot + category-specific form values + file uploads (multipart).

## Category Field Configuration

Categories can carry dynamic form config:

```ts
interface CategoryFieldConfig {
  checkboxes?: { id: string; label: string; required: boolean }[];
  textField?: { label: string; placeholder: string; required: boolean };
  dropdown?: { label: string; options: string[]; required: boolean };
  fileUpload?: { label: string; accept: string; required: boolean };
  hints?: string[];
}
```

> **Flutter port note:** This config should be rendered dynamically (JSON-driven form). Consider `reactive_forms` package for Dart/Flutter.

## Auto-Mark-as-Seen

- `ClientAppointmentsService.markAsSeen(appointmentId)` — fires from the dashboard feed on scroll; the Termine list page does **not** auto-mark.
