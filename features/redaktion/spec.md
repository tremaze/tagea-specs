# Feature: Redaktion (Editor) — Cross-Cutting

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Editorial surface for creating, publishing, and managing news articles. A list view with filters, sorting, stats cards, and category navigation; plus a create/edit page. Same component is mounted three times with different target audiences.

## Modes

**`RedaktionPageComponent` + `RedaktionEditorComponent` are mounted at three routes:**

| Mount                 | Route                                          | Notes                                                                             |
| --------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Teamspace Redaktion   | `/teamspace/redaktion/**`                      | Gated by `teamspaceEditorGuard` + `teamspaceFeatureGuard`                         |
| Institution Redaktion | `/einrichtung/:institutionId/redaktion/**`     | Gated by `teamspaceEditorGuard`                                                   |
| Klienten-News         | `/einrichtung/:institutionId/klienten-news/**` | Gated by `permissionGuard` (`client_news.view`), `data.targetAudience: 'clients'` |

The component reads the current URL and/or route data to decide which article scope to list and which audience to target on save.

## User Stories

- As a **teamspace editor** I want to create/edit news articles for my teamspace, so that I can communicate with colleagues.
- As an **institution editor** I want to manage institution-level articles, so that I can publish internally.
- As a **client-news editor** I want to write articles that go to clients, so that I can reach the client portal audience.

## Acceptance Criteria

### List

- [ ] **Given** the page loads, **When** the mount-specific list method resolves, **Then** articles render via `NewsArticleCardComponent` with filters (status, type, date range, category). Dispatch is driven by `isClientNewsMode()` (`targetAudience === 'clients'`): only the klienten-news mount calls `ArticleService.getInstitutionEditorialArticles(institutionId, filters)`; both the teamspace and institution redaktion mounts call `ArticleService.getEditorialArticles(filters)`.
- [ ] **Given** `NewsFilter` is applied, **When** filters change, **Then** the list reloads.
- [ ] **Given** `NewsSortOptions` is active, **When** sort changes, **Then** the list reorders.
- [ ] **Given** `RedaktionStatsComponent` + `RedaktionCategoriesComponent` render above the list, **When** data resolves, **Then** stats tiles + category navigation show.
- [ ] **Given** the user is on mobile, **When** the FAB fires, **Then** `RedaktionFiltersBottomSheetComponent` opens.

### Editor (`neu` and `bearbeiten/:id`)

- [ ] **Given** the route is `neu` (`data.mode === 'create'`), **When** the editor loads, **Then** a blank form renders for a new article.
- [ ] **Given** the route is `bearbeiten/:id` (`data.mode === 'edit'`), **When** the article is fetched, **Then** the form prefills with current values.
- [ ] **Given** the editor is in the klienten-news mount (`data.targetAudience: 'clients'`), **When** save fires, **Then** the article is persisted with a target-audience marker that routes it to the client portal.
- [ ] **Given** the user confirms deletion (via `SimpleConfirmationDialogComponent`), **When** the delete API resolves, **Then** the article is removed and the list reloads.

## UI States

| State                      | When?                | Rendering                          |
| -------------------------- | -------------------- | ---------------------------------- |
| Loading                    | Fetch in-flight      | Spinner                            |
| Populated                  | Articles visible     | Stats + categories + filtered list |
| Empty                      | No matches           | Empty state                        |
| Editor loading (edit mode) | Fetching article     | Spinner inside form                |
| Editor saving              | Submit in-flight     | Disabled form + spinner            |
| Error                      | Fetch / save failure | Snackbar + retry                   |

## Non-Goals

- **Bulk operations** (mass-delete, mass-reassign) — not implemented.
- **Article versioning / revisions** — shown read-only elsewhere (see `ArticleVersionHistoryComponent` under `shared/articles/`).
- **WYSIWYG custom extensions** — the editor uses a standard rich-text pattern.

## Edge Cases

- **Mount discrimination** — the component must inspect the URL or `route.data` to decide the article scope. A naïve port that assumes a single scope would publish to the wrong audience.
- **Acknowledge-required articles** — `requires_acknowledgment` toggle saved on article shape; downstream news-detail handles display.
- **Schedule-ahead publishing** — `scheduledPublishDate` field; verify the editor exposes this on all three mounts (not all audiences may support it).

## Permissions & Tenant/Institution

| Mount         | Guards                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| Teamspace     | `teamspaceEditorGuard`, `teamspaceFeatureGuard`                          |
| Institution   | `teamspaceEditorGuard` (redaktion is a cross-feature surface)            |
| Klienten-News | `permissionGuard` (`client_news.view`), `data.targetAudience: 'clients'` |

## Notifications (Push / In-App)

- New articles trigger push notifications per audience; deep-links land in [news-detail](../news-detail/spec.md) — NOT in Redaktion.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific (if ever ported):**

- Redaktion is an admin/editor surface — **P2 and currently scoped ❌ for Flutter**. The spec exists for documentation; porting is not planned.

## References

- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/redaktion-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/redaktion-page.component.ts)
- **Editor:** [`redaktion-editor.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/redaktion-editor.component.ts)
- **Stats / Categories:** `RedaktionStatsComponent`, `RedaktionCategoriesComponent`
- **Services:** `ArticleService`
- **Models:** `NewsArticleWithMeta`, `NewsFilter`, `NewsSortOptions`, `NewsStatus`
- **Card:** `NewsArticleCardComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
