# Parity: News Detail

## Angular

- **Status:** ✅ Implemented (shared across teamspace + client-portal)
- **Path:** [`apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts`](../../../apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts)
- **Mount 1:** `/teamspace/news/:id` with `data.context: 'teamspace'`
- **Mount 2:** `/client-portal/news/:id` with `data.context: 'client-portal'`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🚧 Read-only port (teamspace context only) in review (PRs #19, #20 open)
- **Page:** [`apps/tagea_frontend/lib/features/teamspace/news/detail/teamspace_news_detail_page.dart`](../../../apps/tagea_frontend/lib/features/teamspace/news/detail/teamspace_news_detail_page.dart)
- **View:** [`apps/tagea_frontend/lib/features/teamspace/news/detail/view/news_detail_view.dart`](../../../apps/tagea_frontend/lib/features/teamspace/news/detail/view/news_detail_view.dart)
- **Cubit:** `ArticleDetailCubit` in `teamspace_core` — parallel article + attachments load, optimistic like / acknowledgment with rollback
- **Layout:** single column on iPhone (no desktop sidebar yet — comments aren't ported, so no second column to render)
- **Repository abstraction:** **deferred** — only the teamspace context exists in Flutter today. `NewsDetailContext` enum + `NewsDetailRepository` interface land when the client-portal context starts (CLAUDE.md: avoid premature abstraction).
- **Integration tests:** _(planned for `integration_test/news_detail_teamspace_test.dart`)_

## Known Divergences

| Topic                  | Angular                                    | Flutter                                                                                                                                       |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Context discrimination | `route.data.context` string                | n/a — only teamspace today                                                                                                                    |
| Repository injection   | Per-context Angular provider               | Direct `ArticleApi` injection (no abstraction yet)                                                                                            |
| Comments layout        | CSS grid sidebar + mobile bottom-sheet FAB | **Not ported** — comments are a separate tranche                                                                                              |
| Secure cover image     | `SecureImageService` Blob URL              | `TageaAuthenticatedImage` (`Image.network` + auth headers); URL absolutised against `TageaConfig.apiBaseUrl`                                  |
| Inline images in HTML  | Rewritten by `SecureImageService`          | **Stripped** — Flutter `<img>` would fire un-authed; auth-fetch via custom `WidgetFactory` is a follow-up                                     |
| Video embed            | `<iframe>` / oEmbed                        | YouTube-id-extracted thumbnail (`i.ytimg.com/.../hqdefault.jpg`) → tap opens externally via `url_launcher`                                   |
| HTML body              | DOM + sanitiser                            | `flutter_widget_from_html_core` (latest 0.17.x, perfect pub.dev score)                                                                       |
| Acknowledgment chip    | `ArticleDetailShellComponent`-internal     | `_AcknowledgmentRow` — outlined-button CTA when required-not-acknowledged, subtle outlined pill once confirmed                                |
| Read-status mark       | `ContentReadStatusService.markAsRead`      | `ReadStatusCubit.markAsRead(ContentType.article, id)` — fired once on first successful load, idempotent + debounced                          |
| Bottom-nav on detail   | n/a (no app shell on web)                  | Detail mounted on root navigator (`parentNavigatorKey`) → bottom nav suppressed for full-screen reading                                       |

## Out of scope (follow-up tranches)

- **Comments** — `CommentsService` / `ClientCommentsService` port, paginated list, optimistic create, edit-in-place, like/unlike, delete-with-confirm, mobile bottom-sheet
- **Inline `<img>` auth-fetch** — Dio-cached image loader exposed as a custom `flutter_widget_from_html_core` factory
- **Acknowledgment list view** (admin) — out of scope for the read side
- **Translation surface improvements** — language picker / re-translate trigger
- **Client-portal context** — second mount that uses `ClientNewsService` + `ClientCommentsService`; introduces the repository abstraction noted above

## Port Log

| Date       | Who      | What                                                                                       |
| ---------- | -------- | ------------------------------------------------------------------------------------------ |
| 2026-04-20 | ltoenjes | Spec created                                                                               |
| 2026-04-30 | sbaumgart | Read-only detail (cover, HTML body, attachments, like, video) — PR #19                    |
| 2026-04-30 | sbaumgart | Acknowledgment + auto mark-as-read + translation hint — PR #20                            |
| 2026-04-30 | sbaumgart | UX polish from on-device review: cover URL absolutise, attachments redesign, video card  |
