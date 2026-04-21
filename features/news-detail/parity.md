# Parity: News Detail

## Angular

- **Status:** ✅ Implemented (shared across teamspace + client-portal)
- **Path:** [`apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts`](../../../apps/tagea-frontend/src/app/shared/news/news-detail/shared-news-detail.component.ts)
- **Mount 1:** `/teamspace/news/:id` with `data.context: 'teamspace'`
- **Mount 2:** `/client-portal/news/:id` with `data.context: 'client-portal'`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/news/detail/news_detail_page.dart`
- **Context enum:** `NewsDetailContext { teamspace, clientPortal }`
- **Repository abstraction:** inject `NewsDetailRepository` via a `RepositoryProvider` scoped to the route subtree (or pass it into the `Cubit`/`Bloc` constructor through a route-scoped `BlocProvider`), with the concrete implementation chosen per context; `CommentsRepository` similarly abstracted.
- **Layout:** responsive split — `LayoutBuilder` chooses between sidebar + body (desktop) and body-only + FAB (mobile).
- **Integration tests:** `integration_test/news_detail_teamspace_test.dart` + `news_detail_client_portal_test.dart`

## Known Divergences

| Topic                  | Angular                                    | Flutter                                                           |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Context discrimination | `route.data.context` string                | Enum passed as page argument                                      |
| Repository injection   | Per-context Angular provider               | Per-context `RepositoryProvider` (or `BlocProvider` scoped to route subtree) that supplies the correct repository implementation |
| Comments layout        | CSS grid sidebar + mobile bottom-sheet FAB | `LayoutBuilder` with a `DraggableScrollableSheet` on mobile       |
| Secure images          | `SecureImageService` blob URLs             | Dio-fetched bytes → `Image.memory` or custom `CachedNetworkImage` |
| Comment form           | `ReactiveForms`                            | `reactive_forms` or plain `TextFormField`                         |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
