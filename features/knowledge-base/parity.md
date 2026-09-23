# Parity: Knowledge Base

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts)
- **Detail:** [`article-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/article-detail-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🔍 In review — [tagea-next-flutter#69](https://github.com/tremaze/tagea-next-flutter/pull/69) (teamspace mount only)
- **Path:** `apps/tagea_frontend/lib/features/teamspace/knowledge_base/` (list, filter sheet, detail at `/teamspace/knowledge-base/article/:id`)
- **Data layer:** `packages/teamspace_core` — `KnowledgeBaseApi`, `KnowledgeBaseCubit`, `KnowledgeArticleRepository` (detail reuses the news-detail cubit/body)
- **Integration tests:** widget tests under `apps/tagea_frontend/test/features/teamspace/knowledge_base/`
- **Not yet ported:** manage FAB (Redaktion), helpful/not-helpful feedback, related articles, version history, table of contents, video, share/print; rich-HTML body (plain text for now)

## Known Divergences

| Topic                | Angular                                                                     | Flutter                                        |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Local + global merge | `combineLatest` of two observables                                          | `KnowledgeBaseCubit` awaits both sources (`Future.wait`), global is best effort; merged newest first |
| Category hierarchy   | Flat list + `parent_id`, drill-down via query param                         | Same flat list; parent drill-down in cubit state; system back steps up one level |
| Mobile filters sheet | `KBSimpleFiltersBottomSheetComponent` (dropdown)                            | `showTageaBottomSheet` with an indented radio tree, actions pinned |
| Paging               | `fetchAllPages` (limit 100) per category; first page only for a plain search | All pages (limit 100, max 10 per source) in both cases; UI notes a capped count |
| Article body         | Sanitised rich HTML                                                         | Plain text with tappable http(s) links until the shared rich-HTML renderer lands |
| Navigation after tap | `institutionRoute(id, 'knowledge-base', 'article', :id)` vs teamspace route | Teamspace mount only: `/teamspace/knowledge-base/article/:id` |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude   | Spec aligned with Angular (single-category filter, no `articleCount`, filter button); Flutter teamspace port in review (#69) |
