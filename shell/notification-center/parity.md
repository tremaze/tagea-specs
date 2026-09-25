# Parity: Notification Center

## Angular

- **Status:** ✅
- **Component:** `apps/tagea-frontend/src/app/components/notification-center/notification-center.component.ts`
- **Template:** `apps/tagea-frontend/src/app/components/notification-center/notification-center.component.html`
- **Service:** `apps/tagea-frontend/src/app/services/notification-center.service.ts`
- **Badge service:** `apps/tagea-frontend/src/app/services/app-badge.service.ts`
- **Shell wiring:**
  - `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts`
  - `apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts`
- **E2E:** _(none dedicated)_; helpers in `apps/tagea-frontend-e2e/src/utils/notification-center.utils.ts`, used by e.g. `client-portal/klientenportal-benachrichtigungen.spec.ts`, `support/support-ticket-notifications.spec.ts`

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/features/notifications/` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/notifications/`

## Known Divergences

- **No timer polling on either platform.** Angular refreshes `unreadCount` on
  navigation and app-resume; the Flutter port should hook into the same
  lifecycle events (`WidgetsBindingObserver.didChangeAppLifecycleState`
  plus a listener on the router).
- **Native app-icon badge.** On iOS/Android the app-icon badge reflects the
  sum of unread in-app notifications + unread chat rooms. The Angular
  implementation delegates to `AppBadgeService` via Capacitor; the Flutter
  port should use a maintained badge plugin (subject to dependency review)
  and call it from the
  same points in the optimistic-update flow.
- **Targets the app cannot open.** Angular (web) navigates to every target. Flutter marks the notification read and shows „Dieser Inhalt ist nur im Web verfügbar“ when no mobile screen exists for the route (owner decision 2026-09-25).
- **No inline RSVP.** The bell no longer offers „Zusagen“ / „Absagen“ (removed in Angular); Flutter must not add them — invitations are answered on the appointment detail page.
- **Clients too.** The bell is shown for clients (client portal) as well as employees; the route normaliser maps targets into `/client-portal/...` for clients.
- **`getRelativeTime` is inlined and German-only.** Flutter port should use
  `package:intl` with the same tier thresholds (1m / 60m / 24h / 7d).

## Port Log

| Date       | Who      | What                                                  |
| ---------- | -------- | ----------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec + contracts + parity written from Angular source |
| 2026-09-25 | Claude (M2-Specs) | Contracts re-verified against `in-app-notifications.controller.ts`: employees + clients, `recipient_type`/`recipient_id` (no `employee_id`), hidden-category filter, 200 `{success:false}` instead of 404, query validation, dismiss-by-content semantics; removed the appointment-participants PATCH (inline RSVP gone); pagination („Mehr laden“) and full type list documented |
| 2026-09-25 | Claude (M2-Specs QA) | Web-only targets: mark read + snackbar (owner decision); offline wording aligned with WP3; badge plugin wording |
