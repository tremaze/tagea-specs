# Parity: Context Resolution

## Angular

- **Status:** ✅ Implemented (RBAC v2 live; RBAC v1 fallback retained for unloaded-context paths)
- **Paths:**
  - [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
  - [`apps/tagea-frontend/src/app/services/authorization-store.service.ts`](../../../apps/tagea-frontend/src/app/services/authorization-store.service.ts)
  - [`apps/tagea-frontend/src/app/services/institution-context.service.ts`](../../../apps/tagea-frontend/src/app/services/institution-context.service.ts)
  - [`apps/tagea-frontend/src/app/services/tenant-features.service.ts`](../../../apps/tagea-frontend/src/app/services/tenant-features.service.ts)
  - [`apps/tagea-frontend/src/app/services/current-employee.service.ts`](../../../apps/tagea-frontend/src/app/services/current-employee.service.ts)
  - [`apps/tagea-frontend/src/app/services/context-change.service.ts`](../../../apps/tagea-frontend/src/app/services/context-change.service.ts)
- **E2E:** no bundle test the services in isolation; every authenticated test indirectly exercises `/auth/current`, `/auth/context`, `/tenants/current/features`.

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/core/auth/auth_state.dart` — state container equivalent to `UnifiedAuthService`
  - `lib/core/auth/authorization_store.dart` — RBAC v2 store
  - `lib/core/tenant/tenant_features.dart` — feature flags + logo cache
  - `lib/core/tenant/institution_context.dart` — simple state holder
- **Approach:**
  - Back each service with a Riverpod `StateNotifierProvider` (or Bloc/Cubit if the rest of the app uses Bloc). The Angular `Signal<T>` maps cleanly to a `StateNotifier<T>`; `computed()` maps to `Provider<T>` with `ref.watch`.
  - Fire the bootstrap call from an `appRouter`-level provider during splash, mirroring `UnifiedAuthService.loadEmployeeProfile()`.
  - Rehydrate `institutionId` from the URL on deep-link startup before any guard evaluates.
- **Integration tests:** `integration_test/context_resolution_test.dart` (bootstrap happy path, tenant switch, institution switch, error branches for `NO_TENANT_ASSIGNMENT` and `EMAIL_NOT_VERIFIED`).

## Known Divergences

| Topic                     | Angular                                                                                         | Flutter                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Tenant switch             | `window.location.reload()` at the end                                                           | No page concept — rebind state tree or pop to root and restart providers                  |
| Institution switch        | URL-driven via `institutionUrlGuard`                                                            | Deep-link parser sets `institutionId` during route resolution; no guard                   |
| Offline behavior          | No offline support — bootstrap fails hard                                                       | Persist last-known `AuthContextResponse` + `TenantFeatures` on disk and degrade read-only |
| Cached page-data clearing | `DashboardDataService` / `ClientsDataService` / `CalendarDataService.clear()`                   | Flutter should clear the equivalent providers via `ref.invalidate()` on context change    |
| Sentry user tagging       | `Sentry.setUser({ id })` + tenant/institution tags                                              | Replicate via `sentry_flutter` with identical tag keys so dashboards match                |
| Bridge effect             | `effect()` pushes `AuthorizationStore.effectivePermissions` → `UnifiedAuthService._permissions` | Derive `permissions` directly in the provider graph — no mirror state needed              |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-21 | ltoenjes | Spec created |
