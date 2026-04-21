# Contracts: Teamspace News

## Service: `ArticleService`

Methods relevant to this page (exact signatures in [`article.service.ts`](../../../apps/tagea-frontend/src/app/services/article.service.ts)):

| Method                           | Purpose                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `getArticles(filters)`           | Paginated article list (maps to `GET /articles` with `ArticleFilters` query) |
| `getArticle(id, incrementView?)` | Single article for detail view (shared with news-detail)                     |
| `getCategories(filters)`         | Article categories scoped by teamspace (`GET /articles/categories`)          |
| `getBulkLikeStatus(articleIds)`  | Batch like-state lookup for the initial list render                          |
| `toggleLike(id)`                 | Toggle like state for the signed-in user                                     |

The page calls `getArticles` with the following filter shape:

> Documentation-only shape.

```ts
// Subset of ArticleFilters used by NewsPageComponent
interface TeamspaceNewsFilter {
  teamspace_ids: string[]; // one or more teamspaces the user can access
  article_type: ArticleType; // ArticleType.NEWS
  status: ArticleStatus; // ArticleStatus.PUBLISHED
  sort_by: string; // 'published_at'
  sort_order: 'ASC' | 'DESC'; // 'DESC'
  page: number;
  limit: number;
  search?: string; // debounced user search
  category_id?: string; // only when exactly one category chip is selected
  lang?: string; // non-German UI languages only
}
```

## Data Models

```ts
// apps/tagea-frontend/src/app/models/article.model.ts
interface Article {
  id: string;
  title: string;
  content: string;
  article_type: ArticleType;
  status: ArticleStatus;
  category_id: string | null;
  category?: {
    id: string;
    name_de: string;
    icon?: string | null;
  };
  author_name: string;
  published_at?: Date | null;
  feature_image_url?: string | null; // secure — fetch via SecureImageService
  feature_image_alt?: string | null;
  views: number;
  likes: number;
  comment_count: number;
  isLiked?: boolean;
  teamspace_id?: string | null;
  teamspace_ids?: string[];
  // Translation (when `lang` query parameter is used)
  display_title?: string;
  display_content?: string;
  translation_language?: string | null;
  // Acknowledgment
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;
  // Interaction settings
  likes_enabled?: boolean;
  comments_enabled?: boolean;
}

// Enums
// ArticleType, ArticleStatus — exact values in the model file
```

## Endpoints (Backend: `ArticlesController`, prefix `/articles`)

| Method | Path                         | Purpose                                              |
| ------ | ---------------------------- | ---------------------------------------------------- |
| GET    | `/articles`                  | Paginated article list (filter DTO above)            |
| GET    | `/articles/:id`              | Single article                                       |
| GET    | `/articles/categories`       | Category list with three-tier scoping                |
| POST   | `/articles/:id/like`         | Toggle like                                          |
| POST   | `/articles/bulk-like-status` | Batch like state (body: `{ article_ids: string[] }`) |

All endpoints require a bearer token (`@ApiBearerAuth()` on the controller).

## Search

- Debounced ~300ms via RxJS (`debounceTime(300)` + `distinctUntilChanged()`).
- Server-side match on title and content (see `FilterArticleDto.search` — "Search query for title and content").
- AND-composed with the active teamspace filter (`teamspace_ids`) and, when exactly one chip is active, `category_id`. Multiple selected categories are filtered client-side.

## Secure images

Cover images require auth. `SecureImageService.loadImage(url)` fetches with JWT and returns `SafeUrl`.

> **Flutter port note:** mirror the Dio-based auth-fetch + `Image.memory` / `CachedNetworkImage` pattern documented for [client-news](../client-news/contracts.md).
