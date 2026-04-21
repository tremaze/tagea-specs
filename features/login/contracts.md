# Contracts: Login

## OAuth/OIDC Flow

Login uses **Keycloak** as identity provider via the OIDC Authorization Code Flow (PKCE recommended for Flutter).

### Endpoints (Keycloak-side)

| Endpoint                                                        | Purpose                          |
| --------------------------------------------------------------- | -------------------------------- |
| `GET {keycloak}/realms/{realm}/protocol/openid-connect/auth`    | Authorization request (redirect) |
| `POST {keycloak}/realms/{realm}/protocol/openid-connect/token`  | Code → access/refresh tokens     |
| `POST {keycloak}/realms/{realm}/protocol/openid-connect/logout` | End session                      |

### Callback

- **URL:** `/auth/callback?code=…&state=…`
- **Handling:** token exchange, persistence, redirect to target route

## Token Payload (JWT)

> **Documentation-only shape.** The Angular codebase does not declare an `AuthToken` TypeScript interface — the decoded JWT is consumed indirectly via `AuthService` / `UnifiedAuthService` signals. The shape below describes the Keycloak-issued claims the **backend** consumes (see `apps/tagea-backend/src/auth/middleware/oidc-auth.middleware.ts` and `apps/tagea-backend/src/auth/guards/oidc-jwt.guard.ts`). The token does **not** include an `institution_id` or `tenant_id` claim — tenant/institution context is resolved server-side from the DB and from the `X-Tenant-ID` request header.

```ts
// Documentation shape only — no equivalent interface exists in the Angular source.
// Mirror this in Flutter as a real typed class since flutter_appauth does not parse claims.
interface JwtClaims {
  sub: string; // user id (authUserId)
  preferred_username: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  identity_provider?: string; // or `idp`
  realm_access?: {
    // Keycloak-specific container; role claim path is configurable via OIDC_CLAIMS_ROLES
    roles: string[];
  };
  exp: number; // expiry (unix seconds)
  iat: number;
}
```

> **Flutter port note:** The Dart package `flutter_appauth` wraps the OIDC flow including PKCE. Token storage should use **secure storage** (`flutter_secure_storage`), not `SharedPreferences`.

## Backend Bootstrap After Login

After a successful token exchange the frontend (`UnifiedAuthService.loadEmployeeProfile`) calls:

- `GET /api/auth/current` — returns the combined auth context. Response shape (see `AuthController.getCurrent` in `apps/tagea-backend/src/auth/auth.controller.ts`):

  ```ts
  // Shape consumed by UnifiedAuthService.loadEmployeeProfile
  interface AuthCurrentResponse {
    user: Employee; // id, email, firstName, lastName, role, tenantId, status, ...
    currentTenant: string;
    isSuperAdmin?: boolean;
    isTenantAdmin?: boolean;
    hasInstitutionAssignments?: boolean;
    hasCounselingInstitutions?: boolean;
    availableTenants: { id: string; name: string; role: string }[];
  }
  ```

- `GET /api/tenants/current/features` — tenant feature flags for the resolved tenant.
- `GET /api/tenants/current/push-brand` — `{ brandId: string | null }` used by the push-notification service.
- Authorization context via `AuthorizationStore.loadContext()` (RBAC v2) — populates permissions and the list of assigned institutions.

Push-token registration happens in a separate phase (`PushNotificationService`) and targets an **external push gateway** (`{gatewayUrl}/api/webpush/subscriptions` for web, `{gatewayUrl}/api/subscriptions/...` for mobile), **not** the tagea backend. Tenant switching uses `POST /api/auth/current-tenant`; institution switching uses `POST /api/auth/current-institution`.

These calls are **not part of the login spec** but of the bootstrap phase — documented here for Flutter-port completeness.
