# Feature: Teamspace Quick Posts

> **Status:** 🟢 Implemented in Angular (composer, edit, delete, settings toggle)
> **Owner:** baumgart
> **Last updated:** 2026-09-25 (M2-Specs: synced with the implementation — attachment upload `POST /articles/attachments/upload`, title required, rich-text content, edit mode, real permission names)

## Vision (Elevator Pitch)

Inline composer at the top of the teamspace news feed for casual social-media-style posts. Staff write a short post (title + rich-text content, optionally a title image and image/video/PDF attachments) and broadcast it to one or several of their teamspaces in a single action. Carriers ("Träger") that already use the news feed as an open social channel get a low-friction posting surface without having to navigate into the heavyweight Redaktion editor.

## User Stories

- As a **staff member** I want to share a quick text/image post inline above the feed, so that I don't have to open the full Redaktion editor for a casual update.
- As a **staff member** I want to post into multiple teamspaces I'm a member of, so that I can reach colleagues in both my public team and my institution-bound team in one shot.
- As a **teamspace-Verantwortlicher** I want to opt my teamspace into or out of quick-posting, so that clinical teamspaces stay editorial-only while social ones open up.
- As a **teamspace-Verantwortlicher** I want to delete unwanted posts that touch my teamspace, so that I can keep the feed appropriate.
- As a **tenant administrator** I want to delete inappropriate posts tenant-wide, so that I have a final-instance moderation tool independent of teamspace ownership.

## Acceptance Criteria

### Composer (teamspace start page `/teamspace`)

Hosted by `teamspace-v2-page` above the feed: inline on desktop; on mobile a compose trigger („Was möchtest du teilen?“) opens the composer as a full-screen sheet. The same composer opens as a dialog for editing (`QuickPostActionsService.editById`).

- [ ] **Given** `GET /teamspaces/eligible-for-quick-post` returns at least one teamspace, **When** the page renders, **Then** the composer (or the mobile trigger) appears above the feed.
- [ ] **Given** the list is empty (no eligible teamspace, or 403 because `tenant.posts.create` is missing), **Then** the composer is not rendered at all (no placeholder, no disabled card).
- [ ] **Given** the composer is collapsed, **When** the user clicks the placeholder („Was möchtest du teilen?“) or „Senden“, **Then** it expands: title field („Titel“), title-image field („Titelbild hinzufügen“), rich-text editor („Schreibe einen Beitrag...“), „Bild anhängen“ / „Datei anhängen“ buttons, teamspace chips („Posten in“), „Senden“.
- [ ] **Given** the feed is filtered to exactly one eligible teamspace, **When** the composer expands, **Then** that teamspace is preselected; with exactly one eligible teamspace it is preselected too; otherwise nothing is preselected.
- [ ] **Title** is required: 3–200 characters. After the first blur an empty title shows „Titel ist erforderlich“, a shorter one „Titel muss mindestens 3 Zeichen lang sein“.
- [ ] „Senden“ is enabled only when title ≥ 3 characters, content is non-empty, ≥ 1 teamspace is selected (create only), and no upload is in progress.
- [ ] **Attachments:** „Bild anhängen“ accepts JPEG/PNG/WebP/GIF, „Datei anhängen“ accepts MP4/WebM video and PDF; several files may be picked at once. Each file is checked client-side (images/PDF ≤ 10 MB, video ≤ 50 MB); a violation shows a snackbar and skips that file. Each valid file is uploaded immediately via `POST /articles/attachments/upload` (part `file`); while uploads run, „{n} Anhang wird hochgeladen“ is shown and „Senden“ is disabled. Uploaded files appear as removable chips (thumbnail style for images). A failed upload shows „Anhang konnte nicht hochgeladen werden.“
- [ ] **Given** the user submits, **When** `POST /articles` resolves, **Then** the new post is prepended to the feed, the composer collapses and title/content/title image/attachments/teamspaces reset.
- [ ] **Given** the request fails, **Then** the input is preserved and an inline alert under the editor shows the server `message`, or „Beitrag konnte nicht veröffentlicht werden.“

### Edit

- [ ] The author opens „Bearbeiten“ from the post's menu („Aktionen“); the composer opens as dialog („Beitrag bearbeiten“, „Änderungen speichern“) prefilled with title, content, title image and attachments.
- [ ] Teamspaces cannot be changed in edit mode. Attachments are added/removed immediately (`POST /articles/:id/attachments/upload`, `DELETE /articles/:id/attachments/:attachmentId`; failure → „Der Anhang konnte nicht entfernt werden.“); saving sends `PATCH /articles/:id` with title, content and title image only.

### Per-teamspace setting

- [ ] **Given** a user with the tenant permission `tenant.teamspaces.edit`, **When** they edit a teamspace (teamspace dialog under Einstellungen → Organisation → Teamspaces), **Then** a quick-post toggle is visible; it saves via `PATCH /teamspaces/:id` (`quick_posts_enabled`).
- [ ] **Given** the toggle is OFF (default for new and existing teamspaces), **When** any user opens the composer, **Then** the teamspace does not appear in the eligible-teamspaces list.
- [ ] **Given** the toggle is flipped from ON to OFF, **When** the change persists, **Then** existing quick posts remain visible and engagement (like/comment) on them remains possible; only new posts to that teamspace are blocked.

### Feed rendering

- [ ] **Given** the news feed loads, **When** the filter resolves, **Then** both `NEWS` and `QUICK_POST` articles appear interleaved by `published_at DESC`.
- [ ] **Given** a `QUICK_POST` renders, **When** the card is shown, **Then** title, content and (if set) the title image appear; no category chip. Legacy quick posts with an empty title (created before the title became required on 2026-05-15) show the content as lead.
- [ ] **Given** a multi-teamspace `QUICK_POST` exists, **When** any of its teamspace feeds loads, **Then** the post appears once in that feed.

### Engagement

- [ ] **Given** a user with `tenant.articles.engage` views a `QUICK_POST` they have feed-access to, **When** they like or comment, **Then** the existing article-engagement endpoints handle it identically to `NEWS`.

### Moderation (delete)

- [ ] **Given** the author views their own `QUICK_POST` (feed card or detail, teamspace context), **When** the menu („Aktionen“) opens, **Then** „Bearbeiten“ and „Löschen“ are offered. „Löschen“ asks „Möchtest du den Beitrag „{title}“ wirklich löschen? …“ and then calls `DELETE /articles/:id`; success → „Der Beitrag wurde gelöscht.“, 403 → „Du hast keine Berechtigung, diesen Beitrag zu löschen.“, other errors → „Der Beitrag konnte nicht gelöscht werden.“
- [ ] **Backend:** `DELETE /articles/:id` on a quick post is allowed for the author, `tenant.teamspaces.access_all`, `tenant.posts.moderate`, or `news.edit` in *any* of the post's teamspaces; the article is removed from all target teamspaces. Everyone else gets 403.
- [ ] **Current UI gap (Angular):** the menu is shown to the author only — moderators (`tenant.posts.moderate`, `news.edit`) have no delete entry in the UI although the API allows it. **PM default (Asana 1218851193676483):** the UI offers „Löschen“ to everyone the API allows (author, `tenant.posts.moderate`, `tenant.teamspaces.access_all`, `news.edit` in any of the post's teamspaces); Flutter implements this, Angular still lags (see [parity.md](./parity.md)).
- [ ] **Given** any deletion happens, **When** the operation resolves, **Then** an `entity_changelog` entry is recorded with the actor's `employee_id` per existing audit pattern.

## UI States

### Composer

| State        | When?                                          | What does the user see?                           | A11y notes                |
| ------------ | ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| Hidden       | No `tenant.posts.create` or no eligible TS     | Nothing — feed begins immediately                 | —                         |
| Collapsed    | Initial render with permission + eligible TS   | Single-line placeholder card                      | `role="button"`           |
| Expanded     | After click into composer                      | Title + title image + editor + attachments + picker | Focus on title          |
| Uploading    | Attachment upload in progress                  | „{n} Anhang wird hochgeladen“; post button disabled | Live region for progress |
| Posting      | Submit in flight                               | Post button shows spinner; form fields readonly   | `aria-busy="true"`        |
| Error        | Submit or upload failed                        | Inline error below the editor, content preserved  | `role="alert"`            |

### Card (compact variant for QUICK_POST)

| State        | When?                          | What does the user see?                           |
| ------------ | ------------------------------ | ------------------------------------------------- |
| With title   | `title` non-empty (always for new posts) | Title (prominent) + content + attachment list |
| No title     | legacy post with empty `title` | Content as lead + attachment list                 |
| With images  | One or more image attachments  | Thumbnail strip below content                     |
| With files   | One or more non-image attach.  | Download chips with filename + size below content |

## Flows

### Posting

```
Composer collapsed
   └─click placeholder──> expanded
                              ├─type title + content ────┐
                              ├─title image (optional) ──┤   POST /articles/images/upload
                              ├─add attachments ─────────┤   POST /articles/attachments/upload (one request per file)
                              ├─pick teamspace(s) ───────┤
                              └─click "Posten" ──────────┘
                                          │
                                          ▼
                              POST /articles
                              (article_type=QUICK_POST,
                               status=PUBLISHED,
                               teamspace_ids=[…],
                               attachment_ids=[…])
                                          │
                              ┌───────────┴───────────┐
                              ▼                       ▼
                          success                  error
                              │                       │
                  prepend post to feed,      preserve form,
                  collapse + reset           show inline error
```

### Moderation

```
View post
   └─open overflow menu
         │
         ├─isAuthor ─────────────────────────> "Bearbeiten" + "Löschen" visible
         └─else ──────────────────────────────> menu hidden
                                                (API still allows tenant.posts.moderate /
                                                 news.edit in any target teamspace)
                                                       │
                                                  click "Löschen"
                                                       │
                                          ┌────────────┴────────────┐
                                          ▼                         ▼
                                   confirm dialog              cancel
                                          │
                                  DELETE /articles/:id
                                          │
                                  remove from feed,
                                  audit row written
```

## Non-Goals

- **Embeds / markdown** — content is TipTap HTML (rich text with inline images); no markdown, no embeds.
- **Drafts / scheduling** — posts go straight to PUBLISHED. No DRAFT/SCHEDULED states for `QUICK_POST`.
- **Categories** — `category_id` is ignored for `QUICK_POST`.
- **Translations** — content is stored in tenant's primary language only. No `ArticleTranslation` rows.
- **Acknowledgment workflow** — `requires_acknowledgment` is forced false.
- **Per-teamspace partial delete** — deleting a multi-teamspace post removes it from *all* targeted teamspaces. There is no "remove from my teamspace only" mode.
- **Changing target teamspaces after publish** — edit mode keeps the original teamspaces.
- **Mentions / hashtags** — no `@user` or `#tag` parsing in v1.

## Edge Cases

- **All eligible teamspaces deselected** — post button disabled; the picker enforces ≥ 1 selection.
- **Picker shrinks mid-composition** — if a selected teamspace's flag flips to OFF while the composer is open, submit returns 403 `Schnellbeiträge sind im Teamspace {id} nicht aktiviert`; the composer shows that server message inline and keeps the input (no automatic re-fetch of the eligible list).
- **Author loses `tenant.posts.create` after posting** — author can still edit and delete via the author bypass; cannot create new posts.
- **Author loses membership in a target teamspace after posting** — post stays. Engagement and moderation by others continue normally.
- **Teamspace deleted** — existing Article deletion cascade handles `teamspace_ids` cleanup; if the post had multiple targets, it survives in remaining ones.
- **Attachment upload fails mid-compose** — no chip is added; the inline error „Anhang konnte nicht hochgeladen werden.“ is shown. Pending attachments that never get an article stay as `article_id = null` rows (cleanup by the existing pending-attachment lifecycle, if any).
- **Content length** — the client requires non-empty content; no quick-post-specific max length. *(The DTO intends ≥ 1 character for quick posts and ≥ 10 for other types, but see the open question on the stacked `@ValidateIf` in the report/contracts.)*
- **Cross-visibility post** — picker may include public and institution-bound teamspaces simultaneously; the resulting article's `teamspace_ids[]` mixes both. Audience filtering downstream is unchanged.
- **Currently posting in a teamspace that's institution-bound** — the article inherits no `institution_id` (multi-teamspace path); existing access control evaluates per-teamspace membership for read.

## Permissions & Tenant/Institution

### Capability matrix

| Permission                  | Scope    | Default seeded for                              | What it grants                                                                  |
| --------------------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `tenant.posts.create`       | tenant   | `mitarbeiter`, `personalverwalter`, `traeger_manager` | Composer visible (eligible list); `POST /articles` with `article_type = quick_post` |
| `tenant.posts.moderate`     | tenant   | `traeger_manager`                               | Tenant-wide delete of any `QUICK_POST`, regardless of membership (API only)     |
| `news.edit`                 | teamspace| (existing — unchanged)                          | Per-teamspace moderation: delete a quick post that targets that teamspace (API only) |
| `tenant.articles.engage`    | tenant   | (existing — unchanged)                          | Like / acknowledge, reused for `QUICK_POST`                                      |
| `tenant.teamspaces.edit`    | tenant   | (existing — unchanged)                          | Toggle the `quick_posts_enabled` flag of a teamspace                             |
| `tenant.teamspaces.access_all` | tenant | (existing — Träger-Admin)                      | Bypasses capability + membership checks (not the per-teamspace flag)             |

### Posting access gate (all three must hold)

1. User has `tenant.posts.create` (capability).
2. User has access to (is assigned to) every `teamspace_id` in the request payload.
3. Each of those teamspaces has `quick_posts_enabled = true`.

Membership-based gating means staff who are *consumers* of a teamspace (no role assignment, just members) can post — this is intentional, matching the Two-Scope-Access-Model: tenant capability + teamspace Scope-A membership.

### Read access

Quick posts inherit the existing article read-access semantics: visible to teamspace members of any of the post's `teamspace_ids`. No new read-permission needed.

### Frontend route guard

The `/teamspace` start-page guard remains unchanged (`tenant.teamspace_home.view`). The composer is gated *inside* the page (eligible list non-empty), not at the route.

## Notifications (Push / In-App)

- New `QUICK_POST` triggers the same teamspace-news unread-count increment as `NEWS` — see [teamspace-home](../teamspace-home/spec.md).
- Push notifications: same delivery as `NEWS`, deep-linking to `/teamspace/news/:id`. Legacy posts without title fall back to a content preview in the push text.
- **Non-goal in v1:** distinct notification copy for "Schnellbeitrag" vs. "Beitrag" — same wording.

## i18n Keys

> User-facing strings remain in German.

- `quickPostComposer.placeholder` („Was möchtest du teilen?“), `.contentPlaceholder` („Schreibe einen Beitrag...“)
- `quickPostComposer.titlePlaceholder` („Titel“), `.titleRequiredError`, `.titleMinLengthError`
- `quickPostComposer.imageButton` („Bild anhängen“), `.attachmentButton` („Datei anhängen“), `.uploading`
- `quickPostComposer.featureImageAdd`, `.featureImageCropperTitle`, `.featureImageAltLabel`, `.featureImageAltHint`
- `quickPostComposer.teamspacePickerLabel` („Posten in“), `.teamspacePickerEmpty`
- `quickPostComposer.submit` („Senden“), `.submitting`, `.error`, `.success`
- `quickPost.menu`, `.edit`, `.delete`, `.editTitle`, `.saveChanges`, `.deleteDialog.*`, `.deleteSuccess`, `.deleteError`, `.deletePermissionError`, `.attachmentDeleteError`
- Hard-coded (not i18n): „Anhang konnte nicht hochgeladen werden.“, „Beitrag konnte nicht veröffentlicht werden.“

## Offline Behavior

**Flutter-specific:**

- Composer requires online (no offline draft queue in v1 — match the Redaktion editor's online-only behavior).
- Existing offline read-cache for the news feed displays previously-fetched quick posts.

## Observability / Audit

- `entity_changelog` row for each create and delete, identical to the existing `Article` audit pattern (no new audit hook).
- No additional telemetry events in v1; feature usage is observable via aggregate `Article` counts grouped by `article_type`.

## Open Questions

- **Moderation UI** — moderators (`tenant.posts.moderate`, `news.edit`) can delete via API but have no UI entry (menu is author-only).
- **Non-author edit** — `PATCH /articles/:id` on someone else's quick post passes for any user with `tenant.posts.create` and access to all target teamspaces (create and edit share one branch in `assertArticlePermission`).
- **Attachment ownership** — `attachment_ids` associates any pending attachment id, without checking the uploader.
- **Picker UI for many teamspaces** — chip wrap is fine for ≤ 8 eligible teamspaces; beyond that, a dropdown-with-search is needed.

## References

- **Backend articles module:** `apps/tagea-backend/src/articles/` (`articles.controller.ts`, `articles.service.ts` → `create`, `assertArticlePermission`, `uploadPendingAttachment`)
- **Eligible endpoint:** `apps/tagea-backend/src/teamspaces/teamspaces.controller.ts` → `findEligibleForQuickPost`
- **Upload limits:** `packages/models/src/lib/media-upload.ts` (`MEDIA_UPLOAD_PRESETS.mediaAttachment`)
- **Composer:** `apps/tagea-frontend/src/app/pages/teamspace/quick-post-composer.component.ts`
- **Host page:** `apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`
- **Edit/delete flows:** `apps/tagea-frontend/src/app/pages/teamspace/quick-post-actions.service.ts`
- **Migration:** `apps/tagea-backend/src/database/tenant-migrations/20260506200000-AddTeamspaceQuickPosts.ts`
- **E2E:** `apps/tagea-frontend-e2e/src/tests/teamspaces/articles/quick-posts.spec.ts`, `quick-posts-ui.spec.ts`, `apps/tagea-frontend-e2e/src/tests/teamspaces/lifecycle/dialog-quick-posts-toggle-persists.spec.ts`
- **Two-Scope Access Model:** [teamspace-consumer-access](../teamspace-consumer-access/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)
