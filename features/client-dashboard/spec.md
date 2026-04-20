# Feature: Client Dashboard

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

The home screen of the Client Portal. Presents an aggregated, chronologically ordered feed of the client's relevant content (appointments, news, messages) with content-type filter chips, plus a sidebar with the next appointment, quick actions, pending signature tasks, and recent submissions. On mobile, the sidebar collapses into a bottom-sheet.

## User Stories

- As a **client** I want one place to see everything relevant to me, so that I don't have to navigate between Termine, News, Nachrichten separately just to catch up.
- As a **client** I want to filter the feed by content type, so that I can focus on just appointments or just news when needed.
- As a **client** I want my next appointment surfaced prominently, so that I'm reminded of upcoming commitments without hunting for them.
- As a **client with pending document signatures** I want a clear call-to-action, so that I don't miss time-critical signature tasks.
- As a **client** I want content I've viewed to be automatically marked as read, so that unread counts reflect what I actually still need to look at.

## Acceptance Criteria

### Loading

- [ ] **Given** the user lands on `/client-portal`, **When** the page loads, **Then** a spinner is shown while five data sources load in parallel (feed, next appointment, submissions, pending signatures, unread counts).
- [ ] **Given** any sub-load fails, **When** the error is observed, **Then** an error state is shown for the affected section while other sections remain visible.

### Filter Chips

- [ ] **Given** the feed loaded, **When** the user sees filter chips, **Then** the chips are: "All", "Appointments", "News", "Documents", and conditionally "Messages" (only if `client_messages` tenant feature is enabled).
- [ ] **Given** a chip has unread items, **When** it is rendered, **Then** a numeric badge shows the unread count.
- [ ] **Given** "All" is selected, **When** the user clicks another chip, **Then** "All" is deselected and only that chip becomes active.
- [ ] **Given** a non-"All" chip is selected, **When** the user clicks a different chip, **Then** selection swaps (the `TageaFilterChipsComponent` is bound with `[multiSelect]="false"`; only one non-"All" chip is active at a time).
- [ ] **Given** all non-"All" chips are deselected, **When** the selection becomes empty, **Then** "All" is re-selected automatically.
- [ ] **Given** the filter selection changes, **When** the change is committed, **Then** the feed reloads from page 1 for each active source.

### Feed

- [ ] **Given** the feed loaded, **When** cards render, **Then** they are sorted by date newest-first across all content types.
- [ ] **Given** cards are mixed types (appointment / news / message), **When** cards are rendered, **Then** each shows the correct type-specific styling and metadata (time for appointments, author+likes for news, sender for messages).
- [ ] **Given** the user scrolls to the bottom sentinel, **When** pagination has more data, **Then** the next page is loaded in parallel for each source that still has more.
- [ ] **Given** all sources are exhausted, **When** another scroll-to-bottom fires, **Then** no further requests are made and `allLoaded` is set.
- [ ] **Given** deduplication by `sourceId`, **When** paginated data repeats, **Then** duplicates are filtered out.

### Read-Status Tracking

- [ ] **Given** a feed card becomes 50%+ visible in the viewport, **When** the IntersectionObserver fires, **Then** the card is marked as read locally _and_ persisted via the appropriate per-content-type `markAsSeen` call.
- [ ] **Given** a card is already read, **When** it scrolls back into view, **Then** no redundant network call is made.
- [ ] **Given** a card is marked read, **When** local state updates, **Then** the corresponding chip badge decrements to reflect the new unread count.

### Next Appointment Card

- [ ] **Given** the client has upcoming `scheduled` appointments, **When** the page loads, **Then** the earliest future appointment is shown in the sidebar with date, time, title, and location.
- [ ] **Given** the client has no upcoming appointments, **When** the page loads, **Then** the next-appointment card hides or shows an empty state.

### Quick Actions

- [ ] **Given** quick link "Termin buchen" is clicked, **When** the link is activated, **Then** navigate to `/client-portal/termine/buchen`.
- [ ] **Given** quick link "Dokument hochladen" is clicked, **When** activated, **Then** navigate to `/client-portal/dokumente`.

### Pending Signatures

- [ ] **Given** the client has pending signature tasks, **When** the page loads, **Then** the sidebar shows up to 3 pending documents + a total count, with a "View all" action that routes to `/client-portal/dokumente`.

### Mobile

- [ ] **Given** the viewport is `max-width: 599px`, **When** `isMobile` is true, **Then** the sidebar collapses, and a FAB opens a bottom-sheet with the sidebar content.
- [ ] **Given** the user selects an action in the bottom-sheet, **When** the sheet dismisses, **Then** the corresponding handler runs (quick link, book appointment, view signatures).

### Navigation from Cards

- [ ] **Appointment card** → `/client-portal/termine/:id` (plus `?managedClientId=…` if applicable).
- [ ] **News card** → `/client-portal/news/:id`.
- [ ] **Message card** → `/client-portal/nachrichten/:id`.

### Likes (News only)

- [ ] **Given** the thumb-up footer item on a news card is tapped, **When** the like endpoint responds, **Then** `isLiked` and `likeCount` update in place.

## UI States

| State                   | When?                                 | What does the user see?                | A11y notes               |
| ----------------------- | ------------------------------------- | -------------------------------------- | ------------------------ |
| Loading                 | `isLoading=true`                      | Full-page spinner                      | `role="status"`          |
| Error                   | `error()` is set                      | Error block + retry                    | `role="alert"`           |
| Empty                   | `feedCards().length === 0` after load | Empty-state illustration + explanation | —                        |
| Populated               | `feedCards().length > 0`              | Filter chips + feed + sidebar/FAB      | —                        |
| Infinite-scroll loading | `paginationState.loading`             | Small spinner at scroll sentinel       | Announce via live region |

## Flows

### Feed composition

```
Page Load
    │
    └─▶ Promise.all([
          loadFeedContent(),       ← appointments + news + messages (parallel)
          loadNextAppointment(),
          loadRecentSubmissions(), ← currently stub (TODO)
          loadPendingSignatures(),
          calculateUnreadCounts()
        ])
```

### Filter change

```
User toggles chip
    │
    ▼
selectedFilters signal updates
    │
    ▼
loadFeedContent()  (resets pagination + dedup, reloads active sources)
```

## Non-Goals

- **Unified submissions feed** — the sidebar currently has a TODO placeholder; submissions load returns empty. Mark as `❌ Not in this spec`.
- **Documents in the feed** — the "Documents" chip is shown but currently has no card rendering (unread count is hardcoded to 0).
- **Comment threads on news** — handler exists but is a no-op.

## Edge Cases

- **Managed-client view:** if a parent/guardian is viewing on behalf of a client, appointment cards carry a `managedClientId`; navigation must propagate it as a query param so the detail page loads the correct client's context.
- **Translations:** `display_title` (backend-translated) takes precedence over `title`; `LanguageService.currentLanguage()` is passed to appointment/news/message endpoints so the backend returns localized content.
- **Unread count race:** unread counts are calculated once at load time. Post-load reads update local badges only — they are re-fetched only on next reload. Document this, don't fix if not needed.
- **Observer re-registration after re-render:** `setupInfiniteScroll()` is re-called after each feed load because the scroll sentinel element is re-created.
- **Duplicate read-status firing:** `markedAsReadIds` Set prevents re-processing the same card after Angular re-renders.
- **Handler code vs. template binding mismatch:** the `onFilterSelected` handler contains multi-select toggle logic, but the template binds `[multiSelect]="false"` — the template wins, so the feature is effectively single-select. Flutter port should implement single-select to match observed behavior, not the handler's apparent intent.

## Permissions & Tenant/Institution

- **Required roles:** Client (gated by `clientPortalGuard` on the parent route).
- **Institution context:** not encoded in the URL; resolved server-side from the authenticated client's profile.
- **Tenant feature flags:**
  - `client_messages` (`TenantFeaturesService.isClientMessagesEnabled()`) — toggles the Messages chip and message loading.

## Notifications (Push / In-App)

- **In-app unread counts** (`ClientPortalService.getAllUnreadCounts()`) drive the filter chip badges.
- **Auto-mark-as-seen** on scroll persists via:
  - `ClientNewsService.markAsSeen(id)` for news
  - `ClientMessagesService.markAsSeen(id)` for messages
  - `ClientAppointmentsService.markAsSeen(id)` for appointments
- **Push-notification deep-links** to cards land on the respective detail routes, not the dashboard.

## i18n Keys

> User-facing strings remain in German.

- `clientPortal.dashboard.filterChips.{all,appointments,news,documents,messages}`
- `clientPortal.dashboard.quickLinks.{bookAppointment,uploadDocument}`
- `clientPortal.dashboard.sidebar.{noLocation,requestsError}`
- `clientPortal.dashboard.states.error`

## Offline Behavior

**Flutter-specific:**

- Offline: show cached feed with "last updated X ago" banner; disable pagination and like button; `markAsSeen` calls queue locally and flush on reconnect.
- Pending-signature count should persist to local storage so the red badge still shows offline.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/client-portal/client-portal-dashboard.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-portal-dashboard.component.ts)
- **Shared components:** `TageaFeedCardComponent`, `TageaFilterChipsComponent`, `TageaAppointmentCardComponent`, `TageaSidebarCardComponent`, `TageaQuickLinksComponent`, `TageaSubmissionItemComponent`, `ClientPortalMobileSheetComponent`
- **Services:** `ClientAppointmentsService`, `ClientNewsService`, `ClientMessagesService`, `ClientDocumentService`, `ClientPortalService`, `TenantFeaturesService`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
