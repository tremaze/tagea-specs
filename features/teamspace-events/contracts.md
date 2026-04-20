# Contracts: Teamspace Events

## Service: `EventsService`

Methods relevant to this page (exact signatures in [`events.service.ts`](../../../apps/tagea-frontend/src/app/services/events.service.ts)):

| Method                                                   | Purpose                        |
| -------------------------------------------------------- | ------------------------------ |
| `getForTeamspaces({ teamspaceIds?, search? })`           | Paginated events list          |
| `getById(id)`                                            | Single event for detail        |
| `register(eventId)` / `deregister(eventId)`              | RSVP operations                |
| `create(payload)` / `update(id, payload)` / `delete(id)` | Editor operations (verwaltung) |

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
  custom_fields?: Record<string, unknown>;
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
  // + more fields (waitlist_position?, status, etc.)
}
```

## Context Change

`ContextChangeService` emits a signal when the active teamspace context changes (e.g. user switches via a global picker). The events page `effect()`s on this and reloads the list.

## Known guard gap

The route definitions for `verwaltung`, `verwaltung/neu`, and `bearbeiten/:id` have the intended `canActivate: [permissionGuard, teamspaceFeatureGuard]` and `data: { requiredPermission: 'events.manage' }` **commented out** with a TODO note. This is documented in the spec as a known gap; Flutter port should require the guard from day one.

> **Flutter port note:** bake the permission check into the route guard before merging. Do not ship the admin surfaces without it.
