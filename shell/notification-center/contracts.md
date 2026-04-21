# Contracts: Notification Center

> Endpoints and data shapes between the Angular frontend and the NestJS
> `in-app-notifications` module. All endpoints require an authenticated
> **employee** (`UserType.EMPLOYEE`).

## Endpoints

All notification endpoints are mounted under `@Controller('notifications')`,
i.e. the API prefix is `/notifications` (no tenant/institution path
parameter — the server resolves the tenant from the auth context).

### `GET /notifications`

List the current employee's notifications (excludes dismissed rows),
ordered by `created_at DESC`.

**Query parameters** (`NotificationQueryDto` — backend DTO, not imported by the Angular client):

> Documentation-only shape. The frontend sends these as raw query string
> params; the interface is a reproduction of
> `apps/tagea-backend/src/in-app-notifications/dto/notification-query.dto.ts`.

```ts
interface UiNotificationQueryParams {
  is_read?: boolean; // filter by read status
  page?: number; // default 1, min 1
  limit?: number; // default 20, min 1, max 100
}
```

**Response:**

```ts
interface NotificationListResponse {
  notifications: InAppNotification[];
  total: number;
}
```

The frontend always calls this with `page=1, limit=20` (no pagination UI).

**Error codes:** 401 (no session), 403 (non-employee caller).

### `GET /notifications/unread-count`

Return the count of notifications with `is_read = false` and
`is_dismissed = false` for the current employee.

**Response:**

```ts
interface UnreadCountResponse {
  count: number;
}
```

**Error codes:** 401, 403. Silently handled in the frontend.

### `PATCH /notifications/:id/read`

Mark a single notification as read. Idempotent; the server filter `is_read = false`
means re-reads affect 0 rows but still return `{ success: true | false }`.

**Path params:** `id` — UUID of the notification (validated via `ParseUUIDPipe`).

**Response:**

> Documentation-only shape. Response is not modelled as a named TS interface
> on the client — the HTTP result is read inline.

```ts
interface UiMarkAsReadResponse {
  success: boolean;
}
```

**Error codes:** 400 (invalid UUID), 401, 403, 404 (not owned by caller).

### `PATCH /notifications/read-all`

Mark every unread notification for the current employee as read.

**Response:**

> Documentation-only shape.

```ts
interface UiMarkAllAsReadResponse {
  updated: number;
}
```

**Error codes:** 401, 403.

### `PATCH /notifications/:id/dismiss`

Hide a single notification from the list (`is_dismissed = true`). Used
internally by the invitation response flow (accept/decline hides the row
regardless of the participant-patch outcome).

**Response:**

> Documentation-only shape.

```ts
interface UiDismissResponse {
  success: boolean;
}
```

**Error codes:** 400, 401, 403, 404.

### `POST /notifications/dismiss-by-content`

Hide every notification that references a given content entity, for the
current employee. Invoked by feature pages when the user opens the
entity's detail view (so a stale invitation no longer shouts from the bell).

**Request body:**

> Documentation-only shape.

```ts
interface UiDismissByContentRequest {
  contentType: string;
  contentId: string;
}
```

**Response:**

> Documentation-only shape.

```ts
interface UiDismissByContentResponse {
  dismissed: number;
}
```

**Error codes:** 401, 403.

### `PATCH /institutions/:institutionId/appointment-participants/:id`

Used by the inline Accept / Decline buttons on `appointment_invitation`
rows. Only the `response_status` field is sent; the full DTO lives on the
appointment-participants feature.

> Documentation-only shape. Subset of `UpdateAppointmentParticipantDto`; see
> the appointments feature for the authoritative wire contract.

```ts
interface InvitationResponsePatch {
  response_status: 'confirmed' | 'no_show_with_notice';
}
```

Mapping from UI action:

- "Zusagen" → `response_status: 'confirmed'`
- "Absagen" → `response_status: 'no_show_with_notice'`
  (the client cannot tell whether a closer-to-start "no_show_short_notice" /
  "no_show_no_notice" value is more appropriate — the detail page handles
  those nuances.)

**Error codes:** 400 (invalid body / UUID), 401, 403, 404. On any error the
frontend calls `loadNotifications()` to resync.

## Events (WebSocket / Push)

No WebSocket channel today. New notifications arrive in one of two ways:

1. The next navigation or app-resume triggers `loadUnreadCount` / `loadNotifications`.
2. A parallel **push** notification is delivered to the device via
   `cross-cutting/bootstrap-and-push`. The push payload mirrors the in-app
   `data.route` so tapping the push deep-links correctly.

## Data Models

### In-App Notification (wire shape)

Matches the TypeORM `in_app_notifications` table. Field names are
**snake_case** to match the Postgres columns; nullability mirrors the entity.

> Documentation-only shape. The authoritative declaration lives in the
> backend entity below; the Angular client exposes a trimmed subset of these
> fields in `notification-center.service.ts`.

```ts
// Source: apps/tagea-backend/src/in-app-notifications/entities/in-app-notification.entity.ts
interface InAppNotification {
  id: string; // uuid
  tenant_id: string; // uuid
  employee_id: string; // uuid
  type: string; // one of NotificationType below
  title: string; // VARCHAR(255)
  body: string; // TEXT
  data: Record<string, string> | null; // jsonb, see "data payload shapes"
  content_type: string | null; // e.g. 'appointment', 'article'
  content_id: string | null; // uuid of the referenced entity
  is_read: boolean; // default false
  read_at: string | null; // ISO timestamp
  is_dismissed: boolean; // default false
  dismissed_at: string | null;
  created_at: string; // ISO timestamp
}
```

The frontend model in
`apps/tagea-frontend/src/app/services/notification-center.service.ts`
currently omits `content_type`, `content_id`, `is_dismissed`, `dismissed_at`
from its exported `InAppNotification` interface — those are present on the
wire but ignored in the overlay UI.

### Notification type enum (backend source of truth)

> Documentation-only shape. The Angular client treats `type` as an opaque
> string and only switches on a subset; the full enum lives in the backend.

```ts
// Source: apps/tagea-backend/src/notifications/interfaces/notification.interface.ts
enum NotificationType {
  NEW_ARTICLE = 'new_article',
  ARTICLE_UPDATE = 'article_update',
  ARTICLE_COMMENT = 'article_comment',
  ARTICLE_LIKE = 'article_like',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CREATED = 'appointment_created',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',
  APPOINTMENT_UPDATED = 'appointment_updated',
  APPOINTMENT_INVITATION = 'appointment_invitation',
  NEW_MESSAGE = 'new_message',
  NEW_CLIENT_INQUIRY = 'new_client_inquiry',
  TASK_ASSIGNED = 'task_assigned',
  TASK_DUE = 'task_due',
  TASK_COMPLETED = 'task_completed',
  NEW_SUBMISSION = 'new_submission',
  SUBMISSION_ASSIGNED = 'submission_assigned',
  APPROVAL_REQUEST = 'approval_request',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_DENIED = 'approval_denied',
  NEW_EVENT = 'new_event',
  EVENT_UPDATED = 'event_updated',
  EVENT_REMINDER = 'event_reminder',
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
}
```

Only the subset listed in the icon-mapping table of `spec.md` has a
dedicated icon; other values fall back to the generic `notifications`
icon. All values are valid in the list — the bell is agnostic of which
types actually get produced.

### `data` payload shapes (observed)

The `data` column is free-form JSONB. The values read by the notification
center are:

> Documentation-only shape. Keys are consumed by
> `NotificationCenterComponent`, not statically typed on the wire.

```ts
interface UiNotificationData {
  route?: string; // Angular router path to navigate on click
  participantId?: string; // uuid; present on appointment_invitation rows
  contentType?: string; // mirrors the top-level column, sometimes duplicated
  contentId?: string; // mirrors the top-level column, sometimes duplicated
}
```

Producer services may include additional keys; unknown keys are ignored.

## Frontend Service Surface

> Documentation-only shape. Summarizes `NotificationCenterService` for port
> reference — the Flutter client is free to pick its own state-management
> primitives.

```ts
// Source: apps/tagea-frontend/src/app/services/notification-center.service.ts
interface UiNotificationCenterService {
  notifications: Signal<InAppNotification[]>;
  unreadCount: Signal<number>;
  loading: Signal<boolean>;
  hasUnread: Signal<boolean>;
  loadUnreadCount(): Promise<void>;
  loadNotifications(page?: number, limit?: number): Promise<void>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  dismiss(id: string): Promise<void>;
  dismissByContent(contentType: string, contentId: string): Promise<void>;
}
```

> **Flutter port note:** Use `Riverpod` `StateNotifier`s (or a Bloc/Cubit
> pair) for `notifications` and `unreadCount`. The optimistic-then-revert
> pattern translates 1:1 — on HTTP failure, re-fetch both list and count
> rather than attempting local rollback.
