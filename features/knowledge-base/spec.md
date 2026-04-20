# Feature: Knowledge Base (Cross-Cutting)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Searchable knowledge-article catalog — browsing, filtering, and reading of editorial articles. The list renders categories (tenant-local + "global" system articles mixed), a search, and `ArticleCardComponent` cards; tapping a card opens the article-detail route with the full body.

## Modes

**The component is mounted at two routes** with identical behavior (the route parent decides context):

| Mount       | Route                                           | Notes                                                        |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------ |
| Institution | `/einrichtung/:institutionId/knowledge-base/**` | Staff context                                                |
| Teamspace   | `/teamspace/knowledge-base/**`                  | Teamspace context (requires `teamspace_knowledge_base.view`) |

The same `KnowledgeBasePageComponent` + `ArticleDetailPageComponent` run in both. Article navigation uses **Angular relative routing** (`router.navigate(['article', articleId], { relativeTo: this.route })`); the absolute path resolves automatically based on the active mount — no mount-specific branching inside the component.

## User Stories

- As a **staff member** I want to search articles across categories, so that I find reference material fast.
- As a **staff member** I want categories grouped with counts, so that I can browse by topic.
- As a **staff member** I want to see both tenant-specific and global (system-provided) articles, so that I benefit from shared knowledge.

## Acceptance Criteria

### List + search

- [ ] **Given** the page loads, **When** `ArticleService.getArticles({ article_type: ArticleType.KNOWLEDGE, ... })` + `GlobalArticleService.getCategories(...)` resolve, **Then** cards render in a responsive grid with title, excerpt (`getArticleExcerpt`), author, date (`formatArticleDate`), and category badge.
- [ ] **Given** articles include both local and global entries, **When** they are merged, **Then** each card carries an `is_global` flag that drives a distinct badge/icon.
- [ ] **Given** the search input receives text, **When** the user pauses (debounce), **Then** `combineLatest` updates both local and global queries and re-renders.
- [ ] **Given** category chips render, **When** multiple levels exist, **Then** hierarchical `CategoryWithIcon` with children + `articleCount` is shown; selecting a parent filters to its subtree.
- [ ] **Given** the viewport is mobile, **When** the FAB is tapped, **Then** `KBSimpleFiltersBottomSheetComponent` opens.

### Detail (`.../article/:id`)

- [ ] **Given** an article id is present, **When** `ArticleDetailPageComponent` loads, **Then** title, body, author, attachments, and (if configured) acknowledgment affordance render.

## UI States

| State     | When?                  | Rendering                     |
| --------- | ---------------------- | ----------------------------- |
| Loading   | Initial fetch          | Spinner                       |
| Empty     | No matches for filters | Empty state + "clear filters" |
| Populated | Cards visible          | Chips + grid + (mobile) FAB   |
| Error     | Fetch failure          | Error panel + retry           |

## Non-Goals

- **Article editing / publishing** — owned by Redaktion (see [redaktion](../redaktion/spec.md)).
- **Favoriting** — not implemented.
- **Offline article cache** — Flutter-side concern.

## Edge Cases

- **Tenant without any local articles** — only global articles show; category chips reflect global-only counts.
- **`is_global` + same title collision** — no dedup; both cards render.
- **Hierarchical category with no articles** — chip still shows with `articleCount: 0`.
- **Permission gap:** the route only sets `requiredTenantPermission` for the teamspace mount; institution mount has no permission data entry — access is via `institutionUrlGuard` only.

## Permissions & Tenant/Institution

| Mount                                | Guards                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `/einrichtung/:id/knowledge-base/**` | `institutionUrlGuard` (via parent `INSTITUTION_PARENT_ROUTE`)                       |
| `/teamspace/knowledge-base/**`       | `tenantPermissionGuard` (`teamspace_knowledge_base.view`) + `teamspaceFeatureGuard` |

## Notifications (Push / In-App)

- Not a primary push target. New-article notifications typically deep-link to [news-detail](../news-detail/spec.md) (articles that were published as news), not the knowledge-base.

## i18n Keys

> User-facing strings remain in German. Owned by the external template.

## Offline Behavior

**Flutter-specific:**

- Cached article list offline; search requires online.
- Cover images / attachments need auth-aware caching.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts)
- **Detail:** [`article-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/article-detail-page.component.ts)
- **Services:** `ArticleService`, `GlobalArticleService`
- **Card:** `ArticleCardComponent`
- **Models:** `Article`, `GlobalArticle`, `GlobalArticleCategory`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
