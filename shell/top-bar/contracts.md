# Contracts: Top Bar

> API endpoints, DTOs, and events consumed by the top bar. Everything else (notification payloads, mode-toggle state, language model) is documented in sibling bundles.

## Endpoints

### `GET /auth/me/tenants`

List all tenants the current user can switch to. Public (any authenticated user).

**Source:** `apps/tagea-backend/src/auth/auth.controller.ts` — `getCurrentUserTenants()`.

**Response:**

```ts
// documentation-only
interface MeTenantsResponse {
  tenants: Array<{
    id: string;
    name: string;
    role: string;
    isCurrent: boolean;
  }>;
  currentTenantId: string;
}
```

> The frontend's local `Tenant` interface in `top-bar.component.ts` picks `id`, `name`, `role` only; `isCurrent` is available but unused (the component derives current-ness from `authService.tenantId()`).

**Error codes:** 401 (unauthenticated).

---

### `GET /auth/me/institutions`

List all institutions the current employee is assigned to. Returns `[]` for clients or non-employees.

**Source:** `apps/tagea-backend/src/auth/auth.controller.ts` — `getMyInstitutions()`. Returns `Institution[]` entities filtered to `is_active && isCounselingModeEnabled`.

**Response:**

```ts
// Upstream entity: apps/tagea-backend/src/institutions/entities/institution.entity.ts
// documentation-only
interface InstitutionListItem {
  id: string;
  name: string;
  is_active: boolean;
  // Many other fields exist on the entity; the top bar only reads id / name / is_active.
}
```

**Error codes:** 401.

---

### `POST /auth/current-tenant`

Set the active tenant for the authenticated user.

**Source:** `apps/tagea-backend/src/auth/auth.controller.ts` — `setCurrentTenant()`. DTO: `SetCurrentTenantDto` (`apps/tagea-backend/src/auth/dto/set-current-tenant.dto.ts`).

**Request body:**

```ts
// See backend DTO for validators.
// documentation-only
interface SetCurrentTenantBody {
  tenantId: string;
}
```

**Response:**

```ts
// The backend returns the full auth context.
// documentation-only
interface SetCurrentTenantResponse {
  user: Employee; // or client projection
  currentTenant: string;
  isSuperAdmin?: boolean;
  isTenantAdmin?: boolean;
  availableTenants: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}
```

**Error codes:** 401, 403 (requested tenant not in `auth_user_tenants`), 404.

**Side-effects on the client:** `UnifiedAuthService.setCurrentTenant()` triggers `window.location.reload()` after updating local signals, persisting `currentUser` to `localStorage`, and calling `loadPermissionsAndFeatures()`.

---

### `POST /auth/current-institution`

Set the current institution context (or clear it with `null`).

**Source:** `apps/tagea-backend/src/auth/auth.controller.ts` — `setCurrentInstitution()`. DTO: `SetCurrentInstitutionDto` (`apps/tagea-backend/src/auth/dto/set-current-institution.dto.ts`).

**Request body:**

```ts
// documentation-only
interface SetCurrentInstitutionBody {
  institutionId: string | null;
}
```

**Response:**

```ts
// documentation-only
interface SetCurrentInstitutionResponse {
  success: boolean;
  institutionId: string | null;
  institutionName: string | null;
}
```

**Error codes:** 401 (not an employee), 403, 404.

**Side-effects on the client:** under RBAC v2 the `AuthorizationStore.switchInstitution()` recomputes permissions without a reload; under RBAC v1 the service triggers `window.location.reload()`.

---

### `GET /tenants/current/logo`

Return a signed URL for the current tenant's logo (or `null` if none configured).

**Source:** `apps/tagea-backend/src/tenants/tenants.controller.ts` — `getCurrentTenantLogoUrl()`.

**Response:**

```ts
// The frontend reads `response.url`.
// documentation-only
interface TenantLogoUrlResponse {
  url: string | null;
}
```

**Caching:** the frontend caches the URL for 30 minutes in `TenantFeaturesService` (`LOGO_URL_CACHE_DURATION = 30 * 60 * 1000`). Cache is cleared on logout and on tenant switch via `TenantFeaturesService.clearLogoCache()`.

**Error codes:** 401.

---

## Events (in-process)

The tenant/institution switchers emit `ContextChangeService.notifyContextChange` events that other services (caches, routers, stores) subscribe to.

```ts
// See apps/tagea-frontend/src/app/services/context-change.service.ts
// documentation-only
interface ContextChangeEvent {
  type: 'tenant' | 'institution';
  previousId: string | null;
  newId: string | null;
  timestamp: number;
  metadata?: {
    previousName?: string;
    newName?: string;
    triggeredBy: 'user-action' | 'url-change' | 'system';
  };
}
```

> **Flutter port note:** Flutter consumers should replicate this as a Dart stream / Riverpod event. Field names (`previousId`, `newId`, `metadata.triggeredBy`) must match so that shared logging stays consistent.

---

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/components/top-bar/top-bar.component.ts
interface Tenant {
  id: string;
  name: string;
  role?: string;
}

interface Institution {
  id: string;
  name: string;
  is_active: boolean;
}
```

The component also holds UI-only signals not transmitted over the wire: `tenantLogoUrl`, `logoLoadingMobile`, `logoError`, `availableTenants`, `availableInstitutions`, `tenantLoading`, `institutionLoading`.

> **Flutter port note:** The Dart side should read `availableTenants` / `availableInstitutions` from a shared AuthContext provider rather than re-hitting the endpoints on every widget rebuild.
