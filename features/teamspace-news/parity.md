# Parity: Teamspace News

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts)
- **Detail:** shared `SharedNewsDetailComponent` with `data.context: 'teamspace'`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/news/teamspace_news_page.dart`
- **Detail:** shared `NewsDetailPage` with context enum (see [news-detail/parity.md](../news-detail/parity.md))
- **Integration tests:** `integration_test/teamspace_news_test.dart`

## Known Divergences

| Topic           | Angular                          | Flutter                                                          |
| --------------- | -------------------------------- | ---------------------------------------------------------------- |
| Search debounce | RxJS `debounceTime(300)`         | Debouncer helper + `TextEditingController`                       |
| Secure images   | `SecureImageService.loadImage()` | Dio-fetched bytes → `Image.memory` / custom `CachedNetworkImage` |
| Card            | `NewsDisplayCardComponent`       | Shared `NewsCard` widget                                         |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
