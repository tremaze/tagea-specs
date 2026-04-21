# Contracts: Auth Callback

## OIDC Callback

Tail end of the OIDC Authorization Code Flow handled by `@tagea/auth` (browser) or `flutter_appauth` (Flutter).

### Inputs

- URL-encoded `code` and `state` query parameters from the IdP redirect (consumed by the OIDC library, not by our component code directly).

### Outputs (observable app state)

- `AuthService.isInitialized$` emits `true` once the token exchange completes and the session is in place.
- `UnifiedAuthService.employee()` signal becomes non-null once the employee profile is fetched from the backend.
- `UnifiedAuthService.profileLoadError()` signal returns one of:
  - `null` / falsy — no error
  - `'NO_TENANT_ASSIGNMENT'` — authenticated user has no tenant/institution
  - `'EMAIL_NOT_VERIFIED'` — authenticated user's email is not verified (set before the `/auth/current` error is rethrown)
  - `'SESSION_EXPIRED'` — session-expiry marker (handled by `UnifiedAuthService`'s own effect; callback treats this as "other" and would route to `/auth-error`, but in practice the service navigates to `/session-expired` first)
  - _(other string — the raw `Error.message`)_ — generic error → `/auth-error`

## Profile Load Endpoint

After token exchange, the profile load is triggered internally by `UnifiedAuthService.loadEmployeeProfile()` (invoked reactively via an `effect()` once OIDC reports `isAuthenticatedSignal() === true` with a token). The actual call is `GET /auth/current`, resolved via `apiConfig.getApiUrl('auth/current')`.

Backend controller: `AuthController.getCurrentUser()` — `@Get('current')` in `apps/tagea-backend/src/auth/auth.controller.ts`.

### Expected error responses

| HTTP status / condition                                                          | Mapped `profileLoadError()` value      | Destination                                 |
| -------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| 200 + `currentTenant` / `employee.tenantId` set                                  | `null`                                 | `/`                                         |
| 200 but no tenant resolvable                                                     | `NO_TENANT_ASSIGNMENT`                 | `/no-tenant`                                |
| 403 with message `Email not verified` (substring match on `error.error.message`) | `EMAIL_NOT_VERIFIED`                   | `/blocked-access?reason=email-not-verified` |
| other 4xx / 5xx                                                                  | generic error string (`error.message`) | `/auth-error`                               |
| no profile within 120 s                                                          | — (timeout in callback component)      | `/auth-error`                               |

> Note: `UnifiedAuthService` itself owns an `effect()` that also navigates to `/no-tenant`, `/session-expired`, or `/auth-error` when `profileLoadError()` transitions. The callback component's navigation is therefore often a no-op race winner — both paths land the user on the same destination. The only error value mapped by the callback that the service-side effect does NOT handle directly is `EMAIL_NOT_VERIFIED` (routed to `/blocked-access` by the callback).

> **Flutter port note:** The Flutter equivalent should implement the same branching logic as a navigation decision right after `flutter_appauth` returns tokens and the `/me` call resolves. Consider a `AuthBootstrapPage` that mirrors this waiting semantics.
