# Parity: Knowledge Base

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/knowledge-base-page.component.ts)
- **Detail:** [`article-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/knowledge-base/article-detail-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/knowledge_base/`
- **Integration tests:** `integration_test/knowledge_base_test.dart`

## Known Divergences

| Topic                | Angular                                                                     | Flutter                                        |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Local + global merge | `combineLatest` of two observables                                          | `Bloc` subscribing to both streams via `rxdart`'s `Rx.combineLatest2`, emitting the merged list on every update |
| Category hierarchy   | Recursive `CategoryWithIcon`                                                | Same shape; render via recursive widget        |
| Mobile filters sheet | `KBSimpleFiltersBottomSheetComponent`                                       | `showModalBottomSheet` with the same filter UI |
| Navigation after tap | `institutionRoute(id, 'knowledge-base', 'article', :id)` vs teamspace route | Dart router — one function per context         |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
