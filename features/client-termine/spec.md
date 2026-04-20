# Feature: Client Termine

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Clients see all their appointments in one place with filter chips (all / upcoming / past / cancelled), optionally scoped to a week via a sidebar mini-calendar. They can open an appointment for detail + cancellation, or start a booking flow to request a new one.

## User Stories

- As a **client** I want to see all my appointments in a list, so that I know what's coming up and what I've already done.
- As a **client** I want to filter by upcoming / past / cancelled, so that I can quickly find the relevant ones.
- As a **client** I want to scope the view to a specific week, so that I can focus on a particular timeframe.
- As a **client** I want to book a new appointment, so that I don't have to call my caseworker.
- As a **mobile client** I want an infinite-scroll calendar view, so that browsing feels natural on a phone.

## Acceptance Criteria

### List Page (`/client-portal/termine`)

- [ ] **Given** the user opens the Termine page, **When** it loads, **Then** appointments load paginated (page size 20) and render as feed cards, sorted by date.
- [ ] **Given** the user selects a status chip (`all`/`upcoming`/`past`/`cancelled`), **When** the filter applies, **Then** visible cards are filtered client-side using `sortDate` vs. now and the cancelled-status marker.
- [ ] **Given** the desktop sidebar mini-calendar, **When** the user picks a date, **Then** the list is additionally scoped to that ISO week (Monday-start) and a removable week-filter chip appears.
- [ ] **Given** the user reaches the bottom scroll sentinel, **When** more pages exist, **Then** the next page (`PAGE_SIZE=20`) is loaded and appended.
- [ ] **Given** a feed card is clicked, **When** navigation resolves, **Then** open `/client-portal/termine/:id`.
- [ ] **Given** the "Book appointment" button (desktop header or mobile FAB) is pressed, **When** the click fires, **Then** navigate to `/client-portal/termine/buchen`.
- [ ] **Given** the viewport is `max-width: 768px`, **When** the page renders, **Then** the desktop sidebar is replaced by `app-mobile-calendar` with infinite-scroll of days; tapping a calendar event opens `/client-portal/termine/:id`.

### Booking Page (`/client-portal/termine/buchen`)

- [ ] **Given** the user enters the booking flow, **When** the page loads, **Then** a multi-step process is shown (category selection → slot selection → category-specific form → confirmation).
- [ ] **Given** an appointment category is selected, **When** it has configured required fields (checkboxes / text / dropdown / file upload), **Then** those fields render in the form step.
- [ ] **Given** the user picks an available slot, **When** the slot is valid, **Then** it becomes the pending booking subject.
- [ ] **Given** the form is valid and submitted, **When** the booking succeeds, **Then** show a success snackbar and navigate back to `/client-portal/termine`.
- [ ] **Given** the user aborts via back-navigation, **When** they leave mid-flow, **Then** no booking is created.

### Detail (`/client-portal/termine/:id`)

Shared `AppointmentDetailComponent` in client mode — see the [appointment-detail spec](../appointment-detail/spec.md) for detailed behavior.

## UI States

| State        | When?                         | What does the user see?               | A11y notes      |
| ------------ | ----------------------------- | ------------------------------------- | --------------- |
| Loading      | Initial load                  | Spinner + loading label               | `role="status"` |
| Loading more | Infinite scroll               | Small spinner at sentinel             | —               |
| Error        | Fetch failure                 | Error icon + localized error text     | `role="alert"`  |
| Empty        | No appointments after filters | Icon + explanation + "Book first" CTA | —               |
| Populated    | Cards present                 | Feed cards + (optional) week chip     | —               |
| All loaded   | Paginated through all         | "All appointments loaded" footer      | —               |

## Flows

```
Client Dashboard ── card click (appointment) ──▶ /client-portal/termine/:id
                                         │
Client Dashboard ── "Book appointment" ──▶ /client-portal/termine/buchen
                                         │                             │
                                         │                             ▼
                                         │                     booking wizard
                                         │                             │
                                         │                             ▼
                                         │                    submit → snackbar
                                         │                             │
                                         ▼                             ▼
                                  /client-portal/termine ◀──────────────
```

## Non-Goals

- **Rescheduling** from the list — only cancellation is supported; reschedule requires a new booking.
- **Inline editing of appointment details** — read-only in the list view.
- **Calendar drag-to-reschedule** — appointments are immutable once booked.

## Edge Cases

- **Translations:** `display_title` > `title`; `lang` param passes `LanguageService.currentLanguage()`.
- **Managed-client context:** appointments can belong to a managed client (parent/guardian viewing on behalf). Cards propagate `managedClientId` as query param when opening detail.
- **Cancelled status detection:** cards set a `footerMetadata` item with `icon === 'event_busy'` to mark cancelled; filter logic checks for that marker rather than a canonical status enum.
- **Week filter + status filter stack:** both filters apply simultaneously and are ANDed together.
- **Scroll trigger re-registration:** the IntersectionObserver is disposed and re-attached on each paginated load because the DOM element is re-created.
- **"Past" filter includes read cards regardless of date:** the current filter logic is `(sortDate <= now) || card.isRead`. That means a future appointment auto-marked as read on the dashboard will appear in the "Past" filter. This is the existing behavior; Flutter should replicate it verbatim (or explicitly decide to fix it — flag for product).

## Permissions & Tenant/Institution

- **Required roles:** Client (gated by `clientPortalGuard`).
- **Institution context:** resolved server-side from the authenticated client's assignment.
- **Backend access checks:** the `ClientAppointmentsService` only returns appointments for the calling client (or their managed clients).

## Notifications (Push / In-App)

- `APPOINTMENT_INVITATION` and `APPOINTMENT_REMINDER` push notifications deep-link to `/client-portal/termine/:id`, not to this list.
- List page does not react to push notifications directly — users reload or re-enter the page to see newly-added appointments.

## i18n Keys

> User-facing strings remain in German.

- `clientPortal.termine.title`, `.subtitle`, `.helpTooltip`
- `clientPortal.termine.filterChips.{all,upcoming,past,cancelled}`
- `clientPortal.termine.buttons.{book,bookFirst}`
- `clientPortal.termine.states.{loading,error,empty,allLoaded}`
- `clientPortal.termineNeu.*` (booking wizard)

## Offline Behavior

**Flutter-specific:**

- Cached list visible offline; infinite scroll disabled; "offline" chip shown.
- Booking page requires network — show offline error if the user tries to start a booking without connectivity.
- Cancellations made offline should queue and flush on reconnect (or simply block — simpler).

## References

- **Angular implementation (list):** [`apps/tagea-frontend/src/app/pages/client-portal/client-termine-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-termine-page.component.ts)
- **Angular implementation (booking):** [`apps/tagea-frontend/src/app/pages/client-portal/client-termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-termine-neu.component.ts)
- **Detail component:** see [appointment-detail/spec.md](../appointment-detail/spec.md)
- **Services:** `ClientAppointmentsService`, `ClientBookingService`
- **Shared components:** `TermineSidebarComponent`, `MobileCalendarComponent`, `TageaFeedCardComponent`, `TageaFilterChipsComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
