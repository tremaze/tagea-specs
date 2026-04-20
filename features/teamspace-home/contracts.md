# Contracts: Teamspace Home

## Services Consumed

| Service                       | Method(s) used                                  | Purpose                                    |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `FeedService`                 | `getFeed({ teamspaceIds, ... })`                | Aggregated feed items across content types |
| `TeamspaceService`            | `getMyTeamspaces()` (or similar)                | Accessible teamspaces + active modules     |
| `AppointmentsService`         | `getNextAppointment()` / mappable shape         | Next appointment for sidebar               |
| `SubmissionsService`          | `getRecentForEmployee()`                        | Sidebar submissions list                   |
| `ExternalContentsService`     | `getForTeamspaces()`                            | Quick-links                                |
| `ContentReadStatusService`    | `markAsRead(type, id)`, `isRead(type, id)`      | Auto-mark-as-read on scroll                |
| `TeamspaceUnreadCountService` | per-teamspace unread counts (signal/observable) | Chip badges                                |

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
type ContentType = 'news' | 'event' | 'submission' | /* … */;
```

## Mappers

- `feedItemToFeedCard` — generic feed→card mapper
- `mapSubmissionToItemData(submission, translations)` — submission→sidebar item
- `mapNextAppointmentToCardData(appointment, locale)` — appointment→next-appointment card
