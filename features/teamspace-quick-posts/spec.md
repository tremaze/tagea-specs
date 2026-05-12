# Feature: Teamspace Quick Posts

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** baumgart
> **Last updated:** 2026-05-06

## Vision (Elevator Pitch)

Inline composer at the top of the teamspace news feed for casual social-media-style posts. Staff write a short text (optionally with title and image/file attachments) and broadcast it to one or several of their teamspaces in a single action. Carriers ("Träger") that already use the news feed as an open social channel get a low-friction posting surface without having to navigate into the heavyweight Redaktion editor.

## User Stories

- As a **staff member** I want to share a quick text/image post inline above the feed, so that I don't have to open the full Redaktion editor for a casual update.
- As a **staff member** I want to post into multiple teamspaces I'm a member of, so that I can reach colleagues in both my public team and my institution-bound team in one shot.
- As a **teamspace-Verantwortlicher** I want to opt my teamspace into or out of quick-posting, so that clinical teamspaces stay editorial-only while social ones open up.
- As a **teamspace-Verantwortlicher** I want to delete unwanted posts that touch my teamspace, so that I can keep the feed appropriate.
- As a **tenant administrator** I want to delete inappropriate posts tenant-wide, so that I have a final-instance moderation tool independent of teamspace ownership.

## Acceptance Criteria

### Composer (top of `/teamspace/news`)

- [ ] **Given** the user has `tenant.posts.create` AND is member of at least one teamspace where `quick_posts_enabled = true`, **When** the news page renders, **Then** an inline composer appears above the feed.
- [ ] **Given** the user lacks `tenant.posts.create` OR has no eligible teamspaces, **When** the news page renders, **Then** the composer is not rendered at all (no placeholder, no disabled card).
- [ ] **Given** the composer is collapsed, **When** the user clicks the placeholder ("Was möchtest du teilen?"), **Then** it expands to show: textarea, optional-title toggle, attachment button, multi-teamspace chip-picker, "Posten" button.
- [ ] **Given** the user opens the composer in the context of an eligible teamspace, **When** the picker initializes, **Then** that teamspace is preselected; otherwise no preselection.
- [ ] **Given** the user types content of length ≥ 1, **When** the post button is examined, **Then** it is enabled. With empty content it is disabled.
- [ ] **Given** the user expands the title field and types, **When** the post is created, **Then** the title is stored on the article. Otherwise the article's `title` is empty string.
- [ ] **Given** the user attaches one or more files via drag-and-drop or file-picker, **When** the upload completes, **Then** thumbnails (images) or filename chips (other files) appear above the post button. Each chip is removable.
- [ ] **Given** the user submits, **When** the request resolves, **Then** the new post appears at the top of the current feed, the composer collapses, and content/title/attachments reset.
- [ ] **Given** the request fails (network/validation), **When** the error returns, **Then** content/attachments are preserved and an inline error message appears under the textarea.

### Per-teamspace setting

- [ ] **Given** a user with `ts.settings.edit` for a teamspace, **When** they open the teamspace settings page, **Then** a "Schnellbeiträge erlauben" toggle is visible.
- [ ] **Given** the toggle is OFF (default for new and existing teamspaces), **When** any user opens the composer, **Then** the teamspace does not appear in the eligible-teamspaces list.
- [ ] **Given** the toggle is flipped from ON to OFF, **When** the change persists, **Then** existing quick posts remain visible and engagement (like/comment) on them remains possible; only new posts to that teamspace are blocked.

### Feed rendering

- [ ] **Given** the news feed loads, **When** the filter resolves, **Then** both `NEWS` and `QUICK_POST` articles appear interleaved by `published_at DESC`.
- [ ] **Given** a `QUICK_POST` with empty title renders, **When** the card is shown, **Then** content is the lead, no title block, no feature-image block, compact padding.
- [ ] **Given** a `QUICK_POST` with title renders, **When** the card is shown, **Then** the title appears above content but the rest of the compact treatment still applies (no feature-image block, no category chip).
- [ ] **Given** a multi-teamspace `QUICK_POST` exists, **When** any of its teamspace feeds loads, **Then** the post appears once in that feed.

### Engagement

- [ ] **Given** a user with `tenant.articles.engage` views a `QUICK_POST` they have feed-access to, **When** they like or comment, **Then** the existing article-engagement endpoints handle it identically to `NEWS`.

### Moderation (delete)

- [ ] **Given** the post author views their own `QUICK_POST`, **When** the overflow menu opens, **Then** "Löschen" is offered. Confirming deletes the article (existing soft-delete or cascade pattern).
- [ ] **Given** a user with `ts.articles.delete` in *any* teamspace the post targets views the post, **When** they delete it, **Then** the article is deleted entirely (removed from all targeted teamspaces' feeds).
- [ ] **Given** a user with `tenant.posts.moderate` views any `QUICK_POST` tenant-wide, **When** they delete it, **Then** the article is deleted entirely regardless of teamspace membership.
- [ ] **Given** a user without any of the three above rights views a foreign `QUICK_POST`, **When** the overflow menu opens, **Then** "Löschen" is not offered. The corresponding API call returns 403.
- [ ] **Given** any deletion happens, **When** the operation resolves, **Then** an `entity_changelog` entry is recorded with the actor's `employee_id` per existing audit pattern.

## UI States

### Composer

| State        | When?                                          | What does the user see?                           | A11y notes                |
| ------------ | ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| Hidden       | No `tenant.posts.create` or no eligible TS     | Nothing — feed begins immediately                 | —                         |
| Collapsed    | Initial render with permission + eligible TS   | Single-line placeholder card                      | `role="button"`           |
| Expanded     | After click into composer                      | Textarea + title-toggle + attachments + picker    | Focus on textarea         |
| Uploading    | Attachment upload in progress                  | Per-chip spinner; post button disabled            | Live region for progress  |
| Posting      | Submit in flight                               | Post button shows spinner; form fields readonly   | `aria-busy="true"`        |
| Error        | Submit failed                                  | Inline error below textarea, content preserved    | `role="alert"`            |

### Card (compact variant for QUICK_POST)

| State        | When?                          | What does the user see?                           |
| ------------ | ------------------------------ | ------------------------------------------------- |
| With title   | `title` non-empty              | Title (prominent) + content + attachment list     |
| No title     | `title` empty                  | Content as lead + attachment list                 |
| With images  | One or more image attachments  | Thumbnail strip below content                     |
| With files   | One or more non-image attach.  | Download chips with filename + size below content |

## Flows

### Posting

```
Composer collapsed
   └─click placeholder──> expanded
                              ├─type content ────────────┐
                              ├─toggle title ────────────┤
                              ├─add attachments ─────────┤   (pending uploads)
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
         ├─isAuthor ─────────────────────┐
         ├─hasTenantPostsModerate ────── ├──> "Löschen" visible
         ├─hasTsArticlesDelete           │
         │  for ANY post.teamspace_ids ──┘
         └─else ──────────────────────────────> "Löschen" hidden
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

- **Rich text** — content is plain text with line breaks. No TipTap, no markdown rendering, no embeds.
- **Drafts / scheduling** — posts go straight to PUBLISHED. No DRAFT/SCHEDULED states for `QUICK_POST`.
- **Categories** — `category_id` is ignored for `QUICK_POST`.
- **Translations** — content is stored in tenant's primary language only. No `ArticleTranslation` rows.
- **Acknowledgment workflow** — `requires_acknowledgment` is forced false.
- **Per-teamspace partial delete** — deleting a multi-teamspace post removes it from *all* targeted teamspaces. There is no "remove from my teamspace only" mode.
- **Edit after publish** — post-creation editing is out of scope for v1. The author can delete and repost.
- **Mentions / hashtags** — no `@user` or `#tag` parsing in v1.

## Edge Cases

- **All eligible teamspaces deselected** — post button disabled; the picker enforces ≥ 1 selection.
- **Picker shrinks mid-composition** — if the toggle of an eligible teamspace flips from ON to OFF while the composer is open, that teamspace is silently removed from selected/available chips on next picker focus or on submit (a no-longer-eligible target returns 403, frontend handles by re-fetching eligible list and showing inline notice).
- **Author loses `tenant.posts.create` after posting** — author can still delete via author-bypass; cannot create new posts.
- **Author loses membership in a target teamspace after posting** — post stays. Engagement and moderation by others continue normally.
- **Teamspace deleted** — existing Article deletion cascade handles `teamspace_ids` cleanup; if the post had multiple targets, it survives in remaining ones.
- **Attachment upload fails mid-compose** — chip shows error state; user can remove it. Pending attachments without an article are cleaned up by the existing pending-attachment lifecycle.
- **Content length cap** — match existing `Article.content` validator (≥ 1 char for QUICK_POST), max length matches existing column constraint. No quick-post-specific cap.
- **Cross-visibility post** — picker may include public and institution-bound teamspaces simultaneously; the resulting article's `teamspace_ids[]` mixes both. Audience filtering downstream is unchanged.
- **Currently posting in a teamspace that's institution-bound** — the article inherits no `institution_id` (multi-teamspace path); existing access control evaluates per-teamspace membership for read.

## Permissions & Tenant/Institution

### Capability matrix

| Permission                  | Scope    | Default seeded for                              | What it grants                                                                  |
| --------------------------- | -------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `tenant.posts.create`       | tenant   | COUNSELOR, SUPERVISOR, MANAGER, ADMIN           | Composer visible; allows `POST /articles` with `article_type = QUICK_POST`      |
| `tenant.posts.moderate`     | tenant   | ADMIN                                           | Tenant-wide delete of any `QUICK_POST`, regardless of membership                |
| `ts.articles.delete`        | teamspace| (existing — unchanged)                          | Per-teamspace moderation; for multi-target posts, granted if user can delete in any one target teamspace |
| `tenant.articles.engage`    | tenant   | (existing — unchanged)                          | Like / comment, reused for `QUICK_POST`                                          |
| `ts.settings.edit`          | teamspace| (existing — unchanged)                          | Toggle the `quick_posts_enabled` flag for that teamspace                         |

### Posting access gate (all three must hold)

1. User has `tenant.posts.create` (capability).
2. User is a **member** (`teamspace_members`) of every `teamspace_id` in the request payload.
3. Each of those teamspaces has `quick_posts_enabled = true`.

Membership-based gating means staff who are *consumers* of a teamspace (no role assignment, just members) can post — this is intentional, matching the Two-Scope-Access-Model: tenant capability + teamspace Scope-A membership.

### Read access

Quick posts inherit the existing article read-access semantics: visible to teamspace members of any of the post's `teamspace_ids`. No new read-permission needed.

### Frontend route guard

The existing `/teamspace/news` route guard remains unchanged (`teamspace_news.view`). The composer is gated *inside* the page, not at the route.

## Notifications (Push / In-App)

- New `QUICK_POST` triggers the same teamspace-news unread-count increment as `NEWS` — see [teamspace-home](../teamspace-home/spec.md).
- Push notifications: same delivery as `NEWS`, deep-linking to `/teamspace/news/:id`.
- **Non-goal in v1:** distinct notification copy for "Schnellbeitrag" vs. "Beitrag" — same wording.

## i18n Keys

> User-facing strings remain in German.

- `quickPostComposer.placeholder` ("Was möchtest du teilen?")
- `quickPostComposer.contentPlaceholder`
- `quickPostComposer.titleToggle`, `.titlePlaceholder`
- `quickPostComposer.attachmentButton`
- `quickPostComposer.teamspacePickerLabel`, `.teamspacePickerEmpty`
- `quickPostComposer.submit`, `.submitting`, `.error`
- `quickPostComposer.success` (toast)
- `teamspaceSettings.quickPostsEnabled.label`, `.helpText`
- `articleCard.compact.deleteOption` (overflow menu label, can reuse existing)

## Offline Behavior

**Flutter-specific:**

- Composer requires online (no offline draft queue in v1 — match the Redaktion editor's online-only behavior).
- Existing offline read-cache for the news feed displays previously-fetched quick posts.

## Observability / Audit

- `entity_changelog` row for each create and delete, identical to the existing `Article` audit pattern (no new audit hook).
- No additional telemetry events in v1; feature usage is observable via aggregate `Article` counts grouped by `article_type`.

## Open Implementation Questions

These are intentionally left for the implementation phase:

- **Attachment storage path** — does `article-attachments/{tenantId}/{articleId}/...` need a sub-namespace for QUICK_POST, or is it identical? *Default: identical, no namespace change.*
- **Composer location on mobile** — is the inline placeholder still the top of the news page on small viewports, or behind the existing FAB? *Default: inline at top, mirrors web layout.*
- **Picker UI for many teamspaces** — chip wrap is fine for ≤ 8 eligible teamspaces; beyond that, a dropdown-with-search is needed. *Defer real solution until a tenant exceeds that bound.*

## References

- **Backend articles module:** `apps/tagea-backend/src/articles/`
- **Frontend feed page:** `apps/tagea-frontend/src/app/pages/teamspace/news-page.component.ts`
- **Display card:** `apps/tagea-frontend/src/app/shared/articles/news-display-card/`
- **Permission constants:** `apps/tagea-backend/src/permissions/permissions.constants.ts`
- **Default role mapping:** `apps/tagea-backend/src/permissions/default-role-permissions.ts`
- **Two-Scope Access Model:** see project memory `project_teamspace_two_scope_model.md`
- **E2E suite:** `apps/tagea-frontend-e2e/src/articles/` (new spec file `quick-posts.spec.ts`)
- **Backend endpoints:** see [contracts.md](./contracts.md)

## Done Criteria

- [ ] Spec reviewed and approved
- [ ] DB migrations: `quick_posts_enabled` column on `teamspaces` (default `false`); seed permissions `tenant.posts.create` and `tenant.posts.moderate` and link to default roles
- [ ] Backend: `QUICK_POST` enum value, DTO conditional validation, `articles.service` create/delete branches, `GET /teamspaces/eligible-for-quick-post` endpoint
- [ ] Frontend: composer component, news-page integration, compact card variant, settings toggle in teamspace settings page
- [ ] E2E: 5 waves, ~25 tests, two new personas, suite green
- [ ] Tenant baseline regenerated (`npm run baseline:generate`) and committed
- [ ] No regressions in existing articles tests
