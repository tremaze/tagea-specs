# Contracts: Client Dashboard

## Endpoints Consumed

### Feed Content

| Endpoint                            | Source method                                 | Query params            | Response shape                                                         |
| ----------------------------------- | --------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- |
| `GET /appointments/my-appointments` | `ClientAppointmentsService.getMyAppointments` | `lang`, `page`, `limit` | `{ items, total, page, pages, limit }`                                 |
| `GET /client-portal/news`           | `ClientNewsService.getNews`                   | `limit`, `page`         | `PaginatedNews` — `{ items, total, page, pages, limit }`               |
| `GET /client-portal/messages`       | `ClientMessagesService.getMyMessages`         | `limit`, `page`         | `PaginatedClientMessages` — `{ data, total, page, limit, totalPages }` |

> Note on pagination casing: news uses `pages`, messages uses `totalPages` — the dashboard normalizes both via `updateSourcePagination`. Appointments are fetched as a single page (`limit: 100`, no client-side pagination in the feed).

### Sidebar Data

| Source                      | Method                                                      | Purpose                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ClientDocumentService`     | `getPendingSignatureTasks()`                                | Returns `ClientDocument[]`; dashboard shows first 3 plus total count                                                                                                                                                                                                                      |
| `ClientPortalService`       | `getAllUnreadCounts()` — `GET /client-portal/unread-counts` | Returns `UnreadCounts` — `{ messages, news, knowledge, appointments }` (backend also returns `inquiryReplies`, not consumed by this dashboard). Dashboard maps these into a `Map<string, number>` keyed by chip id (`messages`, `news`, `appointments`), with `documents` hardcoded to 0. |
| `ClientAppointmentsService` | `getMyAppointments({ lang, limit: 100 })`                   | Client-side filtered for upcoming `scheduled` items to find next appointment                                                                                                                                                                                                              |

### Auto-Mark-as-Read on Scroll

| Content type | Method                                           | Endpoint                                    |
| ------------ | ------------------------------------------------ | ------------------------------------------- |
| News         | `ClientNewsService.markAsSeen(sourceId)`         | `POST /client-portal/news/:id/seen`         |
| Messages     | `ClientMessagesService.markAsSeen(sourceId)`     | `POST /client-portal/messages/:id/seen`     |
| Appointments | `ClientAppointmentsService.markAsSeen(sourceId)` | `POST /client-portal/appointments/:id/seen` |

> All three return `{ seen_at: Date | null }`. Documents and submissions have no seen-tracking endpoint as of this spec.

### Like Action

- `ClientNewsService.likeArticle(articleId)` — `POST /client-portal/news/:id/like`; toggles server-side; response shape:

```ts
{
  likes: number;
  is_liked: boolean;
}
```

## Data Models (Feed Card)

> Documentation-only shape. The full interface lives in `TageaFeedCardComponent` — only the fields consumed by this dashboard are shown here.

```ts
// Source: TageaFeedCardComponent + feed-card-mappers util
interface FeedCardData {
  sourceId?: string; // for dedup + navigation
  contentType?: 'appointment' | 'article' | 'event' | 'news' | 'knowledge' | 'message';
  date: string;
  sortDate?: string; // ISO — used for chronological sort when present
  isRead?: boolean;
  managedClientId?: string;
  isLiked?: boolean;
  likeCount: number; // required on the base type (0 when no likes)
  footerMetadata?: { icon: string; label: string; value: string | number }[];
  // + type-specific rendering fields (title, description, author, icon, imageUrl, etc.)
}
```

## Tenant Feature Flag

- `isClientMessagesEnabled()` on `TenantFeaturesService` — gates whether the Messages chip is shown and whether `/client-messages` endpoints are called.

> **Flutter port note:** The tenant feature flags should be resolved once at app start (after the profile loads) and exposed as a reactive source, so UI can react to changes during a session (e.g., tenant toggles a feature in admin).
