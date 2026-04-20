# Contracts: Client Dashboard

## Endpoints Consumed

### Feed Content

| Endpoint                                   | Source method                                 | Query params    |
| ------------------------------------------ | --------------------------------------------- | --------------- |
| `GET /api/client-appointments` (mock path) | `ClientAppointmentsService.getMyAppointments` | `lang`, `limit` |
| `GET /api/client-news`                     | `ClientNewsService.getNews`                   | `limit`, `page` |
| `GET /api/client-messages`                 | `ClientMessagesService.getMyMessages`         | `limit`, `page` |

> Exact paths are inside the respective services (not re-documented here). Flutter port should read paths from those services when wiring Dio.

### Sidebar Data

| Source                      | Method                                    | Purpose                                                                            |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `ClientDocumentService`     | `getPendingSignatureTasks()`              | Returns `ClientDocument[]`; dashboard shows first 3 plus total count               |
| `ClientPortalService`       | `getAllUnreadCounts()`                    | Returns `{ messages, news, appointments }` as unread counts for filter chip badges |
| `ClientAppointmentsService` | `getMyAppointments({ lang, limit: 100 })` | Client-side filtered for upcoming `scheduled` items to find next appointment       |

### Auto-Mark-as-Read on Scroll

| Content type | Method                                           |
| ------------ | ------------------------------------------------ |
| News         | `ClientNewsService.markAsSeen(sourceId)`         |
| Messages     | `ClientMessagesService.markAsSeen(sourceId)`     |
| Appointments | `ClientAppointmentsService.markAsSeen(sourceId)` |

> Documents and submissions have no seen-tracking endpoint as of this spec.

### Like Action

- `ClientNewsService.likeArticle(articleId)` — toggles server-side; response shape:

```ts
{
  is_liked: boolean;
  likes: number;
}
```

## Data Models (Feed Card)

```ts
// Source: component state plus feed-card-mappers util
interface FeedCardData {
  sourceId: string; // for dedup + navigation
  contentType: 'appointment' | 'news' | 'message' | 'event';
  date: string;
  sortDate?: string; // ISO — used for chronological sort when present
  isRead: boolean;
  managedClientId?: string;
  isLiked?: boolean;
  likeCount?: number;
  footerMetadata?: { icon: string; label: string; value: string | number }[];
  // + type-specific rendering fields
}
```

## Tenant Feature Flag

- `isClientMessagesEnabled()` on `TenantFeaturesService` — gates whether the Messages chip is shown and whether `/client-messages` endpoints are called.

> **Flutter port note:** The tenant feature flags should be resolved once at app start (after the profile loads) and exposed as a reactive source, so UI can react to changes during a session (e.g., tenant toggles a feature in admin).
