# Contracts: News Detail

## Article Fetch

| Context       | Service             | Method               |
| ------------- | ------------------- | -------------------- |
| Teamspace     | `ArticleService`    | `getById(id)`        |
| Client Portal | `ClientNewsService` | `getArticleById(id)` |

Both return `NewsArticleWithMeta` (see `apps/tagea-frontend/src/app/models/editorial.model.ts`):

```ts
// Source: apps/tagea-frontend/src/app/models/editorial.model.ts
// (extends HelpArticle from apps/tagea-frontend/src/app/models/help.model.ts)
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
  requires_acknowledgment?: boolean; // note: news uses `requires_acknowledgment` (no extra `e`)
  // HelpArticle fields include: id, title, content, feature_image_url, attachments, etc.
}
```

> **Acknowledgement spelling:** editorial/news uses `requires_acknowledgment` (no extra `e` before `m`); broadcast client messages use `requires_acknowledgement` with the extra `e`. Mirror the exact spelling by domain.
>
> **Acknowledged state:** the "has the current user acknowledged" flag lives under `has_acknowledged` on adjacent message / article shapes (see `models/article.model.ts` and `models/client-message.model.ts`). The older `acknowledged_by_me` name is not used in the source.
>
> **Cover image:** the field name is `feature_image_url` (see news article shape + `feature-card-mappers.ts` / `article-card.component.ts`), not `cover_image_url`.

## Comments

| Context       | Service                 | Methods                                        |
| ------------- | ----------------------- | ---------------------------------------------- |
| Teamspace     | `CommentsService`       | `getForArticle(articleId)`, `create`, `delete` |
| Client Portal | `ClientCommentsService` | same shape                                     |

Comment shape (from `comments.model.ts`):

```ts
interface Comment {
  id: string;
  article_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
  // + metadata
}
```

## Like / Acknowledge

- `ClientNewsService.likeArticle(id)` / staff equivalent on `ArticleService` — returns `{ is_liked; likes }`.
- Acknowledge endpoint — verify method name (likely `acknowledgeArticle(id)` on the same service).

## Read Status

- Teamspace: `ContentReadStatusService.markAsRead(articleId)` (verify).
- Client portal: `ClientNewsService.markAsSeen(articleId)`.

## Secure Images

Cover and inline images are auth-gated. `SecureImageService` fetches with token and returns a blob `SafeUrl`.

> **Flutter port note:** Same strategy as the client-news feature. Use `dio` with auth headers, render via `Image.memory` or customized `CachedNetworkImage`.

## Context Enum

```ts
export type NewsDetailContext = 'teamspace' | 'client-portal';
```

Flutter equivalent:

```dart
enum NewsDetailContext { teamspace, clientPortal }
```
