# Contracts: Knowledge Base

## Services

| Service                | Methods                                                                                                       | Purpose                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ArticleService`       | `getArticles({ article_type: ArticleType.KNOWLEDGE, search?, categoryId?, page?, limit? })`, `getArticle(id)` | Local knowledge articles via the generic `getArticles` with a type filter |
| `GlobalArticleService` | `getArticles({ search?, categoryId? })`, `getCategories()`                                                    | Global (system-provided) articles                                         |

Exact signatures in the respective service files — Flutter port reads there.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/article.model.ts — same shape used by teamspace-news
interface Article {
  id: string;
  title: string;
  display_title?: string;
  content: string;
  author_name?: string;
  feature_image_url?: string;
  attachments?: ArticleAttachment[];
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;
  status: ArticleStatus;
  type: ArticleType;
  category?: ArticleCategory;
  teamspace_id?: string;
  teamspace_ids?: string[];
}

// apps/tagea-frontend/src/app/models/global-article.model.ts
interface GlobalArticle {
  id: string;
  title: string;
  content: string;
  category_id?: string | null;
  // + metadata mirroring Article
}

interface GlobalArticleCategory {
  id: string;
  name: string;
  parent_id?: string | null;
  icon?: string;
  // + metadata
}
```

## UI-helper type

```ts
// Component-local — not a backend type
interface CategoryWithIcon {
  key: string;
  name: string;
  description?: string;
  icon: string;
  articleCount?: number;
  children?: CategoryWithIcon[];
  parent_id?: string | null;
  is_global?: boolean;
}

interface ArticleWithGlobalFlag extends Article {
  is_global?: boolean;
}
```
