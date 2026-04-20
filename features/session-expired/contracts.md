# Contracts: Session Expired

## Triggers for Navigating to this Page

The page itself calls no backend endpoints. It is a destination, typically reached via:

- HTTP interceptor on 401 responses → `router.navigateByUrl('/session-expired')`
- Token TTL expiry detected by a scheduler → same redirect

> The interceptor/scheduler that decides to route here is owned by the auth plumbing (see the auth-bootstrap spec).

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
