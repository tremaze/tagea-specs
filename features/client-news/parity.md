# Parity: Client News

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-news-page.component.ts)
- **Detail:** shared `SharedNewsDetailComponent` with context `client-portal`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/client_portal/news/news_list_page.dart`
- **Detail:** shared `NewsDetailPage` with context enum (see [news-detail/parity.md](../news-detail/parity.md))
- **Integration tests:** `integration_test/client_news_test.dart`

## Known Divergences

| Topic          | Angular                                 | Flutter                                                                              |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| Secure images  | `SecureImageService` creates blob URLs  | Dio-fetched bytes → `Image.memory` or custom `CachedNetworkImage` with `httpHeaders` |
| Category chips | Root single-select + child multi-select | Same semantics; use `FilterChip` widgets                                             |
| Search         | `FormControl` with `debounceTime`       | `TextEditingController` + `Debouncer` helper                                         |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
