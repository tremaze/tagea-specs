# Contracts: Teamspace Quick Posts

## Endpoints

All endpoints require a bearer token. New endpoints share the existing `ArticlesController` and `TeamspacesController` patterns.

### `GET /teamspaces/eligible-for-quick-post` (new)

Returns the list of teamspaces the current user can post a quick post into — i.e., where they are a member and `quick_posts_enabled = true`.

**Request:** no body, no query.

**Response:**

> Documentation-only shape.

```ts
interface EligibleTeamspaceForQuickPost {
  id: string;
  name: string;
  visibility: 'public' | 'institution_bound';
  institution_id: string | null;
  institution_name: string | null;
}

type EligibleResponse = EligibleTeamspaceForQuickPost[];
```

**Error codes:** 401, 403 (missing `tenant.posts.create`).

### `POST /articles` (extended)

Existing endpoint. New behavior when `article_type = QUICK_POST`:

- `title` is **required** (`@Length(3, 200)`), identical to NEWS. As of 2026-05-15 — the prior optional-title behavior is dropped; legacy DB rows with empty title remain readable but cannot be re-created.
- `content` is **required** (`@MinLength(1)`) and is **HTML** (TipTap output, identical sanitization as NEWS).
- `category_id` is optional and ignored.
- `status` is forced to `PUBLISHED` server-side.
- `target_audience` is forced to `EMPLOYEES` server-side.
- `requires_acknowledgment`, `comments_enabled`, `likes_enabled`, `feature_image_url`, `tags`, `related_articles`, `context_keys`, `scheduled_publish_date` are ignored / forced to defaults.
- `teamspace_ids` is required (≥ 1); `teamspace_id` (singular) is rejected for QUICK_POST to keep the multi-target path canonical.
- `attachment_ids` works as today (pre-uploaded via `POST /articles/attachments/pending`).

**Validation order (server):**

1. Authenticate.
2. If `article_type = QUICK_POST`: assert `tenant.posts.create`. Else existing checks.
3. For each `teamspace_id` in payload: assert membership AND `teamspace.quick_posts_enabled = true`. If any fails → 403 with the offending teamspace id.
4. Persist.

**Error codes:** 400 (DTO), 401, 403 (capability or per-teamspace), 422 (attachment ownership mismatch).

### `DELETE /articles/:id` (extended)

Existing endpoint. New permission resolution for `article_type = QUICK_POST`:

```
isAuthor                                    → allow
hasTenantPostsModerate                      → allow
hasTsArticlesDelete in ANY post.teamspace_ids → allow
otherwise                                   → 403
```

For non-QUICK_POST article types the existing logic is unchanged.

### `PATCH /teamspaces/:id` (extended)

Existing settings endpoint accepts an additional optional field:

```ts
interface UpdateTeamspaceDto {
  // ...existing fields
  quick_posts_enabled?: boolean;
}
```

Requires `ts.settings.edit` for the teamspace as today.

### Engagement endpoints — unchanged

`POST /articles/:id/like`, `POST /articles/bulk-like-status`, comment endpoints, etc. all work transparently for `QUICK_POST` because they key off `article_id` only.

## DTOs (Backend)

### `CreateArticleDto` extension

> Documentation-only shape — exact decorators in `apps/tagea-backend/src/articles/dto/create-article.dto.ts`.

```ts
class CreateArticleDto {
  // Title is required for ALL article types (including QUICK_POST since 2026-05-15)
  @IsString()
  @Length(3, 200)
  title!: string;

  // Content shape: HTML for editorial articles AND quick posts. Per-type min length:
  // - QUICK_POST: ≥ 1 char
  // - other types: ≥ 10 chars (existing)
  @IsString()
  content!: string;

  @ValidateIf((o) => o.article_type !== ArticleType.QUICK_POST)
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsEnum(ArticleType)
  article_type!: ArticleType;

  // teamspace_ids[] required (≥ 1) for QUICK_POST; existing rules apply otherwise
}
```

## Data Models

### `Article` — no schema change

`article_type` is already a `varchar` column; adding `QUICK_POST` to the TS enum does not require an `ALTER COLUMN`. No new fields on `Article`.

### `Teamspace` — new column

```sql
ALTER TABLE teamspaces ADD COLUMN quick_posts_enabled BOOLEAN NOT NULL DEFAULT FALSE;
```

### `ArticleType` enum (TypeScript)

```ts
export enum ArticleType {
  NEWS = 'news',
  KNOWLEDGE = 'knowledge',
  DOCUMENTATION = 'documentation',
  ANNOUNCEMENT = 'announcement',
  QUICK_POST = 'quick_post', // new
}
```

### Permissions (seed migration)

```sql
INSERT INTO permissions (name, ...) VALUES
  ('tenant.posts.create', ...),
  ('tenant.posts.moderate', ...);

-- Default role mappings
INSERT INTO role_permissions (role, permission_name) VALUES
  ('counselor',  'tenant.posts.create'),
  ('supervisor', 'tenant.posts.create'),
  ('manager',    'tenant.posts.create'),
  ('admin',      'tenant.posts.create'),
  ('admin',      'tenant.posts.moderate');
```

(Exact migration follows the pattern of `20260205140000-AddClientProfileDeletePermission.ts`.)

## Frontend Service Methods (planned additions)

> Documentation-only shape.

```ts
// apps/tagea-frontend/src/app/services/article.service.ts (extension)
class ArticleService {
  // existing methods unchanged

  createQuickPost(input: {
    content: string;
    title?: string;
    teamspace_ids: string[];
    attachment_ids?: string[];
  }): Observable<Article>;
}

// apps/tagea-frontend/src/app/services/teamspace.service.ts (extension)
class TeamspaceService {
  getEligibleForQuickPost(): Observable<EligibleTeamspaceForQuickPost[]>;
}
```

`createQuickPost` is a thin wrapper over `POST /articles` that hard-codes `article_type=QUICK_POST` and `status=PUBLISHED`.

## Filter changes

`getArticles({ article_type })` is the existing filter. The teamspace news page extends its query to include both types:

```ts
// Before
{ article_type: ArticleType.NEWS, ... }
// After (option A: array form, requires backend support)
{ article_types: [ArticleType.NEWS, ArticleType.QUICK_POST], ... }
// After (option B: drop article_type filter for the feed view)
{ /* no article_type, server returns NEWS + QUICK_POST by default for teamspace context */ }
```

> **Implementation question:** Add `article_types[]` (plural) to `FilterArticleDto` or change the default behavior of the teamspace news endpoint when no type is specified? *Decision deferred to implementation; A is preferred — explicit is better than implicit, and the existing single-type filter stays unaffected.*

## Audit

`entity_changelog` rows on create and delete via the existing `Article` trigger — no new audit hook.

## Events (WebSocket / Push)

- New `QUICK_POST` reuses the existing teamspace-news push pipeline. No new event types.

> **Flutter port note:** mirror the Dio-based `multipart/form-data` pattern for attachment upload (same as Redaktion attachments). The composer's two-step (pending → associate) flow is identical for Flutter.
