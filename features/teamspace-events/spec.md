# Feature: Teamspace Events

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-09-23 (list/detail/cancel verified against backend for the Flutter port, WP3)

## Vision (Elevator Pitch)

Staff events feed: browse upcoming events across teamspaces, see who has registered, and RSVP. Editing and verwaltung of events live under subroutes; detail route shows full event info.

## User Stories

- As a **staff member** I want to see upcoming events, so that I can plan to attend.
- As a **staff member** I want to RSVP (register / deregister), so that the organizer has accurate counts.
- As an **event editor** I want to create and edit events, so that I can run the event calendar for my teamspace.

## Acceptance Criteria

### List (`/teamspace/events`)

- [ ] **Given** the user opens the page, **When** `EventsService` + `TeamspaceService` resolve, **Then** events render as `EventArticleCardComponent` cards with title, date, location, registration status.
- [ ] **Given** teamspace filter chips render, **When** the user picks a chip, **Then** the feed filters to that teamspace.
- [ ] **Given** a search term is entered, **When** the user pauses (debounce 300 ms), **Then** the server performs full-text search (`search`).
- [ ] **Given** the list loads, **Then** it requests published events that have not ended (`status=published&upcoming_only=true&sort=ASC`), 12 per page, and pages on at the end of the list (infinite scroll).
- [ ] **Given** the availability chips ("Alle" / "Meine Anmeldungen" / "Mit freien Plätzen", multi-select), **When** "Mit freien Plätzen" is active, **Then** the server filters (`available_spots_only`); "Meine Anmeldungen" narrows the loaded items to active own registrations (no backend filter).
- [ ] **Given** a card, **Then** it shows image (or placeholder), title, excerpt, date + time, location, free places ("n frei" / "Ausgebucht"), the own registration status (hidden when cancelled) and — for cancelled events — an "Abgesagt" chip.
- [ ] **Given** a card is tapped, **When** navigation resolves, **Then** open `/teamspace/events/:id`.
- [ ] **Given** the context (teamspace) changes in `ContextChangeService`, **When** the `effect()` fires, **Then** the events list reloads in the new context.

### Detail (`/teamspace/events/:id`)

- [ ] **Given** the detail loads, **When** the event fetches, **Then** title, description, date/time, location, organizer, and registration count are shown.
- [ ] **Given** the user can register, **When** they press "Anmelden", **Then** an RSVP is recorded and the UI updates.
- [ ] **Given** the user is already registered, **When** they press "Abmelden", **Then** the RSVP is removed.
- [ ] **Given** an active own registration (`pending`, `approved`, `waitlist`) on a non-cancelled single event, **When** the event has not started yet, **Then** "Abmelden" is offered; it asks for confirmation with an optional reason and sends the localised default reason when empty (the backend requires one). After success the status shows "Nicht angemeldet".
- [ ] **Given** the event has started, **Then** no "Abmelden" is offered (Angular: `cannotCancelAfterStart`). The registration deadline does **not** limit cancelling.
- [ ] **Given** the event is cancelled, **Then** the detail shows an "Abgesagt" chip/status and no action.
- [ ] **Given** the event is unknown or not visible (404/403), **Then** a "Veranstaltung nicht gefunden" state with a way back to the list is shown; other errors offer a retry.

### Verwaltung (`/teamspace/events/verwaltung`, `/verwaltung/neu`, `/bearbeiten/:id`)

- [ ] **Status:** Implemented in Angular but `canActivate` guard is commented out (`// TODO: Re-enable permission guard when backend is ready`). Flutter port should treat these routes as **P1 blocked** — implement only once the guard is re-enabled. Flag for product.

## UI States

| State     | When?            | What does the user see?                      | A11y notes      |
| --------- | ---------------- | -------------------------------------------- | --------------- |
| Loading   | Initial fetch    | Spinner                                      | `role="status"` |
| Searching | Debounce pending | Inline spinner in search icon                | —               |
| Empty     | No events        | Empty state + (if permitted) "New event" CTA | —               |
| Populated | Cards rendered   | Chips + search + cards                       | —               |
| Error     | Fetch failure    | Error panel + retry                          | `role="alert"`  |

## Non-Goals

- **Calendar view** of events — the events list is flat/chronological; calendar view for appointments lives under [teamspace-calendar](../teamspace-calendar/spec.md).
- **Cross-teamspace event duplication** — not implemented.

## Edge Cases

- **Events in the past** — still visible; sort places them below upcoming.
- **Event cancellation** — status flips; card renders with strikethrough / "cancelled" chip. Note: the list requests `status=published` (Angular parity, drafts would leak otherwise), so cancelled events only appear via detail / deep link / feed; showing them in the list needs a multi-value `status` filter (open product question, Asana "Entscheidungen offen").
- **Registration deadline passed** — RSVP actions are hidden.
- **Guard gap on `/verwaltung`**: without the TODO'd `permissionGuard`, any authenticated user with `teamspaceFeatureGuard` can reach these admin routes via direct URL. Acknowledge this is a known gap; Flutter port should require the same guard **before** exposing the admin surfaces.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_events.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Verwaltung routes:** guard currently missing in code (commit-labelled TODO). Spec says `events.manage` is intended.

## Notifications (Push / In-App)

- Event invitations / updates deep-link to the detail route.
- Unread events contribute to teamspace-home's per-teamspace badge.

## i18n Keys

> User-facing strings remain in German.

- `eventsPage.title`, `.subtitle`, `.helpTooltip` — rest owned by the external template.

## Offline Behavior

**Flutter-specific:**

- Cached event list visible offline.
- RSVP actions require online; queue optional.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts)
- **Detail:** [`events-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-detail.component.ts)
- **Editor:** [`events-editor.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-editor.component.ts)
- **Verwaltung:** [`events-verwaltung.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-verwaltung.component.ts)
- **Services:** `EventsService`, `TeamspaceService`, `ContextChangeService`
- **Card:** `EventArticleCardComponent`
- **Model:** `EventWithRegistration` (from `apps/tagea-frontend/src/app/models/event.model.ts`)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
