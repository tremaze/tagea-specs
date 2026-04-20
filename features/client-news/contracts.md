# Contracts: Client News

## Service: `ClientNewsService`

| Method                                            | Purpose                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `getNews({ limit, page, search?, categoryIds? })` | Paginated list of news articles                             |
| `getArticleById(id)`                              | Single article (used by shared detail component)            |
| `getCategories()`                                 | Hierarchical category tree                                  |
| `likeArticle(id)`                                 | Toggle like; returns `{ is_liked: boolean; likes: number }` |
| `markAsSeen(id)`                                  | Persist seen status (auto-tracking from feed/list)          |

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/services/client-news.service.ts
interface NewsArticle {
  id: string;
  title: string;
  display_title?: string; // translated
  content: string; // full body text; display card derives excerpts from the first N chars
  author_name?: string;
  feature_image_url?: string; // requires auth via SecureImageService
  category_ids: string[];
  is_liked?: boolean;
  likes: number;
  is_seen?: boolean;
  published_at: string; // ISO
  // + other metadata
}

interface NewsCategory {
  id: string;
  name: string;
  parent_id?: string | null;
  // hierarchical
}
```

## Secure Images

Cover images are served as authenticated resources. `SecureImageService.loadImage(imageUrl): Promise<SafeUrl | null>` fetches the image with the auth token and returns a `SafeUrl` (blob URL) for safe binding.

> **Flutter port note:** Use `dio` to fetch the image bytes with the auth header, then display via `Image.memory` or `CachedNetworkImage` with a custom `HttpClient`. Do not rely on raw `<img>` src equivalents that would not include auth.

## Search

- Debounce: ~300ms (standard)
- Server-side matching on title + content (exact behavior: verify against backend)
- Search scope is bound by active category selection
