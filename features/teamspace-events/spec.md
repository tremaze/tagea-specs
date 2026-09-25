# Feature: Teamspace Events

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-09-25 (registration flow `/teamspace/events/:id/anmelden` added, M2-Specs)

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
- [ ] **Given** the user can register (see [Registration](#registration-teamspaceeventsidanmelden)), **When** they press "Jetzt anmelden" (or "Auf Warteliste setzen" when full), **Then** the registration page `/teamspace/events/:id/anmelden` opens — always the full page, even without custom fields. After leaving it, the detail reloads and shows the new status.
- [ ] **Given** the user is already registered, **When** they press "Abmelden", **Then** the RSVP is removed.
- [ ] **Given** an active own registration (`pending`, `approved`, `waitlist`) on a non-cancelled single event, **When** the event has not started yet, **Then** "Abmelden" is offered; it asks for confirmation with an optional reason and sends the localised default reason when empty (the backend requires one). After success the status shows "Nicht angemeldet".
- [ ] **Given** the event has started, **Then** no "Abmelden" is offered (Angular: `cannotCancelAfterStart`). The backend refuses every cancel after the start, organizers included.
- [ ] **Given** the registration deadline (`registration_deadline`) has passed, **Then** no "Abmelden" is offered and a hint says the deadline passed. The backend (`EventParticipantsService.cancelRegistration`) refuses a self-cancel after the deadline with `403`. **Exception:** callers acting as organizer (`tenant.teamspaces.access_all` or teamspace permission `events.process` in one of the event's teamspaces) may still cancel until the start — the backend does not check whether the registration is their own and then treats it as an organizer cancel ("cancelled by organizer" notification).
  - Angular deviates: it offers "Abmelden" until the start regardless of the deadline; non-organizers then get the `403`.
  - Flutter hides "Abmelden" after the deadline for everyone. Whether organizers should see it for their own registration is an open product question (Asana "Entscheidungen offen").
- [ ] **Given** the confirmation is sent after cancelling became impossible (the sheet stayed open past start or deadline), **Then** the user gets the "no longer possible" message instead of a silent no-op.
- [ ] **Given** the event is cancelled, **Then** the detail shows an "Abgesagt" chip/status and no action.
- [ ] **Given** the event is unknown or not visible (404/403), **Then** a "Veranstaltung nicht gefunden" state with a way back to the list is shown; other errors offer a retry.

### Registration (`/teamspace/events/:id/anmelden`)

A routed page of its own (not a dialog or sheet). On wide screens it has two columns: the flow on the left and a sticky event card on the right. On mobile the card sits below the flow. The flow is the teamspace mode of the shared registration wizard: **one step** (`STEP_KEYS.teamspace = ['participation']`) and then a success screen. There is no stepper, no review step and no consent checkbox (staff consented at sign-up).

**Entry and visibility of the CTA on the detail**

- [ ] **Given** the event accepts registrations (`can_accept_registrations`), the user has no active registration, and the event is neither cancelled nor closed, **Then** the detail shows "Jetzt anmelden". When the event is full with a waitlist, it shows "Auf Warteliste setzen" instead, plus the hint "Die Veranstaltung ist voll – du wirst auf die Warteliste gesetzt.". When approval is required, it shows "Diese Veranstaltung erfordert eine Freigabe. Deine Anmeldung ist erst nach Bestätigung gültig."
- [ ] **Given** registration is closed (not published, started, or deadline passed: `!can_accept_registrations && !isFull`), **Then** the detail shows "Anmeldung geschlossen" / "Die Anmeldefrist ist abgelaufen." and no CTA. The registration page itself has no extra guard: a deep link to a closed event still opens it, and the backend refuses the submit (`403`).
- [ ] **Given** the event is full **without** a waitlist, **Then** no CTA is offered (the backend would refuse with `403`).

**Page load**

- [ ] **Given** the page opens, **Then** it loads the event (`GET /events/:id`) and then the registration fields (`GET /custom-fields/definitions/for-event/:eventId`). While the event loads, it shows "Laden..." (`common.loading`). If the event cannot be loaded (error or unknown id), it shows "Veranstaltung konnte nicht geladen werden" (`eventDetailShell.error.loadFailed`).
- [ ] **Given** loading the field definitions fails, **Then** the page continues without custom fields (same as an event without fields).
- [ ] **Given** the page, **Then** the header shows a back arrow ("Zurück"), the title "Anmelden" and the subtitle `<title> · <weekday, dd. MMMM yyyy>` (German long date).
- [ ] **Given** the page, **Then** the event card shows the title, date, time range `HH:mm–HH:mm Uhr`, location (hidden when empty), the access restrictions (min/max age, allowed genders; one row each), and, when a capacity exists, "{free} von {total} Plätzen frei".

**Participation step ("Deine Teilnahme")**

- [ ] **Given** the step, **Then** it shows the heading "Deine Teilnahme", the hint "Du meldest dich für diese Veranstaltung an.", and a person card for the logged-in staff member: display name, initials avatar, relation label "angemeldet als Fachkraft". There is no person picker; staff can only register themselves.
- [ ] **Given** the event is full with a waitlist, **Then** a banner reads "Diese Veranstaltung ist ausgebucht. Du kannst dich auf die Warteliste setzen — wird ein Platz frei, benachrichtigen wir dich.". **Otherwise, given** approval is required, the banner reads "Diese Veranstaltung erfordert eine Freigabe durch das Team. Nach dem Absenden ist der Status „In Prüfung“.". Waitlist wins over approval.
- [ ] **Given** the event has registration fields, **Then** they render inside the person card under the heading "Für diese Veranstaltung", grouped by `ui_config.group` (default group "Anmeldeformular") in `display_order`.
- [ ] **Given** a required field (`is_required`) is empty or invalid, **Then** the CTA is disabled. It becomes enabled once all required fields are valid. An event without fields can be submitted right away.

**CTA label (bind CTA) — same order as the result**

| Condition (first match wins)                  | CTA label                   | Expected result |
| --------------------------------------------- | --------------------------- | --------------- |
| full (`isFull`) **and** waitlist enabled      | "Auf die Warteliste setzen" | `waitlist`      |
| approval required (`requires_approval`)       | "Zur Prüfung anmelden"      | `pending`       |
| otherwise                                     | "Verbindlich anmelden"      | `approved`      |

- [ ] **Given** the user presses the CTA, **Then** it shows a spinner, is disabled while in flight (no double submit), and sends the registration: `POST /events/:eventId/register` for single events, or `POST /events/series/:seriesId/register` in series mode (below). Custom field values are sent as `custom_field_values` only when the event has fields.

**Success screen**

- [ ] **Given** the submit succeeds, **Then** the success screen replaces the step. Its status comes from the **backend response**, not from the CTA prediction: `is_waitlisted = true` → waitlist; `registration_status = 'pending'` → pending; otherwise approved.

| Result     | Title                  | Body                                                                  |
| ---------- | ---------------------- | --------------------------------------------------------------------- |
| `approved` | "Du bist angemeldet"   | "Deine Teilnahme ist eingetragen."                                    |
| `pending`  | "Anmeldung in Prüfung" | "Deine Anmeldung wird vom Team geprüft."                              |
| `waitlist` | "Auf der Warteliste"   | "Du stehst auf der Warteliste. Wird ein Platz frei, benachrichtigen wir dich." |

- [ ] **Given** the success screen, **When** the user presses its button (Angular label "Von vorne") or the back arrow, **Then** they return to `/teamspace/events/:id`, which reloads and shows the new registration status. Flutter labels this button "Zur Veranstaltung", because it navigates back rather than restarting the flow (see parity).
- [ ] **Given** the user presses the back arrow before submitting, **Then** they return to the detail. Entered values are discarded.

**Errors**

- [ ] **Given** the submit fails with `403` and body `code = 'event_participation_rule_violation'` with a non-empty `failures[]`, **Then** the eligibility dialog opens (`isSelf = true`) and the user stays on the step and can retry:
  - All failures are fixable (`birthdate_missing`, `gender_missing`) → title "Daten ergänzen", intro "Für deine Anmeldung fehlen noch Angaben:", date/gender inputs, note "Diese Angaben kannst du nur einmal selbst setzen.", action "Speichern & anmelden".
  - Otherwise → title "Teilnahme nicht möglich", intro "Du erfüllst die Teilnahmebedingungen dieser Veranstaltung nicht:", and one line per failure (`eventDetailShell.eligibility.<code>`, e.g. "Mindestalter {{minAge}} Jahre nicht erreicht.").
  - **Backend reality:** participation rules (age/gender) are enforced only for **client** registrations (`audience = 'clients'`). The staff endpoints never return this code, so in the teamspace the dialog is a defensive fallback. Angular's "Speichern & anmelden" writes via the client-portal eligibility endpoint, which does not apply to employees, and the teamspace page ignores the dialog's retry result. **Flutter:** handle the code with the explain-only variant (list of reasons, "Schließen"), with no set-once form. Open product question: should age/gender rules apply to staff at all (Asana "Entscheidungen offen")?
- [ ] **Given** a series-mode submit fails with `400` and `code = 'series_already_registered'`, **Then** Flutter shows "Du bist bereits für diese Reihe angemeldet." (`eventDetailShell.messages.seriesAlreadyRegistered`). Angular shows the generic message here.
- [ ] **Given** any other error (`400` already registered, `403` closed/full without waitlist, `404`, network), **Then** a snack bar says "Anmeldung fehlgeschlagen." ("Schließen", 6 s). The user stays on the step with their values and can retry.

**Series mode ("Modus B", `event.series.registration_mode = 'series'`)**

- [ ] **Given** the event is an occurrence of a series in series mode, **Then** one registration covers **all** occurrences. Capacity, approval and waitlist come from the **series** (`series.max_participants`, `series.current_participants_count`, `series.requires_approval`, `series.waitlist_enabled`), not from the occurrence. The seats row, banner, CTA label and the "full" state are all derived from these values.
- [ ] **Given** series mode, **Then** the submit goes to `POST /events/series/:seriesId/register` with the same body. The single-event endpoint refuses such occurrences with `400 SERIES_REGISTRATION_REQUIRED`.
- [ ] **Given** series mode, **Then** the backend checks: the series has at least one future occurrence (else `403`), the series deadline has not passed (else `403`), no live registration exists (else `400 series_already_registered`), the custom fields are valid against the first future occurrence (else `400`), and the series is not full without a waitlist (else `403`). A cancelled or rejected registration is revived instead of duplicated.
- [ ] **Given** series mode is `per_occurrence` or there is no series, **Then** the occurrence registers like a single event.

**Re-registration**

- [ ] **Given** the user's previous registration was cancelled or rejected, **Then** registering again revives it (fresh status, capacity and waitlist rules apply, new custom field values replace the old ones). The detail offers "Jetzt anmelden" again for these statuses.

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
| Register: loading | `/anmelden` opened, event pending | "Laden..." | — |
| Register: load error | Event fetch failed / unknown id | "Veranstaltung konnte nicht geladen werden" | — |
| Register: step | Event loaded | Header, banner (waitlist/approval), person card + fields, CTA; event card | Focus moves to the step heading |
| Register: submitting | CTA pressed | Spinner in CTA, CTA disabled | — |
| Register: success | Submit OK | Success title/body by result + back button | `role="status"`, focus on title |
| Register: error | Submit failed | Snack bar or eligibility dialog; step stays | — |

## Non-Goals

- **Registering other people** from the teamspace (staff register themselves only; staff-register-for-others lives in verwaltung / the participants dialog).
- **Editing an existing registration** (custom field values) from the registration page.

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

- **Not cached (deliberate, WP3).** List and detail load online only; offline the list/detail show the error state with a retry, and a failed pull-to-refresh keeps the already shown data and says so (snack bar). No app module caches server lists yet (news, feed and calendar are online-only too) and the web build has no offline storage; an event cache would follow a shared caching pattern (encrypted per-tenant storage, `tagea_storage`) once one exists.
- Angular has no event cache either: only the web service worker's generic `/api/**` freshness cache (1 h, not active in the native apps).
- RSVP actions require online; no queue. The registration page needs the network for load and submit; offline the load error or the "Anmeldung fehlgeschlagen." snack bar is shown, and values entered before the submit stay on the page.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts)
- **Detail:** [`events-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-detail.component.ts)
- **Editor:** [`events-editor.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-editor.component.ts)
- **Registration page:** [`events-register.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-register.component.ts), wizard `shared/events/registration/**` (`wizard/event-registration-wizard.component.ts`, `state/wizard-machine.ts`, `success/registration-success.component.ts`), eligibility dialog `shared/events/event-eligibility-dialog/event-eligibility-dialog.component.ts`
- **Verwaltung:** [`events-verwaltung.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-verwaltung.component.ts)
- **Services:** `EventsService`, `TeamspaceService`, `ContextChangeService`
- **Card:** `EventArticleCardComponent`
- **Model:** `EventWithRegistration` (from `apps/tagea-frontend/src/app/models/event.model.ts`)
- **E2E tests:** `apps/tagea-frontend-e2e/src/tests/teamspaces/events/event-registration-page-ui.spec.ts` (approved, required custom field, approval → pending), `mobil-mitarbeitende-veranstaltung-anmeldung.spec.ts` (mobile layout + counter)
- **Backend endpoints:** see [contracts.md](./contracts.md)
