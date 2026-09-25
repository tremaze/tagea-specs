# Contracts: Notification Center

> Endpoints and data shapes between the Angular frontend and the NestJS
> `in-app-notifications` module. Verified against
> `apps/tagea-backend/src/in-app-notifications/in-app-notifications.controller.ts`,
> `services/in-app-notification.service.ts`, `dto/notification-query.dto.ts`
> and `entities/in-app-notification.entity.ts` (2026-09-25).

## Endpoints

All endpoints live on `InAppNotificationsController`, `@Controller('notifications')`
(API path `/notifications`, no tenant/institution path parameter — the tenant
comes from the auth context). Class-level guard:
`@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.EMPLOYEE, UserType.CLIENT] })`
— **employees and clients** (#3879). No `allowPendingApproval`: an account that
is pending approval/activation or suspended gets **403** on every endpoint.

The recipient is derived from the request principal as a typed pair
(`recipient_type` = `employee` | `client`, `recipient_id` = own id); every query
filters on both columns. For **client** recipients the service additionally
restricts every read and mutation to client-visible types
(`CLIENT_VISIBLE_NOTIFICATION_TYPES`, `notifications/constants/notification-audience.map.ts`).
For **employee** recipients, list and unread count exclude the types of the
categories in `employees.in_app_hidden_categories` (set on the employee
profile's notification tab); clients have no hidden-category filter.

| Method + path | Request | Response |
|---|---|---|
| `GET /notifications` | query `NotificationQueryDto` | `{ notifications, total }` |
| `GET /notifications/unread-count` | — | `{ count }` |
| `PATCH /notifications/read-all` | — (Angular sends `{}`) | `{ updated }` |
| `PATCH /notifications/:id/read` | — (Angular sends `{}`) | `{ success }` |
| `PATCH /notifications/:id/dismiss` | — (Angular sends `{}`) | `{ success }` |
| `POST /notifications/dismiss-by-content` | `{ contentType, contentId }` | `{ dismissed }` |

All responses are 200 (`POST` → 201). Common errors: 401 (no session), 403
(principal is neither employee nor client, or account not usable).

### `GET /notifications`

The recipient's notifications, **excluding dismissed rows**, ordered by
`created_at DESC`, paged with `skip = (page - 1) * limit`.

**Query parameters** (`NotificationQueryDto` — backend DTO):

> Documentation-only shape. The frontend sends these as raw query string
> params; the interface is a reproduction of
> `apps/tagea-backend/src/in-app-notifications/dto/notification-query.dto.ts`.

```ts
interface UiNotificationQueryParams {
  is_read?: boolean; // 'true' / 'false' strings are coerced; anything else → 400
  page?: number;     // integer ≥ 1, default 1
  limit?: number;    // integer 1–100, default 20
}
```

**Response:**

```ts
interface NotificationListResponse {
  notifications: InAppNotification[];
  total: number; // count of all matching rows (same filters, without paging)
}
```

The Angular client requests `page=1&limit=20` when the menu opens and the
next pages (`page=2, 3, …`, `limit=20`) via "Mehr laden" / infinite scroll;
it never sends `is_read`.

**Errors:** 400 (invalid `is_read`, `page`, `limit`), 401, 403.

### `GET /notifications/unread-count`

Count of rows with `is_read = false` and `is_dismissed = false` for the
recipient (hidden categories excluded for employees, client allowlist for
clients).

```ts
interface UnreadCountResponse {
  count: number;
}
```

**Errors:** 401, 403. The Angular client swallows errors (badge keeps its value) and marks 403 as an expected status for Sentry.

### `PATCH /notifications/read-all`

Sets `is_read = true`, `read_at = now()` on every unread row of the recipient
(client allowlist applies). **Hidden categories are not excluded** — rows the
employee cannot see are marked read too. Dismissed-but-unread rows are also
marked.

> Documentation-only shape.

```ts
interface UiMarkAllAsReadResponse {
  updated: number; // rows changed
}
```

### `PATCH /notifications/:id/read`

Marks one row read. `id` is validated by `ParseUUIDPipe` (400 on a non-UUID).
There is **no 404**: an unknown id, a row of another recipient, a row outside
the client allowlist or an already-read row all return `{ success: false }`
with 200.

> Documentation-only shape. Response is not modelled as a named TS interface
> on the client — the HTTP result is not read.

```ts
interface UiMarkAsReadResponse {
  success: boolean; // true when a row was changed
}
```

### `PATCH /notifications/:id/dismiss`

Sets `is_dismissed = true`, `dismissed_at = now()`; the row disappears from the
list and the count. Same semantics as `read`: 400 on a non-UUID, otherwise 200
`{ success: false }` for unknown / foreign / already-dismissed rows. The bell
itself no longer calls it (no inline invitation actions); it remains available
via `NotificationCenterService.dismiss(id)`.

> Documentation-only shape.

```ts
interface UiDismissResponse {
  success: boolean;
}
```

### `POST /notifications/dismiss-by-content`

Dismisses every not-yet-dismissed row of the recipient whose top-level
`content_type` **and** `content_id` columns match (the `data` JSON is not
consulted). Called by detail pages when the user opens the entity:
`termine-detail` (`'appointment'`) and `support-ticket-detail`
(`'support_ticket'`).

**Request body:** inline type `{ contentType: string; contentId: string }` —
no DTO class, so the global `ValidationPipe` does not validate it.

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
  dismissed: number; // rows changed
}
```

**Errors:** 401, 403. The Angular client ignores errors.

### Removed from this contract

`PATCH /institutions/:institutionId/appointment-participants/:id` is **no
longer called by the notification center** — the inline „Zusagen“ / „Absagen“
buttons were removed; invitations are answered on the appointment detail page
(see [teamspace-appointment-rsvp-notifications](../../features/teamspace-appointment-rsvp-notifications/spec.md)).

## Events (WebSocket / Push)

No WebSocket channel today. New notifications reach the bell by:

1. Unread-count reloads on session ready, on navigation, on app resume / tab
   focus (`SilentRefreshTriggerService.refresh$`) and whenever the menu opens.
2. A parallel **push** notification delivered via
   `cross-cutting/bootstrap-and-push`. The push payload carries the same
   `data.route`, so tapping the push deep-links identically.

## Data Models

### In-App Notification (wire shape)

Matches the TypeORM `in_app_notifications` table; field names are
**snake_case**. The row is returned as the full entity.

> Documentation-only shape. The authoritative declaration lives in the
> backend entity below; the Angular `InAppNotification` interface in
> `notification-center.service.ts` declares a subset (it omits
> `content_type`, `content_id`, `is_dismissed`, `dismissed_at`).

```ts
// Source: apps/tagea-backend/src/in-app-notifications/entities/in-app-notification.entity.ts
interface InAppNotification {
  id: string; // uuid
  tenant_id: string; // uuid
  recipient_type: 'employee' | 'client'; // VARCHAR(16), polymorphic recipient (#3879)
  recipient_id: string; // uuid — employees.id or clients.id (no FK)
  type: string; // VARCHAR(50), one of NotificationType below
  title: string; // VARCHAR(255)
  body: string; // TEXT
  data: Record<string, string> | null; // jsonb, see "data payload shapes"
  content_type: string | null; // VARCHAR(50), e.g. 'appointment', 'support_ticket'
  content_id: string | null; // uuid of the referenced entity
  is_read: boolean; // default false
  read_at: string | null; // ISO timestamp (timestamptz)
  is_dismissed: boolean; // default false
  dismissed_at: string | null;
  created_at: string; // ISO timestamp
}
```

There is no `employee_id` column any more (replaced by
`recipient_type` + `recipient_id`, migration
`20260908130000-MakeInAppNotificationsRecipientPolymorphic`).

### Notification type values (backend source of truth)

> Documentation-only shape. The Angular client treats `type` as an opaque
> string and only switches on a subset for icons; the enum lives in
> `apps/tagea-backend/src/notifications/interfaces/notification.interface.ts`.

```ts
// documentation-only — NotificationType values (2026-09-25)
type NotificationTypeValue =
  // articles
  | 'new_article' | 'article_update' | 'article_comment' | 'article_like' | 'comment_reported'
  // appointments
  | 'appointment_reminder' | 'appointment_created' | 'appointment_cancelled' | 'appointment_updated'
  | 'appointment_invitation' | 'appointment_rsvp_accepted' | 'appointment_rsvp_declined'
  // messages / inquiries / tasks
  | 'new_message' | 'new_client_inquiry' | 'task_assigned' | 'task_due' | 'task_completed'
  // reminders (Wiedervorlagen / checklists)
  | 'reminder_assigned_to_client' | 'reminder_overdue_nudge' | 'reminder_checklist_completed'
  // submissions / signatures / approvals
  | 'new_submission' | 'submission_assigned' | 'submission_responded' | 'submission_status_changed'
  | 'signature_requested' | 'document_signed'
  | 'approval_request' | 'approval_granted' | 'approval_denied'
  // events
  | 'new_event' | 'event_updated' | 'event_reminder'
  | 'event_registration_pending' | 'event_registration_approved' | 'event_registration_rejected'
  | 'event_registration_waitlisted' | 'event_registration_promoted'
  | 'event_registration_cancelled_by_organizer' | 'event_registration_new_pending'
  | 'event_registration_new_confirmed' | 'event_registration_user_cancelled'
  | 'event_guardian_consent_requested' | 'event_guardian_consent_confirmed' | 'event_guardian_consent_rejected'
  // support tickets
  | 'support_ticket_created' | 'support_ticket_assigned' | 'support_ticket_resolved'
  | 'support_ticket_comment' | 'support_ticket_mention' | 'support_ticket_deleted'
  // system / account
  | 'system_announcement'
  | 'join_request_pending' | 'join_request_approved' | 'join_request_rejected'
  | 'managed_person_request_pending' | 'managed_person_approved' | 'managed_person_rejected';
```

Only the values in the icon table of `spec.md` have a dedicated icon; the
rest fall back to `notifications`.

### `data` payload shapes (observed)

The `data` column is free-form JSONB. Keys read by the notification center:

> Documentation-only shape. Keys are consumed by
> `NotificationCenterComponent`, not statically typed on the wire.

```ts
interface UiNotificationData {
  route?: string; // SPA path to navigate on click (normalised client-side, see spec)
  institutionId?: string; // used by the join-request fallback route
  contentType?: string; // sometimes duplicated from the column (optimistic dismiss-by-content)
  contentId?: string; // sometimes duplicated from the column
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
  loadingMore: Signal<boolean>;
  total: Signal<number>;
  hasUnread: Signal<boolean>;
  hasMore: Signal<boolean>; // notifications().length < total()
  loadUnreadCount(): Promise<void>;
  loadNotifications(): Promise<void>; // page 1, replaces the list
  loadMore(): Promise<void>; // next page, appended, de-duplicated by id
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  dismiss(id: string): Promise<void>;
  dismissByContent(contentType: string, contentId: string): Promise<void>;
}
```

> **Flutter port note:** Use a Cubit/Bloc (or `StateNotifier`) for
> `notifications` + `unreadCount` + paging cursor. The optimistic-then-resync
> pattern translates 1:1 — on HTTP failure, re-fetch list and count rather
> than attempting local rollback. Do not treat `{ success: false }` as an
> error.
