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
- **E2E:** _(none dedicated; covered incidentally by appointment-invitation tests)_

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
  port should use `flutter_app_badger` (or equivalent) and call it from the
  same points in the optimistic-update flow.
- **Inline RSVP button labels.** "Zusagen" / "Absagen" are hard-coded German
  in the Angular template and not routed through Transloco. The Flutter
  port may keep them hard-coded for parity or promote them to proper i18n
  strings — either is acceptable; update this file if divergent.
- **Decline mapping.** Declines always send `response_status: 'no_show_with_notice'`
  from the bell. Short-notice / no-notice variants are only available on
  the appointment detail page. Flutter should follow the same simple
  mapping.
- **`getRelativeTime` is inlined and German-only.** Flutter port should use
  `package:intl` with the same tier thresholds (1m / 60m / 24h / 7d).

## Port Log

| Date       | Who      | What                                                  |
| ---------- | -------- | ----------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec + contracts + parity written from Angular source |
