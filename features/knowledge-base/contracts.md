# Contracts: Knowledge Base

## Services

| Service                | Methods                                                                                                                                                                                                                            | Purpose                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ArticleService`       | `getArticles({ article_type: ArticleType.KNOWLEDGE, status?, search?, category_id?, include_subcategories?, tags?, page?, limit? })`, `getArticle(id)`, `getCategories({ article_type, is_active? })`, `getAttachments(articleId)` | Local knowledge articles via the generic `getArticles` with a type filter |
| `GlobalArticleService` | `getArticles({ article_type, status?, search?, category_id?, tags? })`, `getCategories({ article_type, is_active? })`                                                                                                              | Global (system-provided) articles                                         |

Exact signatures in the respective service files — Flutter port reads there.

Backend endpoints (see `apps/tagea-backend/src/articles/articles.controller.ts` and `global-articles.controller.ts`):

- `GET /articles` — tenant articles; filters serialized as query params
- `GET /articles/:id` — single article (optional `?increment_view=true`)
- `GET /articles/categories` — tenant + global category tree (three-tier scoping)
- `GET /articles/:id/attachments` — attachments fetched separately (not embedded on the article)
- `GET /global-articles` — global article catalogue (meta schema)
- `GET /global-articles/categories` — global categories

## Data Models

> Documentation-only shape. Fields below are the subset the knowledge-base screens read — the full `BaseArticle`/`Article` interface (tags, target_audience, views, likes, author_id, timestamps, etc.) lives in the model files.

```ts
// apps/tagea-frontend/src/app/models/article.model.ts — shared base with teamspace-news
interface Article {
  id: string;
  title: string;
  display_title?: string;
  content: string;
  author_name: string;
  feature_image_url?: string | null;
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;
  status: ArticleStatus;
  article_type: ArticleType;
  category?: { id: string; name_de: string; icon?: string | null };
  teamspace_id?: string | null;
  teamspace_ids?: string[];
  institution_id?: string | null;
}

// apps/tagea-frontend/src/app/models/global-article.model.ts
interface GlobalArticle {
  id: string;
  title: string;
  content: string;
  article_type: ArticleType;
  status: ArticleStatus;
  category_id: string | null;
  category?: GlobalArticleCategory | null;
  is_global: boolean;
  unique_identifier?: string | null;
  // + BaseArticle metadata (tags, author_name, views, likes, timestamps, etc.)
}

interface GlobalArticleCategory {
  id: string;
  name_de: string;
  description_de?: string | null;
  parent_id?: string | null;
  icon?: string | null;
  article_type: ArticleType;
  is_active: boolean;
  sort_order: number;
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
