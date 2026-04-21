# Contracts: Client News

## Service: `ClientNewsService`

| Method                                                             | Purpose                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `getNews({ page?, limit?, search?, category_ids?, category_id? })` | Paginated list of news articles (maps to `GET /client-portal/news`)               |
| `getNewsArticle(id)`                                               | Single article (used by shared detail component; `GET /client-portal/news/:id`)   |
| `getCategories()`                                                  | Flat hierarchical category list (`GET /client-portal/news/categories`)            |
| `likeArticle(id)`                                                  | Toggle like; returns `{ likes: number; is_liked: boolean }` (`POST .../:id/like`) |
| `markAsSeen(id)`                                                   | Persist seen status; returns `{ seen_at: Date \| null }` (`POST .../:id/seen`)    |
| `acknowledgeArticle(id)`                                           | Toggle explicit acknowledgment for articles with `requires_acknowledgment=true`   |
| `getAcknowledgmentStatus(id)`                                      | Ack status for a single article                                                   |
| `getBulkAcknowledgmentStatus(articleIds)`                          | Ack status for many articles (used when loading the list)                         |
| `translateArticle(articleId, language, force?)`                    | AI-translate title + content to a target language                                 |
| `getTranslationStatuses(articleId)`                                | Availability/staleness per supported language                                     |

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/services/client-news.service.ts
interface NewsArticle {
  id: string;
  title: string;
  content: string; // full body text; display card derives excerpts via getPreviewText()
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  tags?: string[];
  author_name: string;
  feature_image_url?: string; // requires auth via SecureImageService
  feature_image_alt?: string;
  video_url?: string;
  views: number;
  likes: number;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  // Acknowledgment fields
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;
  acknowledged_at?: Date | null;
  // Seen status (from entity tracking)
  is_seen?: boolean;
  // Interaction settings
  comments_enabled?: boolean;
  likes_enabled?: boolean;
  comment_count?: number;
}

interface NewsCategory {
  id: string;
  name_de: string;
  icon?: string;
  parent_id?: string | null; // null/undefined => root category
}

interface NewsFilter {
  page?: number;
  limit?: number;
  category_id?: string;
  category_ids?: string[]; // serialized as comma-separated query param; takes precedence over category_id
  search?: string;
}

interface PaginatedNews {
  items: NewsArticle[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
```

## Endpoints (Backend: `ClientPortalController`, prefix `/client-portal`)

| Method | Path                                             | Purpose                                                                            |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| GET    | `/client-portal/news`                            | Paginated list (supports `page`, `limit`, `category_id`, `category_ids`, `search`) |
| GET    | `/client-portal/news/categories`                 | Category list (flat, with `parent_id`)                                             |
| GET    | `/client-portal/news/:id`                        | Single article                                                                     |
| POST   | `/client-portal/news/:id/like`                   | Toggle like                                                                        |
| POST   | `/client-portal/news/:id/seen`                   | Mark as seen (auto from scroll)                                                    |
| POST   | `/client-portal/news/:id/acknowledge`            | Toggle explicit acknowledgment                                                     |
| GET    | `/client-portal/news/:id/acknowledgment-status`  | Ack status for current client                                                      |
| POST   | `/client-portal/news/bulk-acknowledgment-status` | Bulk ack status (body: `{ article_ids: string[] }`)                                |
| GET    | `/client-portal/news/:id/translations`           | Translation statuses per language                                                  |
| POST   | `/client-portal/news/:id/translate`              | Request/generate a translation                                                     |
| GET    | `/client-portal/news/unread-count`               | Unread news count for dashboard                                                    |

All endpoints are protected by `@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.CLIENT] })` applied at the controller level.

## Secure Images

Cover images are served as authenticated resources. `SecureImageService.loadImage(imageUrl): Promise<SafeUrl | null>` fetches the image with the auth token and returns a `SafeUrl` (blob URL) for safe binding.

> **Flutter port note:** Use `dio` to fetch the image bytes with the auth header, then display via `Image.memory` or `CachedNetworkImage` with a custom `HttpClient`. Do not rely on raw `<img>` src equivalents that would not include auth.

## Search

- Debounce: ~300ms (standard)
- Server-side matching on title + content (exact behavior: verify against backend)
- Search scope is bound by active category selection — the frontend sends `category_ids` (root + descendants or the explicit subcategory selection) together with `search` on the same request

## Category filter wire format

When root category `R` is active:

- **No subcategories selected** — send `category_ids=[R, ...R.children]` (root + all children, comma-joined).
- **One or more subcategories selected** — send `category_ids=[...selectedSubIds]` only.
- **"Alle" selected** — omit `category_ids` entirely.

The backend accepts both `category_id` (single) and `category_ids` (comma-separated list); when both are present, `category_ids` wins.
