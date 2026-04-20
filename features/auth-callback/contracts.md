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
  - `'EMAIL_NOT_VERIFIED'` — authenticated user's email is not verified
  - _(other string)_ — generic error → `/auth-error`

## Profile Load Endpoint

After token exchange, the profile load is triggered internally by `UnifiedAuthService`. The actual call is `GET /api/users/me` or similar (see the auth-service spec for details).

### Expected error responses

| HTTP status              | Mapped error           | Destination                                 |
| ------------------------ | ---------------------- | ------------------------------------------- |
| 200 + tenant present     | —                      | `/`                                         |
| 200 + no tenant          | `NO_TENANT_ASSIGNMENT` | `/no-tenant`                                |
| 403 `email_not_verified` | `EMAIL_NOT_VERIFIED`   | `/blocked-access?reason=email-not-verified` |
| other 4xx / 5xx          | generic error string   | `/auth-error`                               |
| no response within 120s  | timeout                | `/auth-error`                               |

> **Flutter port note:** The Flutter equivalent should implement the same branching logic as a navigation decision right after `flutter_appauth` returns tokens and the `/me` call resolves. Consider a `AuthBootstrapPage` that mirrors this waiting semantics.
