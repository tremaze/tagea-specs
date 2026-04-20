# Feature: Client News

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Clients read news articles published by their institution or teamspace. The list supports hierarchical category filters (root + subcategories) and full-text search. Tapping an article opens the shared [News Detail](../news-detail/spec.md) view in client-portal context.

## User Stories

- As a **client** I want to see news relevant to me, so that I stay informed about institution updates and announcements.
- As a **client** I want to filter by category and subcategory, so that I can focus on topics I care about.
- As a **client** I want to search news, so that I can quickly find a previously-seen article.

## Acceptance Criteria

### List (`/client-portal/news`)

- [ ] **Given** the page loads, **When** the fetch resolves, **Then** articles render as `NewsDisplayCardComponent` cards with title, excerpt, author, cover image, and like/comment metadata.
- [ ] **Given** category chips load, **When** categories exist, **Then** root categories render as a single-select chip row.
- [ ] **Given** a root category has children, **When** it is selected, **Then** subcategory chips render (indented, multi-select).
- [ ] **Given** subcategories are selected, **When** the selection changes, **Then** articles are filtered to match any of the selected subcategories within the active root category.
- [ ] **Given** the search field receives input, **When** the user pauses typing (debounce ~300ms), **Then** the server performs a full-text search and the list updates.
- [ ] **Given** the user taps a card, **When** navigation resolves, **Then** open `/client-portal/news/:id`.

### Detail (`/client-portal/news/:id`)

Shared `SharedNewsDetailComponent` with `data.context: 'client-portal'` — see [news-detail spec](../news-detail/spec.md).

## UI States

| State             | When?                     | What does the user see?              | A11y notes      |
| ----------------- | ------------------------- | ------------------------------------ | --------------- |
| Loading (initial) | First fetch               | Spinner + label                      | `role="status"` |
| Searching         | Active search debounce    | Search icon swaps to spinner         | —               |
| Empty             | No articles match filters | Empty state + "clear filters" action | —               |
| Populated         | Cards render              | Filter chips + cards grid            | —               |
| Error             | Fetch failure             | Error block                          | `role="alert"`  |

## Non-Goals

- **Commenting** — not implemented in client portal.
- **Sharing via social** — not required for MVP.
- **Infinite scroll** — verify: list currently appears paginated by explicit "load more" or fully loaded; confirm vs. implementation.

## Edge Cases

- **Like toggling** — executed from `NewsDisplayCardComponent`; uses `ClientNewsService.likeArticle()`. Already specced on the dashboard card.
- **Secure images** — cover images require auth; `SecureImageService` fetches them as `SafeUrl` (not directly via `<img src>`).
- **Hierarchical categories with no children** — subcategory row is hidden.
- **Search + category filter** — both apply AND-style.
- **Translations** — articles are translated server-side; `ClientNewsService` passes `lang` query param implicitly.

## Permissions & Tenant/Institution

- **Required roles:** Client (via `clientPortalGuard`).
- **Institution context:** server-resolved; no URL scoping.
- **Backend access checks:** `ClientNewsService` returns only articles targeted at the calling client's cohort.

## Notifications (Push / In-App)

- New articles increment the "News" unread count on the [Client Dashboard](../client-dashboard/spec.md).
- Auto-mark-as-seen fires on dashboard scroll; direct navigation to an article also marks it read via `markAsSeen(id)` (verify in detail component).

## i18n Keys

> User-facing strings remain in German.

- `clientPortal.neuigkeiten.title`, `.subtitle`, `.helpTooltip`
- `clientPortal.neuigkeiten.search.{label,placeholder}`
- `clientPortal.neuigkeiten.states.{loading,error,empty}` (verify in template)

## Offline Behavior

**Flutter-specific:**

- Cache articles + category list locally; search requires online.
- Cover images cached via `CachedNetworkImage` (but secure-image auth must flow through Dio).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/client-portal/client-news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-news-page.component.ts)
- **Card:** `NewsDisplayCardComponent`
- **Detail component:** see [news-detail/spec.md](../news-detail/spec.md)
- **Service:** `ClientNewsService`, `SecureImageService`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
