# Contracts: Appointment Detail

## Service Abstraction

```ts
// apps/tagea-frontend/src/app/services/appointment-details.service.interface.ts
export const APPOINTMENT_DETAILS_SERVICE = new InjectionToken<IAppointmentDetailsService>(...);

export interface IAppointmentDetailsService {
  getAppointmentDetails(id: string): Promise<Appointment | ClientAppointment>;
  cancelAppointment?(
    id: string,
    data: CancelAppointmentDto,
    managedClientId?: string,
  ): Promise<Appointment | ClientAppointment>;
  updateAppointment?(id: string, data: UpdateAppointmentDto): Promise<Appointment>;
}
```

> Both mutating methods are declared optional on the interface — the client service implements `cancelAppointment` but not `updateAppointment`, while the staff service implements both.

Concrete implementations:

- `AppointmentsService` — staff / booker (full editing surface)
- `ClientAppointmentsService` — client (read + cancel + seen-tracking)

## Core Data Models

```ts
// apps/tagea-frontend/src/app/models/appointments.model.ts
interface Appointment {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_datetime: Date;
  end_datetime: Date;
  duration_minutes: number;
  is_all_day?: boolean;
  is_video_meeting?: boolean; // controls video-join affordance
  setting?: string | null; // 'vor-ort' | 'telefonat' | 'video' | 'chat'
  status: 'scheduled' | 'completed' | 'no_show_short_notice' | 'no_show_no_notice' | 'no_show_with_notice' | 'cancelled_by_counselor' | 'partially_cancelled';

  template_id?: string;
  template?: AppointmentTemplate;
  participants?: AppointmentParticipant[];
  financialSupportRecords?: FinancialSupportRecord[]; // camelCase — source of truth
  appointmentApprovalLinks?: AppointmentApprovalLink[];

  // Custom fields (split into summary + full map)
  custom_fields_summary: object;
  custom_fields_full: Record<
    string,
    {
      value: unknown;
      updated_at: string;
      validation_state?: 'valid' | 'invalid' | 'pending';
    }
  >;

  created_by_employee_id?: string;
  assigned_to_employee_id?: string;
  assigned_to_employee_ids?: string[];
  booking_category_id?: string;
  teamspace_id?: string;
  has_full_access?: boolean; // backend flag for restricted views
  invalid_fields: number;
  created_at: Date;
  updated_at: Date;
  // + series/recurrence fields (recurrence_rule, series_end_date, etc.)
}

// The client-facing appointment is a distinct shape:
// apps/tagea-frontend/src/app/services/client-appointments.service.ts
interface ClientAppointment {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'cancelled_by_client' | 'no_show';
  setting?: string | null;
  is_video_meeting?: boolean;
  has_acknowledged?: boolean;
  acknowledged_at?: Date | null;
  is_seen?: boolean;
  participants?: {
    id: string;
    participant_type: string;
    client_id?: string;
    response_status?: 'pending' | 'accepted' | 'declined' | 'tentative';
    // Participant-level cancellation (not on the root)
    cancellation_reason?: string;
    cancellation_categories?: string[];
    cancelled_at?: string;
    // …
  }[];
  // + additional client-visible fields
}
```

> **Managed-client context:** The backend attaches `managed_client_name?: string` when the appointment is for a managed client. The `managedClientId` (camelCase) lives in the feed-card layer (`utils/feed-card-mappers.ts`) and propagates as a `?managedClientId=` query param — it is derived from the participants list, not a root field on `Appointment` or `ClientAppointment`.

> **Video session:** There is **no** `video_session` sub-object. Video availability is signalled by `is_video_meeting: boolean` plus `setting === 'video'`. Join URLs come from the dedicated `VideoSessionService`, not from the appointment payload.

## Related Endpoints

| Action                                    | Service method                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Load appointment (staff or client via DI) | `IAppointmentDetailsService.getAppointmentDetails(id)`                                                                                  |
| Update details (staff only)               | `IAppointmentDetailsService.updateAppointment(id, dto)`                                                                                 |
| Cancel (client)                           | `IAppointmentDetailsService.cancelAppointment(id, cancelData, managedClientId?)` — hits `POST /appointments/my-appointments/:id/cancel` |
| Manage participants (staff save)          | `AppointmentParticipantsService.manageAppointmentParticipants(appointmentId, { employees, clients })`                                   |
| RSVP via participant patch                | `AppointmentParticipantsService.selfRsvp(participantId, { response_status })` <!-- documentation-only: method name planned alongside the new endpoint --> — hits `PATCH /employees/me/appointment-participants/:id`. Institution-independent (backend checks the row belongs to the caller). Staff `manageAppointmentParticipants` continues to use `updateParticipant` on the institution-scoped path when the staff user is editing someone else's participation. |
| Load custom field definitions             | `CustomFieldsService.getFieldDefinitions(entityType)` (with `entityType = 'appointment'`)                                               |
| Create financial support record           | `FinancialSupportService.createFinancialSupport(request)`                                                                               |
| Start video session                       | `VideoSessionService.startSession(appointmentId)`                                                                                       |

## Timezone Handling

Backend returns UTC ISO strings. UI renders in `Europe/Berlin` regardless of the browser's local timezone (tenant-wide). Use `AppointmentTimeService` helpers in Angular; in Flutter, use the `timezone` package with `Europe/Berlin` location.

> **Flutter port note:** Do not rely on `DateTime.toLocal()` — always convert explicitly via `TZDateTime.from(dt, berlin)`.

## Mode Discrimination

The component reads `route.data.mode` — propagate the same concept in Flutter:

```dart
enum AppointmentDetailMode { staff, booker, client }
```

Pass the mode to the shared widget; inject the appropriate repository (staff vs. client) via DI.
