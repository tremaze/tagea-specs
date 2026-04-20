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
- [ ] **Given** the user has multiple teamspaces, **When** filter chips render, **Then** one chip per accessible teamspace appears with unread count badges.
- [ ] **Given** a teamspace chip is selected, **When** the selection commits, **Then** the list filters to articles tagged with that teamspace.
- [ ] **Given** the user types in the search field, **When** they pause (debounce ~300ms), **Then** the server performs a full-text search and the list updates.
- [ ] **Given** the user taps a card, **When** navigation resolves, **Then** open `/teamspace/news/:id`.

### Detail (`/teamspace/news/:id`)

Shared `SharedNewsDetailComponent` with `data.context: 'teamspace'` — see [news-detail spec](../news-detail/spec.md).

## UI States

| State     | When?                    | What does the user see?       | A11y notes      |
| --------- | ------------------------ | ----------------------------- | --------------- |
| Loading   | Initial fetch            | Spinner                       | `role="status"` |
| Searching | Debounced search         | Search icon → inline spinner  | —               |
| Empty     | No matches after filters | Empty state + "clear filters" | —               |
| Populated | Cards rendered           | Chips + search + card grid    | —               |
| Error     | Fetch failure            | Error panel + retry           | `role="alert"`  |

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

- `newsPage.title`, `.subtitle`, `.helpTooltip`
- Rest owned by the template and child components.

## Offline Behavior

**Flutter-specific:**

- Cached article list offline; search requires online.
- Secure images cached with auth headers (Dio + `CachedNetworkImage`).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts)
- **Detail component:** see [news-detail spec](../news-detail/spec.md)
- **Services:** `ArticleService`, `TeamspaceService`, `SecureImageService`, `UnifiedAuthService`, `LanguageService`
- **Card component:** `NewsDisplayCardComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
