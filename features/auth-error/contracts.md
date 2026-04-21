# Contracts: Auth Error

## No direct endpoints

This page makes no authenticated backend calls. It is a destination reached via redirect from:

- `/auth/callback` → generic profile-load error or 120s timeout (see [auth-callback/contracts.md](../auth-callback/contracts.md))
- `UnifiedAuthService` profile-load-error effect — any `_profileLoadError` value other than `NO_TENANT_ASSIGNMENT` or `SESSION_EXPIRED` routes here
- `clientPortalGuard` — redirects here when profile load failed for a client-portal route

## Actions from this page

### "Retry"

- Calls `UnifiedAuthService.logout()`.
- Behavior (platform-specific, owned by `UnifiedAuthService`):
  - Clears stored tokens (`localStorage` or platform secure storage).
  - Redirects to the public entry point.
  - From there the user re-enters the standard login flow (`rootRedirectGuard` → `/welcome` → IdP redirect).

> **Flutter port note:** mirror with the equivalent `AuthRepository.logout()` which clears `flutter_secure_storage` and navigates back to the app's public entry.
