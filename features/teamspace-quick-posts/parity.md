# Parity: Teamspace Quick Posts

## Angular

- **Status:** ✅ Implemented
- **Host page:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts) (composer inline above the feed; mobile opens it as a sheet)
- **Composer:** [`apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts)
- **Edit/delete flows:** [`quick-post-actions.service.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/quick-post-actions.service.ts)
- **Settings toggle:** [`teamspace-tabbed-dialog`](../../../apps/tagea-frontend/src/app/shared/components/teamspaces/teamspace-tabbed-dialog/teamspace-tabbed-dialog.component.ts)
- **E2E:** `apps/tagea-frontend-e2e/src/tests/teamspaces/articles/quick-posts.spec.ts`, `quick-posts-ui.spec.ts`

## Flutter

- **Status:** 🚧 Composer + delete implemented (WP11, [tremaze/tagea-next-flutter#94](https://github.com/tremaze/tagea-next-flutter/pull/94)); edit mode, title image and rich text pending the owner questions in Asana 1218859145101536; settings toggle and feed-card rendering not part of WP11
- **Paths:**
  - UI: `apps/tagea_frontend/lib/features/teamspace/quick_post/` (FAB, composer page, detail menu)
  - Composer route `/teamspace/news/neu`: `apps/tagea_frontend/lib/routing/routes/quick_post_routes.dart` (listed before `newsRoutes()` so `neu` is not read as `:id`)
  - `packages/teamspace_core`: `QuickPostApi`, `QuickPostComposerCubit`, `QuickPostEligibilityCubit`, `QuickPostActionsCubit`, `QuickPostPermissions`
  - `packages/ui`: `TageaChipPicker` („Posten in“)
- **Integration tests:** `integration_test/teamspace_quick_posts_test.dart` _(to be written)_; widget tests cover composer, FAB, reload after publish and the delete menu

## Known Divergences

| Topic | Angular | Flutter |
| ----- | ------- | ------- |
| Entry point | Compose trigger „Was möchtest du teilen?“ on `/teamspace`, inline composer (desktop) / sheet (mobile) | Extended FAB „Beitrag verfassen“ on `/teamspace/news`, shown only when `GET /teamspaces/eligible-for-quick-post` is non-empty (403 = empty); rechecked on tenant switch and pull-to-refresh |
| Composer | Inline expand / sheet; edit as dialog | Full-screen route `/teamspace/news/neu` (`TageaFormPage`, UX §3) with dirty guard |
| „Senden“ | Disabled while invalid or uploading; „{n} Anhang wird hochgeladen“ counter | Never greyed out; validates on tap and jumps to the first error (UX §4). **No upload counter** — progress per file; the attachment field says „Warte, bis alle Anhänge hochgeladen sind.“ / „Lade fehlgeschlagene Anhänge erneut hoch oder entferne sie.“ |
| Content editor | TipTap rich text | Plain text, sent as escaped `<p>` / `<br>` HTML (rich text: Asana 1218859145101536) |
| Title image | „Titelbild hinzufügen“ with cropper | **Not offered** (no cropper building block yet; Asana 1218859145101536) |
| Attachment input | Two buttons „Bild anhängen“ / „Datei anhängen“ | One „Anhang hinzufügen“ button with the shared source sheet (Kamera / Galerie / Dateien); invalid file → snack bar |
| Gallery (mobile) | n/a (browser file dialogs; „Bild anhängen“ for images, „Datei anhängen“ for video / PDF) | **Images only**, re-encoded as JPEG (iOS HEIC photos / QuickTime videos are rejected by the backend); MP4/WebM and PDF via „Dateien“ |
| Title length | 3–200 characters | Same; the upper limit is counted in UTF-16 units like the backend |
| Edit mode | „Bearbeiten“ for the author | **Open** — not offered until the owner decision (Asana 1218859145101536) |
| Delete: who | Menu for the author only (spec „Current UI gap“) | Author **and moderators** (`tenant.posts.moderate`, `tenant.teamspaces.access_all`, or `news.edit` in any of the post's teamspaces), matching the API — PM default (Asana 1218851193676483) |
| Delete: where | Feed card and detail menu | Detail app bar „Aktionen“ only (feed card would need a shared `TageaFeedCard` change); list reloads after deleting |
| Picker overflow | Chip wrap | Chip wrap (`TageaChipPicker`, 48 dp tap box); hidden when only one teamspace is eligible (preselected) |
| Card | `TageaFeedCardComponent` (author-only menu) | Existing news feed card (feed already requests `article_types=[news, quick_post]`) |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-06 | baumgart | Spec created |
| 2026-09-25 | Claude (M2-Specs) | Synced with implementation: attachment upload `POST /articles/attachments/upload` (part `file`, `AttachmentUploadResponse`, mediaAttachment limits), eligible response = `Teamspace[]`, title required, edit mode, real permission names (`news.edit`, `tenant.teamspaces.edit`), Angular status ✅ |
| 2026-09-25 | Claude (M2 parity) | Flutter ⏳ → 🚧 after tagea-next-flutter#94 (WP11); moderator delete (PM default, Asana 1218851193676483), gallery images only, no title image, no upload counter, edit mode open (Asana 1218859145101536) recorded |
