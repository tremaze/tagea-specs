# Contracts: Teamspace Quick Posts

> Verified against `apps/tagea-backend/src/articles/articles.controller.ts`, `articles.service.ts`, `dto/create-article.dto.ts`, `dto/article-attachment.dto.ts`, `teamspaces/teamspaces.controller.ts` and `packages/models/src/lib/media-upload.ts` (2026-09-25).

## Endpoints

All endpoints require a bearer token. `ArticlesController` is class-level `@Auth({ scope: 'authenticated' })` + `TeamspaceModuleGuard`; per-type permission checks for articles run in `ArticlesService.assertArticlePermission` (not as decorators).

| Method + path | Gate | Used for |
|---|---|---|
| `GET /teamspaces/eligible-for-quick-post` | `@Auth({ scope: 'tenant', permissions: ['tenant.posts.create'] })` | picker options |
| `POST /articles/attachments/upload` | authenticated employee | pending attachment upload (create mode) |
| `POST /articles/:id/attachments/upload` | authenticated + teamspace module of the article | attachment upload onto an existing post (edit mode) |
| `DELETE /articles/:id/attachments/:attachmentId` | authenticated + teamspace module of the article | remove attachment (edit mode) → 204 |
| `GET /articles/:id/attachments` | authenticated | attachments when opening edit mode |
| `POST /articles/images/upload` | authenticated | feature (title) image and inline editor images |
| `POST /articles` | service: `tenant.posts.create` + membership + `quick_posts_enabled` | create quick post |
| `PATCH /articles/:id` | service: author, else `tenant.posts.create` + membership in all targets | edit quick post |
| `DELETE /articles/:id` | service: author, `tenant.posts.moderate`, or `news.edit` in any target | delete quick post → 204 |
| `PATCH /teamspaces/:id` | `@Auth({ scope: 'tenant', permissions: ['tenant.teamspaces.edit'] })` | toggle `quick_posts_enabled` |

### `GET /teamspaces/eligible-for-quick-post`

Returns the teamspaces the current user can target: active teamspaces with `quick_posts_enabled = true` in which the user has a teamspace assignment. Holders of `tenant.teamspaces.access_all` (Träger-Admin, super-admin) get **all** active teamspaces with the flag.

**Request:** no body, no query.

**Response 200:** `Teamspace[]` — the regular teamspace response shape (`TeamspaceResponseDto`, incl. `institution_ids`), not a reduced DTO. The Angular client (`TeamspaceService.getEligibleForQuickPost()`) types it as `Teamspace[]`.

**Errors:** 401; 403 when `tenant.posts.create` is missing — the Angular client maps a 403 to an empty list (composer hidden).

### `POST /articles/attachments/upload` (pending attachment)

Uploads one file **before** the article exists. The row is stored with `article_id = null` under `article-attachments/{tenantId}/pending/`; `POST /articles` with `attachment_ids` associates it and moves the file to `article-attachments/{tenantId}/{articleId}/`.

**Request:** `multipart/form-data`

| Part | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | yes | exactly one file per request (`FileInterceptor('file', …)`) |
| `description` | string | no | caption, stored on the attachment |

**Limits** (shared preset `MEDIA_UPLOAD_PRESETS.mediaAttachment`, also used by the Angular client for pre-validation):

| Kind | MIME types | Max size |
|---|---|---|
| image | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 10 MB |
| video | `video/mp4`, `video/webm` | 50 MB |
| pdf | `application/pdf` | 10 MB |

Other types → 400 (rejected by the multer file filter before buffering). Transport cap is 50 MB (multer `fileSize`, larger → 413); the per-kind cap is enforced afterwards → 400. Missing file → 400 `No file provided`. Non-GIF raster images are converted to WebP (the response `mimetype`/`size` then describe the stored file); GIFs keep their bytes.

**Response 201** (`AttachmentUploadResponseDto`; Angular `AttachmentUploadResponse`):

```ts
// apps/tagea-frontend/src/app/models/article.model.ts
interface AttachmentUploadResponse {
  id: string;                 // pass in attachment_ids on create
  url: string;                // backend proxy path: /articles/attachments/{tenantId}/{attachmentId}/{filename}
  original_filename: string;
  mimetype: string;
  size: number;               // bytes
}
```

**Errors:** 400 (type, size, no file, no employee context), 401, 413.

`POST /articles/:id/attachments/upload` has the same request, limits and response, but attaches straight to an existing article (404 if the article does not exist). The composer uses it in edit mode.

> There is no `POST /articles/attachments/pending` endpoint (earlier drafts of this spec named it).

### `POST /articles` — `article_type = 'quick_post'`

Body: `CreateArticleDto` (JSON). What the Angular `ArticleService.createQuickPost()` sends:

> Documentation-only shape — request body built by `createQuickPost`.

```ts
// documentation-only
{
  article_type: 'quick_post',
  status: 'published',
  title: string,             // required, 3–200 chars (same rule as every article type)
  content: string,           // TipTap HTML
  teamspace_ids: string[],   // ≥ 1
  attachment_ids?: string[], // ids from POST /articles/attachments/upload
  feature_image_url?: string,
  feature_image_alt?: string,
}
```

Server behaviour (`ArticlesService.create`):

- Forced values, whatever the client sends: `status = published`, `target_audience = employees`, `requires_acknowledgment = false`, `comments_enabled = true`, `likes_enabled = true`, `hide_from_feed = false`; `scheduled_publish_date`, `video_url`, `related_articles`, `context_keys`, `tags`, `change_description`, `institution_id`, `category_id` are cleared. `feature_image_url` / `feature_image_alt` are kept.
- A singular `teamspace_id` is accepted and canonicalised to `teamspace_ids = [teamspace_id]`.
- `attachment_ids`: only attachments that are still pending (`article_id IS NULL`) are associated; unknown or already-associated ids are ignored silently. No uploader check.

**Validation order:**

1. Authenticate (employee).
2. Unless the caller holds `tenant.teamspaces.access_all`: require `tenant.posts.create` (403 `Fehlende Berechtigung: tenant.posts.create`), ≥ 1 teamspace (403 `Schnellbeiträge benötigen mindestens einen Teamspace`) and access to **every** target teamspace (403 `Keine Mitgliedschaft im Teamspace {id}`).
3. Every target teamspace must have `quick_posts_enabled = true`, otherwise 403 `Schnellbeiträge sind im Teamspace {id} nicht aktiviert` (applies to `access_all` holders too).
4. Persist, associate attachments, push notification as for `news`.

**Response 201:** the created `Article`.

**Errors:** 400 (DTO, e.g. title shorter than 3 characters), 401, 403 (capability, membership or flag).

### `PATCH /articles/:id` — quick post

The composer (edit mode) sends `{ content, title, feature_image_url, feature_image_alt }` only; teamspaces are not changed and attachments are reconciled live via the attachment endpoints. Allowed for the author; for non-authors the same check as create applies (`tenant.posts.create` + access to all current target teamspaces).

### `DELETE /articles/:id` — quick post

```
isAuthor                                          → allow
tenant.teamspaces.access_all                      → allow
tenant.posts.moderate                             → allow
news.edit in ANY of the post's teamspaces         → allow
otherwise                                         → 403 "Nur Autoren oder Teamspace-Admins können Artikel löschen"
```

Response 204. The article is removed from all target teamspaces.

### `PATCH /teamspaces/:id`

`UpdateTeamspaceDto` (partial of `CreateTeamspaceDto`) accepts `quick_posts_enabled?: boolean` (`@IsOptional() @IsBoolean()`, default `false`). The endpoint requires the tenant permission `tenant.teamspaces.edit` — not a teamspace permission. The Angular toggle lives in the teamspace dialog (`teamspace-tabbed-dialog`).

### Engagement endpoints — unchanged

`POST /articles/:id/like` and `POST /articles/:id/acknowledge` require `tenant.articles.engage`; `POST /articles/bulk-like-status` and the comment endpoints key off `article_id` only and work unchanged for quick posts.

## Data Models

### `Article` — no schema change

`article_type` is a `varchar` column; `quick_post` is a value of the `ArticleType` enum.

### `Teamspace` — column

`teamspaces.quick_posts_enabled BOOLEAN NOT NULL DEFAULT FALSE` (migration `20260506200000-AddTeamspaceQuickPosts`).

### `ArticleType` enum

```ts
export enum ArticleType {
  NEWS = 'news',
  KNOWLEDGE = 'knowledge',
  DOCUMENTATION = 'documentation',
  ANNOUNCEMENT = 'announcement',
  QUICK_POST = 'quick_post',
}
```

### Permissions (migration `20260506200000-AddTeamspaceQuickPosts`)

| Permission | Default tenant roles |
|---|---|
| `tenant.posts.create` | `mitarbeiter`, `personalverwalter`, `traeger_manager` |
| `tenant.posts.moderate` | `traeger_manager` |

## Frontend Service Methods

| Service | Method | Endpoint |
|---|---|---|
| `ArticleService` | `createQuickPost(input)` | `POST /articles` (sets `article_type` and `status`) |
| `ArticleService` | `uploadPendingAttachment(file, description?)` | `POST /articles/attachments/upload` (reports progress) |
| `ArticleService` | `uploadAttachment(articleId, file, description?)` | `POST /articles/:id/attachments/upload` |
| `ArticleService` | `deleteAttachment(articleId, attachmentId)` | `DELETE /articles/:id/attachments/:attachmentId` |
| `ArticleService` | `uploadImage(file)` | `POST /articles/images/upload` |
| `ArticleService` | `updateArticle(id, dto)` / `deleteArticle(id)` | `PATCH` / `DELETE /articles/:id` |
| `TeamspaceService` | `getEligibleForQuickPost()` | `GET /teamspaces/eligible-for-quick-post` (403 → `[]`) |
| `QuickPostActionsService` | `editById(articleId)`, `confirmAndDelete(articleId, title)` | shared edit/delete flows |

## Feed filter

`FilterArticleDto` has `article_types[]` (plural) next to `article_type`; when both are present `article_types` wins. The teamspace feed requests `article_types = ['news', 'quick_post']`.

## Audit

`entity_changelog` rows on create and delete via the existing `Article` trigger — no new audit hook.

## Events (WebSocket / Push)

- A new `quick_post` reuses the teamspace-news push pipeline (same as `news`). No new event types.

> **Flutter port note:** upload each attachment as its own `multipart/form-data` request with the part name `file` (Dio `FormData`), keep the returned `id`s and send them as `attachment_ids` on create; in edit mode upload to `/articles/:id/attachments/upload` instead. Pre-validate with the limits table above.
