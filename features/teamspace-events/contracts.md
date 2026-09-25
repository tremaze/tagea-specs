# Contracts: Teamspace Events

## Endpoints (verified against backend `events.controller.ts`, 2026-09-23)

All routes are tenant-scoped (`x-tenant-id`) and guarded by `TeamspaceAccessGuard` + `TeamspaceModuleGuard`.

| Method + path | Permission | Purpose |
| --- | --- | --- |
| `GET /events` | teamspace access (consumer access control inside `findAll`) | Paginated list (`EventFiltersDto`) → `EventListResponseDto` |
| `GET /events/:id` | `tenant.teamspace_events.view` | Single event (`EventResponseDto`) incl. `user_registration` |
| `POST /events/:eventId/participants/:participantId/cancel` | `tenant.events.register` | Cancel a registration → `204 No Content` |
| `POST /events/:eventId/register` | `tenant.events.register` (+ teamspace access + module of the event) | Register oneself for a single event / `per_occurrence` occurrence → `201 EventParticipantResponseDto` |
| `POST /events/series/:seriesId/register` | `tenant.events.register` (+ teamspace access + module of the series) | Register oneself for a whole series (Modus B) → `201 EventSeriesRegistrationResponseDto` |
| `GET /custom-fields/definitions/for-event/:eventId` | none beyond authentication ("if the user can see the event, they can see the registration form") | Active registration field definitions of the event (`CustomFieldDefinition[]`) |

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

## Registration (verified against `events.controller.ts`, `event-participants.service.ts`, `event-series-registrations.service.ts`, `event-custom-field-definitions.controller.ts`, 2026-09-25)

### `GET /custom-fields/definitions/for-event/:eventId`

Returns the event's active definitions (`CustomFieldDefinition` entity, `entity_type = 'event'`), ordered by `display_order`. Relevant fields: `id`, `field_key`, `field_type`, `display_name`, `description`, `is_required`, `validation_rules`, `ui_config` (`group`, placeholder, options…), `display_order`. `field_type` is one of `text | email | phone | number | date | textarea | richtext | select | multiselect | radio | checkbox_group | boolean | file | url | pregnancy_due_date | label | iban | bic | employee_select | institution_select` (`label` is display-only).

The frontend groups by `ui_config.group` (fallback group name `Anmeldeformular`) into `FieldGroup[]` (`EventsService.getRegistrationFields`). A failed request means no fields (the page stays usable).

### `POST /events/:eventId/register` and `POST /events/series/:seriesId/register`

> Documentation-only shape.

```ts
// Backend RegisterEventDto (apps/tagea-backend/src/events/dto/register-event.dto.ts)
// The teamspace page sends only custom_field_values — and only when the event has fields.
interface RegisterEventDto {
  employee_id?: string;          // auto-filled from the caller; never sent by the teamspace page
  participant_name?: string;     // external participants only (≤ 255)
  participant_email?: string;    // external participants only
  participant_phone?: string;    // ≤ 50
  custom_field_values?: Record<string, unknown>; // keyed by field_key
  notes?: string;
}
```

Response for the single event (`EventParticipantResponseDto`, excerpt), which the page reads to pick the success status:

> Documentation-only shape.

```ts
interface EventParticipantResponseDtoExcerpt {
  id: string;
  event_id: string;
  employee_id: string | null;
  registration_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'waitlist';
  is_waitlisted: boolean;
  waitlist_position: number | null;
  awaiting_guardian_consent: boolean; // always false for staff
  custom_field_values: Record<string, unknown>;
  registration_date: string;
}
```

The series response (`EventSeriesRegistrationResponseDto`) carries the same status fields (`series_id` instead of `event_id`).

**Status derivation (host, `registrationStatusOf`):** `is_waitlisted` → `waitlist`; `registration_status === 'pending'` → `pending`; otherwise `approved`.

**Server-side allocation (single event):** not full + no approval → `approved`, and `current_participants_count` + 1; not full + `requires_approval` → `pending` (no seat counted until approval); full + `waitlist_enabled` → waitlisted with the next `waitlist_position`; full without waitlist → `403`. Series mode is identical, with the series' capacity/approval/waitlist.

**Errors**

| Status | When | Body `code` |
| --- | --- | --- |
| `400` | Already registered (live registration exists) — single event | — (`message`) |
| `400` | Occurrence belongs to a Modus-B series (use the series endpoint) | `SERIES_REGISTRATION_REQUIRED` (+ `seriesId`) |
| `400` | Series: live registration exists | `series_already_registered` |
| `400` | Series: custom field values invalid (required missing, wrong type) | — |
| `400` | Series: series is not in `series` mode | — |
| `403` | Not accepting registrations (not published, started, deadline passed), or full without waitlist | — |
| `403` | Series: no future occurrence, deadline passed, full without waitlist | — |
| `403` | Participation rule violated — **client registrations only**; never on these staff endpoints today | `event_participation_rule_violation` + `failures[]` |
| `404` | Event / series not found or not visible | — |

The global exception filter lifts `code` / `failures` to `error.error.code` / `error.error.failures` on the HTTP error body.

Custom field values on the single-event path are sanitised (richtext HTML) but **not** validated server-side; required-field enforcement there is client-side only. The series path validates them against the first future occurrence.

**Re-registration:** a `cancelled` or `rejected` row for the same employee is revived (status, approval, waitlist and cancellation fields are reset; new `custom_field_values` replace the old ones) instead of creating a duplicate.

### Wizard engine (Angular reference)

```ts
// apps/tagea-frontend/src/app/shared/events/registration/state/wizard-machine.ts
const STEP_KEYS: Record<WizardMode, readonly string[]> = {
  gast: ['participants', 'contact', 'summary'],
  portal: ['participants', 'summary'],
  teamspace: ['participation'],
};

// Same order in resultStatus() and ctaLabelKey(): waitlist wins over approval.
type RegistrationResultStatus = 'approved' | 'pending' | 'waitlist';
type CtaLabelKey =
  | 'eventRegistration.cta.confirm'
  | 'eventRegistration.cta.approval'
  | 'eventRegistration.cta.waitlist';

interface EventFlags {
  requiresApproval: boolean;
  isFull: boolean;
  waitlistEnabled: boolean;
  requiresBirthdate: boolean;
  requiresGender: boolean;
  availableSpots: number | null;
  bookingBlocked: boolean;
}

// Series info on an occurrence (models/event.model.ts)
interface EventSeriesInfo {
  id: string;
  registration_mode: EventSeriesRegistrationMode; // 'per_occurrence' | 'series'
  sequence: number | null;
  total_occurrences: number;
  active_occurrences?: number;
  max_participants?: number | null;
  current_participants_count?: number;
  requires_approval?: boolean;
  waitlist_enabled?: boolean;
}

interface EligibilityFailure {
  code: EligibilityFailureCode; // birthdate_missing | below_min_age | above_max_age | gender_missing | gender_not_allowed
  minAge?: number;
  maxAge?: number;
  actualAge?: number;
  allowedGenders?: string[];
}
```

Teamspace flags (`eventFlags` in `events-register.component.ts`): single event → `requiresApproval = requires_approval`, `isFull`, `waitlistEnabled = waitlist_enabled`, `availableSpots = spotsAvailable`; series mode → the same from `event.series` (`isFull = max != null && current >= max`).

## Service: `EventsService`

Methods relevant to this page (exact signatures in [`events.service.ts`](../../../apps/tagea-frontend/src/app/services/events.service.ts)):

| Method                                                                     | Purpose                                                                 |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `getEvents(filter?, sort?)` / `getEventsPaginated(filter?, sort?)`         | Events list (flat or paginated). Uses `EventFilter.teamspace_ids`       |
| `getEditorialEvents(filter?, sort?)`                                       | Events visible for REDAKTEUR+ roles — used by verwaltung                |
| `getEventById(id)`                                                         | Single event for detail                                                 |
| `registerForEvent(eventId, customFieldValues?)`                            | RSVP register (POST `events/:eventId/register`)                         |
| `registerForSeries(seriesId, customFieldValues?)`                          | Series register, Modus B (POST `events/series/:seriesId/register`)      |
| `getRegistrationFields(eventId)`                                           | Registration fields → `FieldGroup[]` (GET `custom-fields/definitions/for-event/:eventId`) |
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
