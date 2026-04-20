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

> Relevant to the frontend after decoding:

```ts
interface AuthToken {
  sub: string; // user id
  preferred_username: string;
  email: string;
  institution_id: string; // tenant context
  realm_access: {
    roles: string[];
  };
  exp: number; // expiry (unix)
  iat: number;
}
```

> **Flutter port note:** The Dart package `flutter_appauth` wraps the OIDC flow including PKCE. Token storage should use **secure storage** (`flutter_secure_storage`), not `SharedPreferences`.

## Backend Bootstrap After Login

After a successful token exchange the frontend calls:

- `GET /api/users/me` — loads user profile + institution membership.
- `POST /api/push-tokens` — registers the push token (see the separate notification spec).

These calls are **not part of the login spec** but of the bootstrap phase.
