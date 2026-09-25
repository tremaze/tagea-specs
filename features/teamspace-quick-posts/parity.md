# Parity: Teamspace Quick Posts

## Angular

- **Status:** ✅ Implemented
- **Host page:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts) (composer inline above the feed; mobile opens it as a sheet)
- **Composer:** [`apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts)
- **Edit/delete flows:** [`quick-post-actions.service.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/quick-post-actions.service.ts)
- **Settings toggle:** [`teamspace-tabbed-dialog`](../../../apps/tagea-frontend/src/app/shared/components/teamspaces/teamspace-tabbed-dialog/teamspace-tabbed-dialog.component.ts)
- **E2E:** `apps/tagea-frontend-e2e/src/tests/teamspaces/articles/quick-posts.spec.ts`, `quick-posts-ui.spec.ts`

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/news/widgets/quick_post_composer.dart`
- **Integration tests:** `integration_test/teamspace_quick_posts_test.dart`
- **Notes:** mirror the multi-teamspace chip-picker UX; attachments are uploaded one per request to `POST /articles/attachments/upload` (part `file`) and associated via `attachment_ids` on create.

## Known Divergences

| Topic            | Angular                                          | Flutter                                                              |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Composer expand  | Click placeholder → expand inline                | Tap placeholder → expand inline (no modal)                           |
| Attachment input | Two file pickers (image / video+PDF), multi-select | File picker only                                                   |
| Picker overflow  | Chip wrap                                        | Chip wrap → overflow becomes "+ N more" sheet                        |
| Card             | `TageaFeedCardComponent` (author-only menu)      | Reuse `NewsCard`                                                     |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-06 | baumgart | Spec created |
| 2026-09-25 | Claude (M2-Specs) | Synced with implementation: attachment upload `POST /articles/attachments/upload` (part `file`, `AttachmentUploadResponse`, mediaAttachment limits), eligible response = `Teamspace[]`, title required, edit mode, real permission names (`news.edit`, `tenant.teamspaces.edit`), Angular status ✅ |
