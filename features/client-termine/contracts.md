# Contracts: Client Termine

## List Endpoint

- `ClientAppointmentsService.getMyAppointments({ lang, page, limit })`
- GET `/appointments/my-appointments?lang=&page=&limit=`
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

- `getActiveTemplates()` — returns `AppointmentTemplate[]` the client can book (GET `/client-appointments/templates`)
- `getAvailableSlots(params: GetAvailableSlotsParams)` — returns `AvailableSlot[]` (GET `/client-appointments/available-slots`)
- `createBooking(booking: CreateClientBooking)` — creates the appointment (POST `/client-appointments/bookings`)

```ts
// apps/tagea-frontend/src/app/models/available-slot.model.ts
interface GetAvailableSlotsParams {
  template_id: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
}

interface CreateClientBooking {
  template_id: string;
  slot_datetime: string;
  client_id?: string; // optional - backend extracts from JWT if absent
  client_message?: string;
  setting?: string;
}

interface BookingResponse {
  id: string;
}
```

> See `apps/tagea-frontend/src/app/services/client-booking.service.ts` for the service implementation. The booking payload is JSON (not multipart) — category-specific form values and file uploads are NOT part of the current booking DTO; any such dynamic-field rendering in the wizard is local UI state only.

## Category Field Configuration (UI-local)

> Documentation-only shape. This interface exists only inside `client-termine-neu.component.ts` and is **not** part of the booking wire contract. Templates on the backend expose `static_fields_config` and `custom_fields_schema` on `AppointmentTemplate`; the current client booking wizard does not render those dynamically.

```ts
// apps/tagea-frontend/src/app/pages/client-portal/client-termine-neu.component.ts (local)
interface CategoryFieldConfig {
  checkboxes?: { id: string; label: string; required: boolean }[];
  textField?: { label: string; placeholder: string; required: boolean };
  dropdown?: { label: string; options: string[]; required: boolean };
  fileUpload?: { label: string; accept: string; required: boolean };
  hints?: string[];
}
```

> **Flutter port note:** Flutter does not need to mirror this local interface. If dynamic forms become required, drive them from `AppointmentTemplate.custom_fields_schema` instead.

## Auto-Mark-as-Seen

- `ClientAppointmentsService.markAsSeen(appointmentId)` — POST `/client-portal/appointments/:id/seen`. Fires from the dashboard feed on scroll; the Termine list page does **not** auto-mark.
- `ClientAppointmentsService.acknowledgeAppointment(appointmentId)` — POST `/client-portal/appointments/:id/acknowledge`. Explicit button click on the detail view (see appointment-detail spec).

## Other Client Endpoints

- `getAppointmentDetails(appointmentId)` — GET `/appointments/my-appointments/:id`
- `cancelAppointment(appointmentId, cancelData, managedClientId?)` — POST `/appointments/my-appointments/:id/cancel[?managedClientId=]`
- `translateAppointment(appointmentId, language, force?)` — POST `/appointments/my-appointments/:id/translate`
- `getTranslationStatuses(appointmentId)` — GET `/appointments/my-appointments/:id/translations`
