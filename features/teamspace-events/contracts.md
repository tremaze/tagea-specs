# Contracts: Teamspace Events

## Endpoints (verified against backend `events.controller.ts`, 2026-09-23)

All routes are tenant-scoped (`x-tenant-id`) and guarded by `TeamspaceAccessGuard` + `TeamspaceModuleGuard`.

| Method + path | Permission | Purpose |
| --- | --- | --- |
| `GET /events` | teamspace access (consumer access control inside `findAll`) | Paginated list (`EventFiltersDto`) → `EventListResponseDto` |
| `GET /events/:id` | `tenant.teamspace_events.view` | Single event (`EventResponseDto`) incl. `user_registration` |
| `POST /events/:eventId/participants/:participantId/cancel` | `tenant.events.register` | Cancel a registration → `204 No Content` |

### `GET /events` query (`EventFiltersDto extends PaginationDto`)

| Param | Type | Notes |
| --- | --- | --- |
| `page` | int ≥ 1 | default 1 |
| `limit` | int 1–100 | default 20; the staff list uses 12 (Angular `BATCH_SIZE`) |
| `status` | `draft \| published \| cancelled \| completed` | single value; **without it drafts are returned too**, so the staff list sends `published` |
| `search` | string | ILIKE on title + description (server-side) |
| `teamspace_ids` | uuid[] (repeat the param) | filtered to the caller's accessible teamspaces; `teamspace_id` for a single one |
| `upcoming_only` | boolean | `end_datetime >= now` (running and multi-day events stay) |
| `available_spots_only` | boolean | `max_participants IS NULL OR current_participants_count < max_participants` |
| `registration_open_only` | boolean | published, not started, deadline not passed |
| `sort` | `ASC \| DESC` | on `start_datetime`, default `ASC` |
| `lang` | string | translations → `display_title` / `display_description` when not `de` |
| `include_participants` | boolean | default `true`; **must stay true** for `user_registration` to be filled on list items |

There is **no** "my registrations" filter — it has to be applied to the loaded items (`user_registration.registration_status` not `cancelled`/`rejected`).

Response: `{ items: EventResponseDto[], total, page, limit, totalPages }`; more pages exist while `page < totalPages`.

### Cancel body (`CancelRegistrationDto`)

```json
{ "cancellation_reason": "Keine Angabe" }
```

`cancellation_reason` is **required** (`@IsString() @IsNotEmpty()`). The user-facing reason is optional: Angular (and Flutter) send the localised `defaultCancellationReason` ("Keine Angabe" / "Not specified") when the user leaves it empty. Series registrations ("Modus B", `series.registration_mode = 'series'`) are cancelled via `POST /events/series/:seriesId/registrations/:registrationId/cancel` instead.

## Service: `EventsService`

Methods relevant to this page (exact signatures in [`events.service.ts`](../../../apps/tagea-frontend/src/app/services/events.service.ts)):

| Method                                                                     | Purpose                                                                 |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `getEvents(filter?, sort?)` / `getEventsPaginated(filter?, sort?)`         | Events list (flat or paginated). Uses `EventFilter.teamspace_ids`       |
| `getEditorialEvents(filter?, sort?)`                                       | Events visible for REDAKTEUR+ roles — used by verwaltung                |
| `getEventById(id)`                                                         | Single event for detail                                                 |
| `registerForEvent(eventId, customFieldValues?)`                            | RSVP register (POST `events/:eventId/register`)                         |
| `cancelRegistration(eventId, participantId, cancellationReason)`           | RSVP cancel (POST `events/:eventId/participants/:participantId/cancel`) |
| `createEvent(event, customFieldDefinitions?, customFieldValues?)`          | Create (POST `events`)                                                  |
| `updateEvent(id, updates)` / `deleteEvent(id)`                             | Update / delete (PATCH / DELETE `events/:id`)                           |
| `getParticipants(eventId)`                                                 | List participants for verwaltung                                        |
| `translateEvent(eventId, language, force?)` / `getTranslationStatuses(id)` | Event translation                                                       |

### Payload mapping (service <-> backend)

The frontend model uses `start_date` / `end_date`; the backend expects `start_datetime` / `end_datetime`. The service maps these on the way in and out. Custom-field payload on create goes as `custom_fields_summary` (values) + `custom_field_definitions`.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/event.model.ts
interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  location_type: LocationType;
  meeting_link?: string;
  start_date: Date;
  end_date: Date;
  registration_deadline?: Date;
  max_participants?: number; // capacity
  current_participants: number; // registered count
  requires_approval: boolean;
  waitlist_enabled?: boolean;
  allow_public_registration?: boolean;
  organizer_id?: string;
  organizer_name?: string;
  status?: EventStatus;
  institution_id?: string;
  teamspace_id?: string;
  teamspace?: Teamspace;
  custom_field_values?: Record<string, unknown>;
  attachments?: string[];
  image_url?: string;
  created_at: Date;
  updated_at: Date;
}

// Extended shape returned by list/detail endpoints
interface EventWithRegistration extends Event {
  userRegistration?: EventRegistration;
  isUserRegistered: boolean; // replaces imagined is_registered
  isFull: boolean;
  hasWaitlist: boolean;
  spotsAvailable: number;
  can_accept_registrations: boolean;
  display_title?: string;
  display_description?: string | null;
  translation_language?: string | null;
}

interface EventRegistration {
  id: string;
  event_id: string;
  employee_id: string;
  employee_name: string;
  registration_status: RegistrationStatus;
  registration_date: Date;
  cancellation_date?: Date;
  attendance_status?: AttendanceStatus;
  notes?: string;
  custom_field_values?: Record<string, unknown>;
  is_waitlisted?: boolean;
  waitlist_position?: number;
}

type LocationType = 'onsite' | 'online' | 'hybrid' | 'office';
type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'waitlist';
type AttendanceStatus = 'present' | 'absent' | 'excused';

interface EventFilter {
  status?: EventStatus | 'all';
  location_type?: LocationType;
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
  teamspace_id?: string;
  teamspace_ids?: string[];
  lang?: string;
  page?: number;
  limit?: number;
  include_participants?: boolean;
}
```

## Context Change

`ContextChangeService` emits a signal when the active teamspace context changes (e.g. user switches via a global picker). The events page `effect()`s on this and reloads the list.

## Known guard gap

The route definitions for `verwaltung`, `verwaltung/neu`, and `bearbeiten/:id` have the intended `canActivate: [permissionGuard, teamspaceFeatureGuard]` and `data: { requiredPermission: 'events.manage' }` **commented out** with a TODO note. This is documented in the spec as a known gap; Flutter port should require the guard from day one.

> **Flutter port note:** bake the permission check into the route guard before merging. Do not ship the admin surfaces without it.
