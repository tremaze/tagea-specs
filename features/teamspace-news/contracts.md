# Contracts: Teamspace News

## Service: `ArticleService`

Methods relevant to this page (exact signatures in [`article.service.ts`](../../../apps/tagea-frontend/src/app/services/article.service.ts)):

| Method                                                        | Purpose                                                  |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| `getForTeamspaces({ teamspaceIds?, search?, page?, limit? })` | Paginated article list                                   |
| `getById(id)`                                                 | Single article for detail view (shared with news-detail) |

## Data Models

```ts
// apps/tagea-frontend/src/app/models/article.model.ts
interface Article {
  id: string;
  title: string;
  display_title?: string;
  content: string;
  author_name?: string;
  feature_image_url?: string; // secure — fetch via SecureImageService
  attachments?: ArticleAttachment[];
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;
  status: ArticleStatus;
  type: ArticleType;
  category?: ArticleCategory;
  teamspace_id?: string;
  teamspace_ids?: string[];
  // + metadata
}

// Enums
// ArticleStatus, ArticleType, ArticleCategory — exact values in the model file
```

## Search

- Debounced ~300ms via RxJS (`debounceTime(300)` + `distinctUntilChanged()`).
- Server-side full-text match on title + content.
- AND-composed with active teamspace filter.

## Secure images

Cover images require auth. `SecureImageService.loadImage(url)` fetches with JWT and returns `SafeUrl`.

> **Flutter port note:** mirror the Dio-based auth-fetch + `Image.memory` / `CachedNetworkImage` pattern documented for [client-news](../client-news/contracts.md).
