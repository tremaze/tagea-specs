# Contracts: Session Expired

## Triggers for Navigating to this Page

The page itself calls no backend endpoints. It is a destination, reached exclusively via `UnifiedAuthService.handleSessionExpired(reason)` which runs when any of these conditions fire:

- `AuthService.tokenRefreshError$` emits (refresh token rejected) — unless `isLoggingOut` is true
- A native-auth handler surfaces `error === 'SESSION_EXPIRED'`
- `checkSessionOnWebResume()` detects an invalid refresh token after the tab becomes visible again

`handleSessionExpired` is idempotent (guarded by `isHandlingSessionExpiry`) and performs:

1. `draggableOverlayService.closeAll()`
2. `authService.clearSession()` — clears tokens and timers to prevent `redirectIfAuthenticatedGuard` from re-triggering `ensureAuthenticated()`
3. `sessionStorage.setItem('session_expired_reason', reason)`
4. `router.navigate(['/session-expired'], { replaceUrl: true })`

> The auth plumbing owning these triggers lives in `UnifiedAuthService` (see also the auth-bootstrap spec). This page is a passive destination — it does not listen for trigger events itself.

## Actions from this Page

### "Log in again"

- Calls `AuthService.login()` (from `@tagea/auth`).
- Behavior differs by platform:
  - **Web:** full-page redirect to Keycloak; the component never observes completion — the return flows through `/auth/callback`.
  - **Native:** opens a `WebAuthSession`; `login()` resolves after the user finishes or cancels. `isAuthenticated` is then read synchronously.

### "Home"

- Pure `RouterLink` to `/welcome`. No backend call.

## Post-Login Navigation (native platforms)

After `login()` resolves and `AuthService.isAuthenticated` is true, navigate to `institutionRoute(UnifiedAuthService.institutionId(), 'dashboard')` with `replaceUrl: true`.

The `institutionRoute` helper:

```ts
// Source: apps/tagea-frontend/src/app/utils/institution-route.util.ts
institutionRoute(institutionId: string | null, ...segments: string[]): any[]
```

Returns a router commands array such as `['/einrichtung', institutionId, 'dashboard']`.

> **Flutter port note:** Flutter's `flutter_appauth` always resolves after the native browser closes, so the "native" branch applies universally. Mirror the post-login navigation using `GoRouter.goNamed('dashboard', pathParameters: {'institutionId': ...})` or equivalent.
