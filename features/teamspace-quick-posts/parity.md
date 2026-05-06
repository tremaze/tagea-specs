# Parity: Teamspace Quick Posts

## Angular

- **Status:** ⏳ Planned
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts) (extension — composer hosted inline above the feed)
- **Composer:** new component, suggested path `apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts`
- **Settings toggle:** added to the existing teamspace settings page (path TBD during implementation)
- **E2E:** new spec file `apps/tagea-frontend-e2e/src/articles/quick-posts.spec.ts`

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/news/widgets/quick_post_composer.dart`
- **Integration tests:** `integration_test/teamspace_quick_posts_test.dart`
- **Notes:** mirror the multi-teamspace chip-picker UX; attachment upload uses the same two-step (pending → associate) flow as the Redaktion editor.

## Known Divergences

| Topic            | Angular                                          | Flutter                                                              |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Composer expand  | Click placeholder → expand inline                | Tap placeholder → expand inline (no modal)                           |
| Attachment input | Drag-and-drop + file picker                      | File picker only (drag-and-drop not idiomatic on mobile)             |
| Picker overflow  | Chip wrap                                        | Chip wrap → overflow becomes "+ N more" sheet                        |
| Compact card     | `NewsDisplayCardComponent` compact-mode variant  | Reuse `NewsCard` with `compact: true` flag                           |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-06 | baumgart | Spec created |
