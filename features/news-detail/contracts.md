# Contracts: News Detail

## Article Fetch

| Context       | Service             | Method                           |
| ------------- | ------------------- | -------------------------------- |
| Teamspace     | `ArticleService`    | `getArticle(id, incrementView?)` |
| Client Portal | `ClientNewsService` | `getNewsArticle(id)`             |

Backend endpoints:

- Teamspace: `GET /articles/:id` (optional `?increment_view=true`)
- Client Portal: `GET /client-portal/news/:id`

Both return an article payload. The teamspace path returns `Article` (see
`apps/tagea-frontend/src/app/models/article.model.ts`); the client portal path
returns `NewsArticle` (see `apps/tagea-frontend/src/app/models/client-news.model.ts`).
The shared detail component maps both into the richer
`NewsArticleWithMeta` view-model defined in
`apps/tagea-frontend/src/app/models/editorial.model.ts`:

```ts
// Source: apps/tagea-frontend/src/app/models/editorial.model.ts
// Extends HelpArticle from apps/tagea-frontend/src/app/models/help.model.ts
interface NewsArticleWithMeta extends HelpArticle {
  status: NewsStatus;
  scheduledPublishDate?: Date;
  author: string;
  authorId: string;
  views: number;
  likes: number;
  createdAt: Date;
  publishedAt?: Date;
  updatedAt?: Date;
  teamspace_id?: string;
  teamspace_ids?: string[];
  teamspace?: Teamspace;
  requires_acknowledgment?: boolean;
}
```

> **Documentation-only shape.** The fields the component reads via bracket
> access (`has_acknowledged`, `acknowledged_at`, `comments_enabled`,
> `target_audience`, `feature_image_url`, `author_name`, `author_id`,
> `created_at`, `updated_at`, `published_at`, `video_url`) come from the
> backend article payload, not from `NewsArticleWithMeta` directly. They are
> documented here so the Flutter port knows what to expect on the wire:

```ts
// documentation-only
interface ArticleDetailPayloadExtras {
  feature_image_url?: string | null;
  author_id?: string;
  author_name?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  video_url?: string;
  has_acknowledged?: boolean;
  acknowledged_at?: string;
  comments_enabled?: boolean;
  target_audience?: string;
  requires_acknowledgment?: boolean;
}
```

> **Acknowledgement spelling:** editorial/news uses `requires_acknowledgment`
> (no extra `e` before `m`); broadcast client messages use
> `requires_acknowledgement` with the extra `e`. Mirror the exact spelling by
> domain.
>
> **Acknowledged state:** the "has the current user acknowledged" flag lives
> under `has_acknowledged` on the article payload (mirrored in
> `ArticleAcknowledgmentStatusDto`). The older `acknowledged_by_me` name is
> not used in the source.
>
> **Cover image:** the wire field is `feature_image_url` (see article payload
> and `feature-card-mappers.ts` / `article-card.component.ts`), not
> `cover_image_url`. On `HelpArticle` the camelCase alias `featureImageUrl`
> exists as well.

## Comments

| Context       | Service                 | Methods                                                                                                   |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Teamspace     | `CommentsService`       | `getCommentsByArticle`, `createComment`, `updateComment`, `deleteComment`, `likeComment`, `unlikeComment` |
| Client Portal | `ClientCommentsService` | same shape (client-portal-scoped)                                                                         |

Backend endpoints:

- Teamspace:
  - `GET  /comments/news/:newsId`
  - `POST /comments`
  - `PATCH /comments/:id`
  - `DELETE /comments/:id`
  - `POST /comments/:id/like` / `DELETE /comments/:id/like`
- Client Portal (all under the `/client-portal` prefix):
  - `GET  /client-portal/news/:newsId/comments`
  - `POST /client-portal/news/:newsId/comments`
  - `PATCH /client-portal/comments/:commentId`
  - `DELETE /client-portal/comments/:commentId`
  - `POST /client-portal/comments/:commentId/like` / `DELETE /client-portal/comments/:commentId/like`

Comment shape (from `apps/tagea-frontend/src/app/models/comments.model.ts`):

```ts
interface Comment {
  id: string;
  content: string;
  news_article_id: string;
  author_id: string | null;
  client_id?: string | null;
  author_name: string;
  likes: number;
  is_edited: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  hasLiked?: boolean;
}

interface CreateCommentDto {
  content: string;
  news_article_id: string;
}

interface UpdateCommentDto {
  content: string;
}
```

List responses are paginated:

```ts
interface PaginatedComments {
  data: Comment[];
  meta: { page: number; limit: number; total: number; total_pages: number };
}
```

## Like / Acknowledge

Like:

- Teamspace (staff): `ArticleService.toggleLike(id)` → `ArticleLikeStatus`
  (POST `/articles/:id/like`).
- Client Portal: `ClientNewsService.likeArticle(id)` → `{ likes; is_liked }`
  (POST `/client-portal/news/:id/like`).

Acknowledge:

- Teamspace (staff): `ArticleService.toggleAcknowledgment(id)` →
  `ArticleAcknowledgmentStatus` (POST `/articles/:id/acknowledge`).
- Client Portal: `ClientNewsService.acknowledgeArticle(id)` →
  `ArticleAcknowledgmentStatus` (POST `/client-portal/news/:id/acknowledge`).

Response shape (`apps/tagea-backend/src/articles/dto/article-acknowledgment.dto.ts`):

```ts
interface ArticleAcknowledgmentStatus {
  has_acknowledged: boolean;
  acknowledged_at: Date | null;
}
```

## Read Status

- Teamspace: `ContentReadStatusService.markAsRead(contentType, contentId)` —
  called as `markAsRead('article', article.id)`. The service batches and
  debounces sends to the backend (`POST /content-read-status/batch` or
  equivalent) — see `apps/tagea-frontend/src/app/services/content-read-status.service.ts`.
- Client Portal: `ClientNewsService.markAsSeen(articleId)` — POST
  `/client-portal/news/:id/seen` → `{ seen_at: Date | null }`.

## Attachments

- `ArticleService.getAttachments(articleId)` — GET `/articles/:id/attachments`,
  returns `{ attachments: ArticleAttachment[] }` (see
  `apps/tagea-frontend/src/app/models/article.model.ts`).
- Rendered via `ArticleAttachmentsDisplayComponent`.

## Secure Images

Cover and inline images are auth-gated. `SecureImageService` fetches with
token and returns a blob `SafeUrl`.

> **Flutter port note:** Same strategy as the client-news feature. Use `dio`
> with auth headers, render via `Image.memory` or customized
> `CachedNetworkImage`.

## Context Enum

```ts
export type NewsDetailContext = 'teamspace' | 'client-portal';
```

The component reads the context from `route.data.context` (see
`apps/tagea-frontend/src/app/routes/teamspace.routes.ts` and
`client-portal.routes.ts`).

> **Flutter port note:**
>
> ```dart
> enum NewsDetailContext { teamspace, clientPortal }
> ```
