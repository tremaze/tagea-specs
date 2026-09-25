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

- **Status:** 🚧 Bell, badge and full-screen center implemented (WP10, [tremaze/tagea-next-flutter#86](https://github.com/tremaze/tagea-next-flutter/pull/86)); native app-icon badge deferred (Asana „Entscheidungen offen“ → „WP10: App-Icon-Badge …“), client-portal targets pending (no `/client-portal/*` screens yet)
- **Paths:**
  - UI: `apps/tagea_frontend/lib/features/notifications/` (page, bell, sync, navigation hook, route mapper)
  - Route `/notifications`: `apps/tagea_frontend/lib/routing/routes/notifications_routes.dart` (on the deep-link allowlist)
  - Bell: `NotificationBell` inside `TageaTopBar`; sync `NotificationCenterSync`, router hook `NotificationNavigationHook`
  - `packages/teamspace_core`: `src/notifications/` — `NotificationsApi`, `NotificationCenterCubit` (+ state, model)
  - `packages/ui`: `TageaBadgedIconButton`, `TageaNotificationTile`
- **Integration tests:** `integration_test/notifications/` _(to be written)_; widget tests cover page states, paging, mutations, route mapper, navigation hook

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
- **No inline RSVP.** The bell no longer offers „Zusagen“ / „Absagen“ (removed in Angular); Flutter does not add them — invitations open the appointment detail page, where they are answered.
- **Clients too.** The bell is shown for clients (client portal) as well as employees; the route normaliser maps targets into `/client-portal/...` for clients.
- **Full-screen page instead of the bell overlay menu** (PM decision, UX §3). Flutter route `/notifications`.
- **Infinite paging instead of „Mehr laden“.** Shared `TageaRefreshableList` pattern (20 rows per page); a failed page turns the end spinner into a retry row.
- **Errors are not silent in Flutter.** Failed first load → error state with retry; failed refresh → snackbar, list kept (UX §6). Mutation failures resync silently, as in Angular.
- **Pull-to-refresh on the list** (product decision; Angular has none).
- **No swipe-to-hide.** A swipe gesture on rows was removed from the Flutter port; like Angular, rows are only marked read (tap / „Alle gelesen“) and hidden only via `dismiss-by-content`.
- **Client-only accounts** currently get the web-only snackbar for every target, because the app has no `/client-portal/*` screens yet.
- **Native app-icon badge deferred** in Flutter (needs a native plugin; decision open in Asana). The count lives in `NotificationCenterCubit`, so the badge only needs a listener later.
- **`getRelativeTime` is inlined and German-only** in Angular (tiers
  1m / 60m / 24h / 7d). Flutter routes the relative-time strings through
  slang (de identical to Angular, en added); the date pattern follows the
  locale.

## Port Log

| Date       | Who      | What                                                  |
| ---------- | -------- | ----------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec + contracts + parity written from Angular source |
| 2026-09-25 | Claude (M2-Specs) | Contracts re-verified against `in-app-notifications.controller.ts`: employees + clients, `recipient_type`/`recipient_id` (no `employee_id`), hidden-category filter, 200 `{success:false}` instead of 404, query validation, dismiss-by-content semantics; removed the appointment-participants PATCH (inline RSVP gone); pagination („Mehr laden“) and full type list documented |
| 2026-09-25 | Claude (M2-Specs QA) | Web-only targets: mark read + snackbar (owner decision); offline wording aligned with WP3; badge plugin wording |
| 2026-09-25 | Claude (M2 parity) | Flutter ⏳ → 🚧 after tagea-next-flutter#86 (WP10); deviations recorded (full-screen page, infinite paging, no swipe-to-hide, no inline RSVP, web-only snackbar, deferred app-icon badge) |
