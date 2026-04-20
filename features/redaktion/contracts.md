# Contracts: Redaktion

## Service: `ArticleService`

Relevant methods (exact signatures in [`article.service.ts`](../../../apps/tagea-frontend/src/app/services/article.service.ts)):

| Method                                                                        | Purpose                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `getEditorialArticles(filters: ArticleFilters)`                               | Editorial list (teamspace + institution redaktion mounts)   |
| `getInstitutionEditorialArticles(institutionId, filters: ArticleFilters)`     | Editorial list (klienten-news mount **only**)               |
| `getArticle(id)` / `getInstitutionArticle(institutionId, id)`                 | Single article for editor (dispatch via `isClientNewsMode`) |
| `createArticle(payload)` / `createInstitutionArticle(institutionId, payload)` | Create                                                      |
| `archiveArticle(id)` / `archiveInstitutionArticle(institutionId, id)`         | Archive (soft delete)                                       |

> Dispatch driver: `isClientNewsMode()` is computed from `targetAudience === 'clients'` (see `redaktion-page.component.ts` line 99). Only this mount hits the institution-scoped methods; teamspace and institution redaktion mounts share the non-institution methods. See lines 310–312 for the list-fetch branching.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/editorial.model.ts
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

interface NewsFilter {
  status?: NewsStatus | 'all';
  type?: ArticleType;
  category?: ArticleCategory;
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
  teamspaceId?: string;
  targetAudience?: 'staff' | 'clients';
  // + other filter fields
}

interface NewsSortOptions {
  field: 'createdAt' | 'updatedAt' | 'publishedAt' | 'title';
  direction: 'asc' | 'desc';
}
```

## Route data

Each mount carries different `route.data` entries:

| Mount                 | `route.data`      |
| --------------------- | ----------------- | ------------------------------------ |
| Teamspace Redaktion   | `{ mode: 'create' | 'edit' }` (for editor routes)        |
| Institution Redaktion | same              |
| Klienten-News         | `{ mode: 'create' | 'edit', targetAudience: 'clients' }` |

The component reads `route.data` and `route.parent` to determine scope.

> **Flutter port note:** this is an editor surface currently scoped ❌ for Flutter. If later ported, the three mounts should be distinct routes with a shared widget that takes an explicit `RedaktionScope` enum parameter.
