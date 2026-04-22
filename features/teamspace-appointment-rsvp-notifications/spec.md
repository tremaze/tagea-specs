# Feature: Teamspace Appointment RSVP Notifications

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

When an invited participant of a **teamspace appointment** responds (accept / decline), the **organizer** receives a push, email, and in-app notification. The organizer no longer has to poll the appointment detail page to learn about RSVPs.

This spec covers **only** the notification fan-out to the organizer. The RSVP UI itself is covered by [appointment-detail](../appointment-detail/spec.md). The generic notification center is covered by [notification-center](../../shell/notification-center/spec.md).

## User Stories

- As a **teamspace-appointment organizer** I want to receive a push notification when an invited staff member accepts, so that I can plan capacity without polling the detail page.
- As a **teamspace-appointment organizer** I want an in-app notification for every accept/decline event on my appointments, so that I have a consolidated inbox of RSVP activity.
- As a **teamspace-appointment organizer** I want an email when a last-minute decline happens, so that I can react even when the app is closed.
- As an **organizer who is also an invited participant** (edge case) I do not want to notify myself about my own response.

## Acceptance Criteria

### Trigger conditions

- [ ] **Given** a teamspace appointment (`appointments.teamspace_id IS NOT NULL`) with a staff participant whose `role === 'organizer'`, **When** another participant's `response_status` changes via one of the two RSVP code paths (staff self-RSVP or public magic-link RSVP), **Then** the backend sends a notification to the organizer on `[PUSH, EMAIL, IN_APP]`.
- [ ] **Given** the same appointment has no participant with `role === 'organizer'`, **When** an RSVP is received, **Then** no notification is sent (silent no-op; logged at `debug`).
- [ ] **Given** the respondent **is** the organizer themselves (self-RSVP), **When** the RSVP is processed, **Then** no notification is sent.
- [ ] **Given** a participant's `response_status` is changed by an admin edit (not an RSVP code path — e.g. full update by a user with `TS_EVENTS_CREATE`, post-appointment documentation setting `no_show_no_notice` / `completed`, appointment cancellation setting `cancelled_by_counselor`), **When** the change is saved, **Then** no RSVP notification is sent. Only the two RSVP code paths emit this notification.
- [ ] **Given** the appointment is **not** a teamspace appointment (`teamspace_id IS NULL`), **When** an RSVP occurs, **Then** no notification is sent. (This feature is scoped to teamspace appointments only.)

### Status mapping

RSVP code paths produce exactly two logical outcomes, regardless of the underlying `response_status` enum storage:

| Logical outcome | Storage values                                                              | Notification type           |
| --------------- | --------------------------------------------------------------------------- | --------------------------- |
| **Accepted**    | `'confirmed'`                                                               | `APPOINTMENT_RSVP_ACCEPTED` |
| **Declined**    | `'no_show_with_notice'` (>24h lead time) or `'no_show_short_notice'` (≤24h) | `APPOINTMENT_RSVP_DECLINED` |

- [ ] **Given** a respondent accepts, **When** the payload is built, **Then** `type === APPOINTMENT_RSVP_ACCEPTED`.
- [ ] **Given** a respondent declines (either declared-status variant), **When** the payload is built, **Then** `type === APPOINTMENT_RSVP_DECLINED`.
- [ ] **Given** the short-notice vs. with-notice split is a storage detail derived from lead time, **When** the notification is built, **Then** both decline storage variants collapse to the **same** notification type (the lead time does not split notifications).

### Re-responses (change of mind)

- [ ] **Given** a participant previously accepted, **When** they later decline, **Then** the organizer receives a fresh `APPOINTMENT_RSVP_DECLINED` notification. Every transition fires — no debounce, no "first transition only" filter.
- [ ] **Given** the new `response_status` is **identical** to the previous one (idempotent write), **When** the update runs, **Then** no notification is sent.

### Recipient / payload shape

- [ ] **Given** the notification fires, **When** the recipient is resolved, **Then** the organizer's `NotificationRecipient` is built from their `Employee` record (`id`, `auth_user_id`, `email`, full name).
- [ ] **Given** the organizer has `email_notifications === false` on their employee record, **When** the notification is dispatched, **Then** the email channel is suppressed by the existing `NotificationService` preference filter; push and in-app still fire. (No new preference plumbing — reuse current behavior.)
- [ ] **Given** the payload is built, **When** the organizer opens the notification, **Then** they are deep-linked to the teamspace appointment detail page (`/teamspace/kalender/{appointmentId}`). Same route convention as `APPOINTMENT_INVITATION`.
- [ ] **Given** the organizer opens the appointment detail page, **When** `dismissByContentId('appointment', appointmentId)` runs (existing behavior of the detail page), **Then** any unread RSVP notifications for that appointment are dismissed automatically.

### Respondent display name

The notification body names the respondent. Sourcing depends on `participant_type`:

| participant_type | Source for display name                                                | Fallback                                                      |
| ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `staff`          | `participantEmployee.first_name + ' ' + participantEmployee.last_name` | i18n key for "Staff member" (should not occur)                |
| `client`         | `client.first_name + ' ' + client.last_name`                           | i18n key for "Client" (should not occur)                      |
| `external`       | `external_name` (free-form)                                            | `external_email` if set; else i18n key "External participant" |

- [ ] **Given** the respondent is external and `external_name` is empty **and** `external_email` is set, **When** the body is built, **Then** the email is used as the display name.
- [ ] **Given** the respondent is external with neither `external_name` nor `external_email`, **When** the body is built, **Then** the fallback translation key for "External participant" is rendered (in the organizer's locale).

## Notification Content

### Title

Set by the backend from `NOTIFICATION_TITLES` (German):

- `APPOINTMENT_RSVP_ACCEPTED` → `"Zusage erhalten"`
- `APPOINTMENT_RSVP_DECLINED` → `"Absage erhalten"`

### Body

Generated in the backend. Format (German, translated to the organizer's locale where supported):

- Accept: `"{respondentName} hat zugesagt: {appointmentTitle}"`
- Decline: `"{respondentName} hat abgesagt: {appointmentTitle}"`

### Payload

```ts
{
  type: 'appointment_rsvp_accepted' | 'appointment_rsvp_declined',
  title: string,                // from NOTIFICATION_TITLES
  body: string,                 // see above
  data: {
    route: `/teamspace/kalender/${appointmentId}`,
    type: 'appointment_rsvp_accepted' | 'appointment_rsvp_declined',
    appointmentId: string,
    respondentParticipantId: string,
  },
  contentType: 'appointment',
  contentId: appointmentId,
}
```

## Flows

```
Respondent triggers RSVP
 ├── Staff self-RSVP: PATCH /teamspaces/.../appointment-participants/:id  (self-RSVP branch only)
 └── Magic-link RSVP: GET /public/rsvp/:token?response=confirm|decline
           │
           ▼
Backend updates `response_status` + `response_at` + participant history
           │
           ▼
Dispatcher: notifyOrganizerOfRsvp(manager, tenantId, appointmentId, respondent, newStatus, previousStatus)
           │
           ├── Is teamspace appointment?           ── no ──▶ stop
           ├── Is an RSVP-relevant transition?     ── no ──▶ stop  (see "Status mapping")
           ├── Was the status actually different?  ── no ──▶ stop  (idempotent)
           ├── Organizer participant exists?       ── no ──▶ stop
           ├── Organizer ≠ respondent?             ── no ──▶ stop
           │
           ▼
Resolve Organizer Employee → NotificationRecipient
Build payload (title, body, data, contentType, contentId)
           │
           ▼
NotificationService.sendBatch(tenantId, [organizerRecipient], payload, [PUSH, EMAIL, IN_APP], manager)
```

## Non-Goals

- **Non-teamspace (1:1 beratung) appointments** — out of scope. RSVP on counselor-run appointments is a different flow (client cancellation, not organizer notification). May be added in a later spec.
- **Recurring appointment series** — intentionally excluded from V1. When a participant RSVPs on a long recurrence series, every instance currently has its own `AppointmentParticipant` record; a single logical RSVP would produce N notifications. V1 does **not** attempt to aggregate, rate-limit, or suppress these. If spam becomes a real complaint, a later spec will introduce aggregation (probably a time-windowed digest). Rationale: aggregation changes the in-app data model and is a larger project than the RSVP notification itself.
- **Per-notification-type preference toggles** — organizers can only opt out of email globally (existing `email_notifications` flag). No per-type mute.
- **Retroactive notifications** — no backfill for historical RSVPs that happened before this feature shipped.
- **Cancellation notifications / reminder changes** — covered by the existing appointment notification pipeline and the [appointment-detail](../appointment-detail/spec.md) spec.
- **Organizer absence / delegation** — if the organizer is on leave, notifications still go to them. No delegate fan-out in V1.

## Edge Cases

- **Appointment has multiple participants with `role === 'organizer'`** — not expected by the domain model, but if it occurs, notify **all** staff organizers (resolve to each distinct `participant_employee_id`).
- **Organizer is not staff** — the entity model allows any `participant_type` in the organizer role. In practice teamspace-appointment organizers are always staff. If a non-staff organizer appears, log a warning and skip (no notification recipient can be resolved).
- **Organizer has no email** — employees always have an email, but if null, `EMAIL` channel is skipped by `NotificationService`; push + in-app still fire.
- **Respondent deleted concurrently** — the dispatcher runs in the same transaction / immediately after save; the respondent entity is still resolvable. If resolution fails, fall back to the generic "External participant" body label and still send.
- **Cancelled appointment** — if the appointment was cancelled before the RSVP arrived (stale magic link), the existing `RsvpService` guard already short-circuits before the dispatcher runs. No notification is sent.
- **Series appointment** (see Non-Goals) — V1: do **not** special-case. Every instance's RSVP sends its own notification. Document loudly in the org-wide release note.
- **Self-RSVP branch vs. admin-edit branch** — `AppointmentParticipantsService.update()` has two branches: (a) invited staff updating own `response_status`, (b) privileged user (`TS_EVENTS_CREATE`) updating any field. Only branch (a) triggers the notification. Branch (b) might set `response_status` to `no_show_no_notice` during post-doc — that is not an RSVP.

## Permissions & Tenant/Institution

- **Tenant context:** the notification is written to the tenant DB (`in_app_notifications.tenant_id`) and push/email use the tenant's brand for delivery.
- **Access control:** not applicable for the notification itself — it is system-generated.
- **Organizer permission check:** none required. Being the organizer of the appointment is sufficient to receive the notification.

## Notifications (Push / In-App)

- **Triggers:**
  - `AppointmentParticipantsService.update()` — only the self-RSVP branch (invited participant updating own `response_status`).
  - `RsvpService.handleResponse()` — every magic-link response.
- **Notification types:**
  - `APPOINTMENT_RSVP_ACCEPTED`
  - `APPOINTMENT_RSVP_DECLINED`
- **Channels:** `[PUSH, EMAIL, IN_APP]`. Email is suppressed by per-user `email_notifications === false`.
- **Deep link:** `/teamspace/kalender/{appointmentId}` (same route as `APPOINTMENT_INVITATION`).
- **Dismiss behavior:** in-app notifications for this appointment are dismissed when the organizer opens the detail page (existing `dismissByContentId('appointment', appointmentId)` on the detail route).

## i18n Keys

> User-facing strings remain in German; body is built in the backend and localized via the notification service's locale resolution (same pattern as other appointment notifications).

New keys needed across all 16 languages:

- `notifications.appointment_rsvp_accepted.title`
- `notifications.appointment_rsvp_declined.title`
- `notifications.appointment_rsvp.respondent_fallback_external` — fallback for external participants with neither name nor email.
- `notifications.appointment_rsvp.body_accepted` — parameterized: `{respondent}`, `{title}`.
- `notifications.appointment_rsvp.body_declined` — parameterized: `{respondent}`, `{title}`.

Backend `NOTIFICATION_TITLES` also needs the two new entries (German defaults) — matching the existing convention.

## Offline Behavior

**Flutter-specific:**

- Incoming push is delivered by the OS; the app consumes it on next foreground.
- In-app list is read from the paginated `/notifications` endpoint on app resume — same behavior as all other notification types.
- No special offline handling required for this feature.

## References

- **Dispatcher location (planned):** `apps/tagea-backend/src/appointments/services/` — either a new `appointment-rsvp-notifier.service.ts` or a private method on `AppointmentParticipantsService`. Final choice made during implementation based on circular-dependency risk.
- **Backend call sites (planned):**
  - `AppointmentParticipantsService.update()` (`apps/tagea-backend/src/appointments/services/appointment-participants.service.ts`) — self-RSVP branch.
  - `RsvpService.handleResponse()` (`apps/tagea-backend/src/public-api/rsvp.service.ts`) — magic-link RSVP.
- **Notification infrastructure:** `NotificationService.sendBatch()` (`apps/tagea-backend/src/notifications/services/notification.service.ts`).
- **Related specs:**
  - [appointment-detail](../appointment-detail/spec.md) — RSVP UI on the detail page.
  - [notification-center](../../shell/notification-center/spec.md) — how the in-app bell surfaces these.
- **Backend endpoints:** see [contracts.md](./contracts.md)
