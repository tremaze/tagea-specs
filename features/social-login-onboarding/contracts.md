# Contracts: Social Login & Post-Login Onboarding

> API endpoints, DTOs, Keycloak realm configuration, and notification events for the social-login + onboarding flow. Frontend ⇄ backend contracts only; UI behavior is in [spec.md](./spec.md).

## Backwards Compatibility

All changes in this contract are **additive**:

- New endpoints under `/onboarding/*` and `/tenants/public*` — no impact on existing clients.
- New optional fields on `/auth/current` response (`onboardingState`) — older clients ignore them.
- No existing endpoint signatures, field names, or status codes change.

Older mobile clients (Flutter, Capacitor web bundle in customers' browser caches) continue to receive their existing responses unchanged. The onboarding routes are guarded so that a client that does not understand them never reaches them.

## Keycloak Realm Configuration

### Identity providers (new)

Add two OIDC identity providers to the existing Tagea Keycloak realm(s):

| Alias        | Provider type | Discovery URL                                                   | Default scopes              | Notes |
| ------------ | ------------- | --------------------------------------------------------------- | --------------------------- | ----- |
| `apple`      | `apple`       | `https://appleid.apple.com/.well-known/openid-configuration`    | `openid name email`         | Requires a Services ID + key in the Apple Developer portal. Apple sends `given_name` / `family_name` **only on the first sign-in** — mappers must persist to user attributes immediately. |
| `google`     | `google`      | `https://accounts.google.com/.well-known/openid-configuration`  | `openid profile email`      | Standard OIDC. |
| `microsoft`  | (existing)    | —                                                               | (existing)                  | No change. |

**First-broker-login flow** (apply to all three IdPs):

- Use Keycloak's built-in `first broker login` flow with the `Detect Existing Broker User` and `Automatically Set Existing User` steps configured to require a **verified email** on the upstream IdP for auto-link. Unverified emails fall through to the standard `Confirm Link Existing Account` step.
- Set `Trust Email = ON` for Apple and Google. (Apple verifies emails before issuing tokens; Google's `email_verified` claim is honored.)

**Mappers** (per IdP):

- `email` → Keycloak user `email`
- `given_name` → Keycloak user `firstName`
- `family_name` → Keycloak user `lastName`
- Apple-specific: ensure the `name` claim's `given_name`/`family_name` is persisted on first login (Apple omits these on subsequent sign-ins).

### Login theme

The Keycloak login theme must render the three social-provider buttons in the order **Apple, Google, Microsoft**. Apple's button must follow Apple HIG ("Sign in with Apple" wordmark, black-on-white or white-on-black variants). The theme is shared across realms and lives outside this repo — coordinate the theme update alongside the realm config rollout.

## Endpoints

### `GET /onboarding/state`

Returns the authenticated user's current onboarding step. Used by `onboardingGuard` and on resume.

**Auth:** `@Auth({ scope: 'authenticated' })`
**Request:** no body, no params.

**Response 200:**

```ts
// documentation-only
interface OnboardingStateResponse {
  step: 'tenant-select' | 'institution-select' | 'awaiting-approval' | 'done' | 'blocked';
  tenantId: string | null;
  institutionId: string | null;
  accountType: 'employee' | 'client' | null;
  pendingRequest: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
  } | null;
}
```

**Notes:**

- `done` means the user has at least one membership — frontend should never reach the onboarding routes in that case.
- `blocked` is set when the resolved tenant disallows public joins.

**Error codes:** 401.

### `POST /onboarding/join-requests`

Creates a join request for the authenticated user.

**Auth:** `@Auth({ scope: 'authenticated' })`

**Request body:**

```ts
// documentation-only
interface CreateJoinRequestBody {
  tenantId: string;
  institutionId: string;
  accountType: 'employee' | 'client';
  message?: string;
}
```

**Response 201:**

```ts
// documentation-only
interface JoinRequestResponse {
  id: string;
  tenantId: string;
  institutionId: string;
  accountType: 'employee' | 'client';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAccountType: 'employee' | 'client';
  immediateAccess: boolean;
}
```

- `immediateAccess: true` means a client on an `instant` self-registration tenant — backend has already created the membership; frontend can route straight to `/dashboard`.
- `immediateAccess: false` means the user must wait for admin approval (employee always; client on `approval` tenants).

**Error codes:**

- `400` — malformed body / unknown tenant or institution.
- `403` — tenant does not allow public joins (`publicJoin === 'disabled'`).
- `409` — user already has an open pending request, or already has a membership in the target institution.

### `DELETE /onboarding/join-requests/me`

Cancels the authenticated user's own open pending request.

**Auth:** `@Auth({ scope: 'authenticated' })`
**Response:** 204.
**Error codes:** 404 (no open request).

### `GET /tenants/public`

Public discovery list — used by `/onboarding/tenant-select` in cloud environments.

**Auth:** public.

**Query params:** `q` (search), `cursor` (pagination), `limit` (default 20, max 50).

**Response 200:**

```ts
// documentation-only
interface PublicTenantsResponse {
  items: Array<{
    id: string;
    slug: string;
    name: string;
    city: string | null;
    logoUrl: string | null;
  }>;
  nextCursor: string | null;
}
```

Only tenants opted into public discovery (`publicDiscovery === true`) appear. No 401/403 — public endpoint.

### `GET /tenants/:tenantId/institutions/public`

Institution list for the picker. Returns institutions the tenant has exposed for public onboarding.

**Auth:** public.

**Response 200:**

```ts
// documentation-only
interface PublicInstitutionsResponse {
  tenant: {
    id: string;
    name: string;
    publicJoin: 'enabled' | 'disabled';
    clientSelfRegistration: 'instant' | 'approval' | 'disabled';
  };
  items: Array<{
    id: string;
    name: string;
    city: string | null;
    accountTypes: Array<'employee' | 'client'>;
  }>;
}
```

**Error codes:**

- `404` — tenant unknown or `publicJoin === 'disabled'`.

### `GET /auth/current` (existing — additive change)

Existing endpoint gains an optional field on the response. Older clients ignore unknown fields.

```ts
// documentation-only
interface AuthCurrentResponse {
  // ... existing fields ...
  onboardingState?: {
    step: OnboardingStateResponse['step'];
    pendingRequestId: string | null;
  };
}
```

When the field is absent, frontend falls back to `GET /onboarding/state` (older backend deployments).

## Data Models

```ts
// Source: apps/tagea-backend/src/onboarding/entities/join-request.entity.ts (to be created)
// documentation-only
interface JoinRequestEntity {
  id: string;
  userId: string;
  tenantId: string;
  institutionId: string;
  accountType: 'employee' | 'client';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  immediateAccess: boolean;
  message: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  rejectionReason: string | null;
}
```

```ts
// Source: apps/tagea-frontend/src/app/services/onboarding-state.service.ts (to be created)
// documentation-only
interface OnboardingStateSignals {
  step: Signal<OnboardingStateResponse['step']>;
  tenantId: Signal<string | null>;
  institutionId: Signal<string | null>;
  accountType: Signal<'employee' | 'client' | null>;
  currentRequest: Signal<JoinRequestResponse | null>;
}
```

> **Flutter port note:** The corresponding Dart classes must respect the same JSON field names and nullability. Use freezed for the response DTOs.

## Tenant configuration (additive columns)

The tenant entity gains the following columns (additive, all default to safe values for existing tenants):

```ts
// Source: apps/tagea-backend/src/tenants/entities/tenant.entity.ts (additive)
// documentation-only
interface TenantEntityAdditive {
  publicDiscovery: boolean;             // default false — existing tenants stay hidden from cloud picker
  publicJoin: 'enabled' | 'disabled';   // default 'disabled' — explicit opt-in to social-login onboarding
  clientSelfRegistration: 'instant' | 'approval' | 'disabled';
                                        // default 'disabled' — preserves existing behavior
}
```

A migration adds these columns with the defaults above. No existing tenant changes behavior until an admin opts in.

## Events (notifications)

- `EMPLOYEE_REGISTRATION_PENDING` — existing event, fired on `accountType: 'employee'` join request creation. Already wired up; this spec only changes the trigger surface.
- `CLIENT_REGISTRATION_PENDING` — new event, fired on `accountType: 'client'` join request creation when `immediateAccess === false`. Targets institution admins. Uses the existing notification transport.
- `EMPLOYEE_APPROVED` / `EMPLOYEE_REJECTED` — existing user-facing events, no change.
- `CLIENT_APPROVED` / `CLIENT_REJECTED` — new user-facing events, mirror the employee variants.

All new notifications follow the existing `NotificationType` enum extension pattern (additive). Old clients that don't recognize the new type fall back to a generic in-app entry.
