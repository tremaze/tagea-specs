# Cross-Cutting: Context Resolution

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Every screen needs to know: **who** is logged in, **which tenant** they are acting in, **which institution** (if any) scopes the current route, **what** they are allowed to do, and **which features** the tenant has bought. This bundle documents the shared reactive state — a small set of Angular signals and services — that resolves all of that at login and on every context switch. It is consumed by every feature, guard, and interceptor in the app.

## User Stories

- As an **employee with assignments across multiple tenants** I want to switch tenants from the top-bar and have the whole app — permissions, features, routes — rebind to the new tenant, so that I do not see stale data or accidentally act in the wrong tenant.
- As an **employee with access to multiple institutions in a tenant** I want the active institution to follow the URL (`/einrichtung/:id/...`), so that I can deep-link, bookmark, or share a URL without breaking context.
- As a **feature author** I want a single `hasPermission('…')` call that returns the correct answer for the currently active institution, so that I do not re-implement RBAC in every component.
- As a **feature author** I want a single `isXxxEnabled()` signal per tenant feature, so that I can hide/disable UI without re-querying the backend.

## Acceptance Criteria

- [ ] **Given** an authenticated user, **When** the app bootstraps, **Then** `UnifiedAuthService.employee()`, `tenantId()`, and `AuthorizationStore.context()` are all populated before any route guard resolves.
- [ ] **Given** the bootstrap endpoint `/auth/current` returns `currentTenant`, **When** the response is processed, **Then** `employee().tenantId` equals `currentTenant` (the server's resolved tenant overrides what the employee record says).
- [ ] **Given** `/auth/current` returns no tenant for the user, **When** the response is processed, **Then** `profileLoadError()` is set to `'NO_TENANT_ASSIGNMENT'` and the user is routed to `/no-tenant`.
- [ ] **Given** the user switches tenants via `setCurrentTenant(id)`, **When** the POST succeeds, **Then** local signals are updated, `institutionId` is reset to `null`, and `window.location.reload()` fires to rebind all feature modules.
- [ ] **Given** the user navigates to `/einrichtung/:id/...`, **When** the `institutionUrlGuard` calls `setInstitutionFromUrl(id)`, **Then** `InstitutionContextService.institutionId()` updates and `AuthorizationStore.effectivePermissions()` recomputes for the new institution without a page reload (RBAC v2).
- [ ] **Given** an active institution, **When** `hasPermission('x.y')` is called, **Then** the result reflects the institution-specific permission set (not the tenant role set).
- [ ] **Given** no active institution, **When** `hasPermission('x.y')` is called, **Then** the result reflects the merge of the tenant role permissions and all teamspace role permissions.
- [ ] **Given** the user logs out, **When** `logout()` runs, **Then** all state signals reset to empty/null and tenant-scoped caches (features, logo URL, page data) are cleared.

## UI States

Context resolution itself is non-visual, but its outputs gate visible states elsewhere:

| State              | When?                                                   | What does the user see?                                                       | A11y notes |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------- |
| Bootstrap pending  | `isLoading()` is `true` (profile fetch in flight)       | Spinner on initial route (handled by `app-shell` / `auth-callback`)           | —          |
| No tenant          | `profileLoadError() === 'NO_TENANT_ASSIGNMENT'`         | Route replaced with `/no-tenant`                                              | —          |
| Session expired    | Token-refresh failure                                   | Route replaced with `/session-expired`                                        | —          |
| Context switching  | During tenant switch (`setCurrentTenant`)               | Full page reload                                                              | —          |
| Institution active | `institutionId()` is non-null and URL includes the UUID | Institution-scoped menu + permissions apply; feature flags already per-tenant | —          |

## Flows

### 1. Bootstrap after successful OIDC login

```
OIDC authenticated
   │
   ▼
UnifiedAuthService effect() sees (_oidcAuthenticated && _tokenInfo && !_employee && !_isLoading)
   │
   ▼
loadEmployeeProfile()
   │
   ├── GET /auth/current  ──▶ { user, currentTenant, isSuperAdmin?, isTenantAdmin?,
   │                            hasInstitutionAssignments?, hasCounselingInstitutions?,
   │                            availableTenants[] }
   │
   ├── employee.tenantId = currentTenant ?? employee.tenantId
   │   (if still missing → profileLoadError = 'NO_TENANT_ASSIGNMENT')
   │
   ├── AuthorizationStore.loadContext()         ──▶ GET /auth/context (RBAC v2)
   │   └── sets _context signal; bridge effect() syncs effectivePermissions → _permissions
   │
   ├── TenantFeaturesService.setFeatures(…)     ──▶ GET /tenants/current/features
   │   (response body set directly; on failure, sets minimal disabled defaults)
   │
   ├── _pushBrandId.set(…)                      ──▶ GET /tenants/current/push-brand
   │
   ├── ThemeService.loadAndApplyTenantTheme()   (non-blocking)
   ├── LanguageService.loadUserPreference()     (non-blocking)
   └── SchulungAdminsService.checkCurrentUser() (if schulungen feature enabled)
```

After this chain settles, `isAuthResolved()` becomes `true` and guards can safely evaluate permissions and feature flags.

### 2. Tenant switch (top-bar tenant-switcher)

```
user clicks tenant in switcher
   │
   ▼
UnifiedAuthService.setCurrentTenant(tenantId)
   │
   ├── POST /auth/current-tenant { tenantId }
   │   └── response: { user, currentTenant, isSuperAdmin?, isTenantAdmin?, availableTenants[] }
   │
   ├── local signals updated (employee, isSuperAdmin, isTenantAdmin)
   ├── institutionContext.setInstitutionId(null)       (reset institution)
   ├── _permissions.set([])                            (cleared; will repopulate via bridge)
   │
   ├── loadPermissionsAndFeatures()
   │   ├── AuthorizationStore.loadContext()            (GET /auth/context)
   │   └── TenantFeaturesService.setFeatures(…)        (GET /tenants/current/features)
   │
   ├── clearCachedPageData()    (Dashboard/Clients/Calendar data services)
   └── window.location.reload() (rebinds every feature module cleanly)
```

### 3. Institution switch (URL-driven)

```
user clicks "Einrichtung X" in top-bar or navigates
   │
   ▼
router.navigate(['/einrichtung', newId, ...])
   │
   ▼
institutionUrlGuard fires on the new route
   │
   ▼
UnifiedAuthService.setInstitutionFromUrl(newId)
   │
   ├── institutionContext.setInstitutionId(newId)          (signal update)
   ├── AuthorizationStore.switchInstitution(newId)         (if loaded)
   │   └── AuthorizationStore.effectivePermissions()  recomputes
   │       ContextChangeService.notifyContextChange({ type: 'institution', … })
   └── clearCachedPageData()
```

No reload in the RBAC v2 path. The next HTTP request picks up the new `X-Institution-ID` header via `tenantContextInterceptor` (see `cross-cutting/http-interceptors`).

### 4. Explicit institution API (non-URL callers)

`UnifiedAuthService.setCurrentInstitution(id | null)` exists for callers that need to tell the backend about the switch (`POST /auth/current-institution`) in addition to the URL change. The RBAC v2 path skips the reload; RBAC v1 (absent `AuthorizationStore.isLoaded()`) triggers `window.location.reload()`.

## Non-Goals

- **HTTP header injection** (`X-Tenant-ID`, `X-Institution-ID`, `Authorization`) — lives in `cross-cutting/http-interceptors`.
- **Route gating** (guards that redirect on missing permission/feature) — lives in `cross-cutting/routing-and-guards`.
- **Top-bar UI** (tenant switcher, institution switcher) — lives in `shell/top-bar`.
- **Push notification registration** — lives in `cross-cutting/bootstrap-and-push`.
- **Theme / i18n loading** — lives in `cross-cutting/i18n-and-theming`.

## Edge Cases

- **Employee has no tenant** → `profileLoadError = 'NO_TENANT_ASSIGNMENT'`; OIDC stays authenticated to avoid redirect loops; router navigates to `/no-tenant`.
- **Email not verified** → `/auth/current` returns 403 with `Email not verified`; `profileLoadError = 'EMAIL_NOT_VERIFIED'` (handled by `auth-callback` and downstream routing).
- **`/auth/current` returns 304 after tenant switch** → avoided by using `POST /auth/current-tenant` for switching (does not hit the cached GET); `loadPermissionsAndFeatures()` repopulates downstream state.
- **Tenant switch on native (Capacitor)** → `window.location.reload()` behaves like a full app restart; OIDC tokens are preserved in storage.
- **Institution switch while `AuthorizationStore` not yet loaded** → fallback path runs `window.location.reload()` (RBAC v1 compatibility; extremely rare since bootstrap awaits context load).
- **Refresh mid-session on a `/einrichtung/:id/...` URL** → `institutionUrlGuard` re-sets the institution signal from the URL before any data load happens.
- **Active institution switched via `setCurrentTenant`** → `institutionId` is explicitly reset to `null` so the first guard evaluation on the new tenant does not use a stale institution from the previous tenant.
- **Bridge effect race** — `_permissions` signal is populated by an `effect()` that watches `AuthorizationStore.effectivePermissions()`. During the brief window between `_permissions.set([])` (clear) and the bridge firing, `hasPermission()` returns `false` for every permission. Consumers must gate on `isAuthResolved()` (or `AuthorizationStore.isLoaded()`) before reading permissions.
- **No active institution, no teamspaces** → `effectivePermissions()` falls back to the tenant role's permissions only. Clients receive `clientPermissions` instead of the tenant role.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated user (employee or client). The bootstrap endpoint is `@Public()` on the backend — the guard runs only after the token is validated.
- **Institution context:** resolved from the URL for employees; always `null` for clients (they have no institution assignments).
- **Backend access checks:**
  - `/auth/current` — authenticates via JWT; auto-provisions a default tenant if the system has none (first-user flow).
  - `/auth/current-tenant` — 401 if the requested tenant is not in the user's `AuthUserTenant` mappings; 404 if the user has no principal in that tenant.
  - `/auth/current-institution` — 400 if the target institution is not assigned to the employee, not active, or has counseling mode disabled.

## Notifications (Push / In-App)

- Not emitted directly by this bundle. Tenant switching and institution switching trigger `ContextChangeService.notifyContextChange(event)`, which page components listen to via `effect()` in order to refresh their own data.

## i18n Keys

No user-facing strings live in this bundle. Error-pages consumed by the routing reactions (`/no-tenant`, `/session-expired`, `/auth-error`, `/blocked-access`) each own their own copy.

## Offline Behavior

**Flutter-specific:**

- Bootstrap cannot complete offline — `/auth/current` is required before any guard resolves. Flutter port should show an "offline" state on the bootstrap screen rather than advancing.
- Feature flags can be cached locally with a short TTL once loaded; the app falls back to the last-known set if the refresh call fails after a tenant switch (Angular uses hard-coded disabled defaults today).
- Active institution (from the URL / deep link) can be read locally without a round-trip; permission evaluation against the cached `AuthorizationStore.context()` works offline.

## References

- **Angular implementation:**
  - [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
  - [`apps/tagea-frontend/src/app/services/authorization-store.service.ts`](../../../apps/tagea-frontend/src/app/services/authorization-store.service.ts)
  - [`apps/tagea-frontend/src/app/services/institution-context.service.ts`](../../../apps/tagea-frontend/src/app/services/institution-context.service.ts)
  - [`apps/tagea-frontend/src/app/services/tenant-features.service.ts`](../../../apps/tagea-frontend/src/app/services/tenant-features.service.ts)
  - [`apps/tagea-frontend/src/app/services/current-employee.service.ts`](../../../apps/tagea-frontend/src/app/services/current-employee.service.ts)
  - [`apps/tagea-frontend/src/app/services/context-change.service.ts`](../../../apps/tagea-frontend/src/app/services/context-change.service.ts)
- **Backend implementation:** [`apps/tagea-backend/src/auth/auth.controller.ts`](../../../apps/tagea-backend/src/auth/auth.controller.ts)
- **Related specs:** `cross-cutting/http-interceptors`, `cross-cutting/routing-and-guards`, `cross-cutting/bootstrap-and-push`, `shell/top-bar`.
- **Backend endpoints:** see [contracts.md](./contracts.md)
