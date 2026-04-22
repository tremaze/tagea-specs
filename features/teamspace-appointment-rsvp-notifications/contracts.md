# Contracts: Teamspace Appointment RSVP Notifications

> This feature adds two new notification types and a server-side dispatcher. There are **no new HTTP endpoints**. The endpoints that *trigger* the dispatcher are existing endpoints documented here for reference.

## New NotificationType values

> Documentation-only shape.

```ts
// apps/tagea-backend/src/notifications/interfaces/notification.interface.ts
export enum NotificationType {
  // ... existing values unchanged ...
  APPOINTMENT_RSVP_ACCEPTED = 'appointment_rsvp_accepted',
  APPOINTMENT_RSVP_DECLINED = 'appointment_rsvp_declined',
}
```

> Documentation-only shape.

```ts
// apps/tagea-backend/src/notifications/constants/notification.constants.ts
export const NOTIFICATION_TITLES: Record<string, string> = {
  // ...
  appointment_rsvp_accepted: 'Zusage erhalten',
  appointment_rsvp_declined: 'Absage erhalten',
};
```

## Notification payload

> Documentation-only shape.

```ts
// Built by the RSVP dispatcher; consumed by NotificationService.sendBatch(...)
interface RsvpNotificationPayload {
  type: NotificationType.APPOINTMENT_RSVP_ACCEPTED | NotificationType.APPOINTMENT_RSVP_DECLINED;
  title: string;                 // from NOTIFICATION_TITLES
  body: string;                  // "{respondentName} hat zugesagt: {appointmentTitle}" (localized)
  data: {
    route: `/teamspace/kalender/${string}`;
    type: 'appointment_rsvp_accepted' | 'appointment_rsvp_declined';
    appointmentId: string;
    respondentParticipantId: string;
  };
  contentType: 'appointment';
  contentId: string;             // appointmentId
}
```

## Triggering endpoints (existing, unchanged behavior)

### `PATCH /teamspaces/:teamspaceId/appointment-participants/:id`

Handled by `TeamspaceAppointmentParticipantsController` → `AppointmentParticipantsService.update()`.

**Self-RSVP branch (triggers dispatcher):**

- Authenticated employee is the participant being updated.
- Request body:

  > Documentation-only shape.

  ```ts
  interface UpdateAppointmentParticipantDto {
    response_status: 'confirmed' | 'no_show_with_notice' | 'no_show_short_notice';
  }
  ```

- Only the `response_status` field is accepted in this branch.

**Admin-edit branch (does NOT trigger dispatcher):**

- Caller has `TS_EVENTS_CREATE` on the teamspace.
- Any field on `AppointmentParticipant` may be updated.
- Even if `response_status` changes, the RSVP notification does not fire (this branch covers post-appointment documentation and administrative corrections).

### `GET /public/rsvp/:token?tenantId=...&response=confirm|decline`

Handled by the backend `RsvpController`, which delegates to the `handleResponse` method on `RsvpService` (backend-only — not present in frontend source).

- Public endpoint (no auth); caller proves identity via the `invitation_token` on the participant row.
- Maps `response=confirm` → `response_status = 'confirmed'`.
- Maps `response=decline` → `response_status = 'no_show_with_notice'` (>24h until start) or `'no_show_short_notice'` (≤24h).
- Always triggers the dispatcher after the participant is saved.

## Dispatcher contract

> Documentation-only shape. Planned — exact location TBD during implementation. Either a new service or a private method on `AppointmentParticipantsService`.

```ts
async notifyOrganizerOfRsvp(
  manager: EntityManager,
  tenantId: string,
  appointmentId: string,
  respondent: AppointmentParticipant,
  newStatus: ParticipantResponseStatus,
  previousStatus: ParticipantResponseStatus,
): Promise<void>;
```

**Returns:** `void`. Failures are logged at `warn` and swallowed — an RSVP must never fail because a notification could not be sent.

**Preconditions checked in order (each short-circuits silently):**

1. Appointment exists and `appointment.teamspace_id !== null`.
2. Logical transition is `accepted` or `declined`:
   - accepted: `newStatus === 'confirmed'`
   - declined: `newStatus ∈ { 'no_show_with_notice', 'no_show_short_notice' }`
   - otherwise: stop (covers admin edits writing `no_show_no_notice`, `completed`, `cancelled_by_counselor`).
3. `newStatus !== previousStatus` (idempotent writes don't re-notify).
4. A participant with `role === 'organizer'` exists on the appointment.
5. The organizer's underlying identity is **not** the respondent (self-RSVP suppression). Compared by `AppointmentParticipant.id`.
6. Organizer is `participant_type === 'staff'` and resolves to an Employee with `auth_user_id`.

When all preconditions pass:

> Documentation-only shape.

```ts
await notificationService.sendBatch(
  tenantId,
  [organizerRecipient],
  payload,
  [NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.IN_APP],
  manager,
);
```

## Recipient resolution

> Documentation-only shape.

```ts
// Resolved from the organizer AppointmentParticipant:
interface NotificationRecipient {
  type: 'employee';
  id: string;                  // Employee.id
  authUserId: string;          // Employee.auth_user_id — required for push
  email?: string;              // Employee.email — email channel drops if falsy
  name?: string;               // `${first_name} ${last_name}`
}
```

The `NotificationService` already applies the organizer's `email_notifications` preference to suppress the email channel. No new preference plumbing is introduced.

## Respondent display name

> Documentation-only shape.

```ts
function resolveRespondentName(participant: AppointmentParticipant): string {
  switch (participant.participant_type) {
    case 'staff':
      return `${employee.first_name} ${employee.last_name}`.trim();
    case 'client':
      return `${client.first_name} ${client.last_name}`.trim();
    case 'external':
      return (
        participant.external_name?.trim() ||
        participant.external_email?.trim() ||
        translate('notifications.appointment_rsvp.respondent_fallback_external', locale)
      );
  }
}
```

## Events (WebSocket / Push)

No new WebSocket events are introduced. Push delivery reuses the existing `PushGatewayClientService` path (Matrix push gateway).

## Error codes

None new. The triggering endpoints retain their existing error codes (401, 403, 404, 410 for expired magic links, etc.). Dispatcher failures are swallowed.
