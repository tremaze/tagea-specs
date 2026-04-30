# Parity: Teamspace News

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts)
- **Detail:** shared `SharedNewsDetailComponent` with `data.context: 'teamspace'`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🚧 List + read-only detail in review (PRs #15–#20 open)
- **Path:** [`apps/tagea_frontend/lib/features/teamspace/news/teamspace_news_page.dart`](../../../apps/tagea_frontend/lib/features/teamspace/news/teamspace_news_page.dart)
- **Detail page:** [`apps/tagea_frontend/lib/features/teamspace/news/detail/teamspace_news_detail_page.dart`](../../../apps/tagea_frontend/lib/features/teamspace/news/detail/teamspace_news_detail_page.dart) — read-only, no shared component yet (no `client-portal` context to share with). Repository abstraction deferred until the second context lands.
- **Domain layer:** [`packages/teamspace_core`](../../../packages/teamspace_core) — `Article`, `ArticleAttachment`, `ArticleAcknowledgmentStatus`, `ArticleCategory`, `NewsListCubit`, `ArticleDetailCubit`
- **Routing:** `/teamspace/news` → list (within shell, bottom-nav visible); `/teamspace/news/:id` → detail (pushed onto root navigator, bottom-nav hidden)
- **Integration tests:** _(planned for `integration_test/teamspace_news_test.dart`)_

## Known Divergences

| Topic                     | Angular                                 | Flutter                                                                                                       |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Search debounce           | RxJS `debounceTime(300)`                | `Timer(_kSearchDebounce)` + `TextEditingController`                                                           |
| Secure cover image        | `SecureImageService.loadImage()` (Blob) | `TageaAuthenticatedImage` → `Image.network` with auth headers; URL absolutised against `TageaConfig.apiBaseUrl` |
| Card                      | `NewsDisplayCardComponent`              | Reuses `TageaFeedCard` widget (visual parity with the home feed)                                              |
| HTML body rendering       | DOM (with sanitiser)                    | `flutter_widget_from_html_core` — inline `<img>` tags stripped (auth-fetched inline images deferred)         |
| Video embed               | iframe / oEmbed                         | YouTube-id-extracted thumbnail card (`i.ytimg.com/.../hqdefault.jpg`) → external launcher                    |
| Bottom-nav on detail page | n/a (web has no bottom nav)             | Detail mounted on root navigator → bottom nav hidden, full-screen reading                                     |

## Out of scope (follow-up tranches)

- **Comments** — `CommentsService` port + side panel / mobile bottom-sheet
- **Inline `<img>` auth-fetch** — Dio + custom `WidgetFactory` for `flutter_widget_from_html_core`
- **Editorial / Redaktion gate** — `AuthorizationStore` port (same gate-set blocks teamspace-home's news-editor quick link)
- **Read-status sweep** — auto-mark on detail load works (debounced via `ReadStatusCubit`); list-page auto-mark-on-scroll is shared with home

## Port Log

| Date       | Who      | What                                                              |
| ---------- | -------- | ----------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                                      |
| 2026-04-30 | sbaumgart | Domain + list page + routing + tests (PRs #15–#18)               |
| 2026-04-30 | sbaumgart | Read-only detail page (PR #19), polish + ack + read-status (#20) |
