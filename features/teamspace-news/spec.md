# Feature: Teamspace News

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

News list for staff scoped to their teamspaces. Filter chips per teamspace, text search with debounce, and Material display cards — on tap, opens the shared [News Detail](../news-detail/spec.md) in `teamspace` context.

## User Stories

- As a **staff member** I want to browse news across my teamspaces, so that I stay informed about announcements.
- As a **staff member** I want to search news by text, so that I can find previously-read content fast.
- As a **staff member** I want to filter by teamspace, so that I can focus on content from a specific context.

## Acceptance Criteria

### List (`/teamspace/news`)

- [ ] **Given** the user opens the page, **When** `ArticleService` + `TeamspaceService` resolve, **Then** articles render as `NewsDisplayCardComponent` cards.
- [ ] **Given** the user has multiple teamspaces with the news module active, **When** teamspace filter chips render, **Then** one chip per teamspace where `is_active && active_modules.news === true` appears (plus a leading "Alle" chip).
- [ ] **Given** a teamspace chip is selected, **When** the selection commits, **Then** the list reloads with the selected `teamspace_ids` filter (multi-select supported).
- [ ] **Given** the user selects a single category chip, **When** the selection commits, **Then** `category_id` is passed to the backend; multiple selected categories are filtered client-side.
- [ ] **Given** the user types in the search field, **When** they pause (debounce ~300ms), **Then** the server performs a title+content match and the list updates.
- [ ] **Given** the user has a redaktion role in any teamspace (or is super admin), **When** the page renders, **Then** a "Redaktion" button (desktop) and a FAB (mobile) link to `/teamspace/redaktion`.
- [ ] **Given** the user taps a card, **When** navigation resolves, **Then** open `/teamspace/news/:id`.
- [ ] **Given** the user scrolls near the list end, **When** the intersection observer fires, **Then** the next page is appended (infinite scroll, batch size 12).

### Detail (`/teamspace/news/:id`)

Shared `SharedNewsDetailComponent` with `data.context: 'teamspace'` — see [news-detail spec](../news-detail/spec.md).

## UI States

| State     | When?                    | What does the user see?                   | A11y notes      |
| --------- | ------------------------ | ----------------------------------------- | --------------- |
| Loading   | Initial fetch            | Spinner                                   | `role="status"` |
| Searching | Debounced search         | Search icon → inline spinner              | —               |
| Empty     | No matches after filters | Empty state + "Filter zurücksetzen"       | —               |
| Populated | Cards rendered           | Chips + search + card grid + FAB (mobile) | —               |
| LoadMore  | Infinite scroll trigger  | Bottom spinner while next page loads      | —               |
| Error     | Fetch failure            | Error logged; state returns to populated  | —               |

## Non-Goals

- **Article editing / publishing** — owned by Redaktion (see inventory).
- **Cross-teamspace bulk operations** — not in scope.

## Edge Cases

- **Secure cover images** — `SecureImageService.loadImage(url)` returns `SafeUrl`; cards consume it via `[src]` binding with auth headers applied upstream.
- **No teamspaces** — the user is likely on the wrong page; handled by `tenantPermissionGuard` at route level (redirects out if `teamspace_news.view` is missing).
- **Translations** — articles are backend-translated; `LanguageService.currentLanguage()` flows into the service request.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_news.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Institution context:** derived from teamspace scoping.

## Notifications (Push / In-App)

- New article → increments teamspace unread count on [teamspace-home](../teamspace-home/spec.md).
- Push notifications for new articles deep-link to the detail route.

## i18n Keys

> User-facing strings remain in German.

- `newsPage.title`, `.subtitle`, `.helpTooltip`, `.redaktionButton`
- `newsPage.search.label`, `.search.placeholder`
- `newsPage.loading`, `.allNews`, `.resetFilters`
- `newsPage.empty.title`, `.empty.message`
- `common.all` (chip label for the "Alle" filter)

## Offline Behavior

**Flutter-specific:**

- Cached article list offline; search requires online.
- Secure images cached with auth headers (Dio + `CachedNetworkImage`).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts)
- **Detail component:** see [news-detail spec](../news-detail/spec.md)
- **Services:** `ArticleService`, `TeamspaceService`, `SecureImageService`, `UnifiedAuthService`, `LanguageService`, `TranslocoService`
- **Card component:** `NewsDisplayCardComponent` (`NewsDisplayCardData` input)
- **Filter chips:** `TageaFilterChipsComponent` with `FilterChip[]` (one row for teamspaces, one for categories)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
