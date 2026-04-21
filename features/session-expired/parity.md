# Parity: Session Expired

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/session-expired/session-expired.component.ts`](../../../apps/tagea-frontend/src/app/pages/session-expired/session-expired.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/session_expired_page.dart`
- **Integration tests:** `integration_test/session_expired_test.dart`

## Known Divergences

| Topic            | Angular                                                                                          | Flutter                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Redirect trigger | `UnifiedAuthService.handleSessionExpired()` (tokenRefreshError / SESSION_EXPIRED / resume-check) | `Dio` interceptor or auth-state listener calls `GoRouter.go('/session-expired')` |
| Post-login flow  | Web: full redirect; Native: same-page continuation                                               | Always same-page continuation (no web variant)                                   |
| Styling          | Material Design 3 system variables via `--mat-sys-*`                                             | Material 3 via `ThemeData`; match color roles (`surface`, `onSurface`, etc.)     |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
