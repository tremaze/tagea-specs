# Contracts: Teamspace Home

## Services Consumed

| Service                       | Method(s) used                                                     | Purpose                                    |
| ----------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| `FeedService`                 | `getFeed(teamspaceIds, page, limit, lang?)`                        | Aggregated feed items across content types |
| `TeamspaceService`            | `getAccessibleTeamspaces()`, `hasAdminOrRedakteurRole()`           | Accessible teamspaces + active modules     |
| `AppointmentsService`         | `getMyNextAppointment(lang?)`, `getAppointment(id)`                | Next appointment for sidebar + card-click  |
| `SubmissionsService`          | `getAllSubmissions({ teamspace_id, employeeId })`                  | Sidebar submissions list (own submissions) |
| `ExternalContentsService`     | `getAll()`, `getBulkImageUrls(ids)`                                | Quick-links                                |
| `ContentReadStatusService`    | `markAsRead(type, id)`, `isRead(type, id)`                         | Auto-mark-as-read on scroll                |
| `TeamspaceUnreadCountService` | `calculateUnreadCounts(teamspaces)`, `updateCountForReadCard(...)` | Chip badges                                |
| `ArticleService`              | `toggleLike(id)`                                                   | Like/unlike news cards                     |
| `CurrentEmployeeService`      | `getCurrentEmployeeId()`, `hasProofOfSalaryAccess()`               | Submissions filter + quick-link gating     |
| `TenantFeaturesService`       | `isProofOfSalaryEnabled()`                                         | Quick-link gating                          |

> Exact method signatures live in each service under `apps/tagea-frontend/src/app/services/`. Flutter port should read those files when wiring Dio.

## Data Models (referenced)

```ts
// apps/tagea-frontend/src/app/models/teamspace.model.ts
interface Teamspace {
  id: string;
  name: string;
  is_active: boolean;
  active_modules?: {
    news?: boolean;
    events?: boolean;
    knowledge?: boolean;
    // + other modules
  };
  // + metadata
}

// Content read status uses a typed enum
// apps/tagea-frontend/src/app/services/content-read-status.service.ts
type ContentType = 'article' | 'event' | 'submission' | 'appointment';

// Feed card `contentType` values ('news', 'knowledge', 'article', 'event',
// 'submission', 'appointment') are mapped to the above via `mapToContentType()`:
// - 'news' | 'knowledge' | 'article' → 'article'
// - others pass through 1:1; submissions are tracked but not shown in the feed.
```

## Mappers

- `feedItemToFeedCard` — generic feed→card mapper
- `mapSubmissionToItemData(submission, translations)` — submission→sidebar item
- `mapNextAppointmentToCardData(appointment, locale)` — appointment→next-appointment card
