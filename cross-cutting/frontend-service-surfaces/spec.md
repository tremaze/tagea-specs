# Feature: Frontend Service Surfaces

> **Status:** ✅ Specified
> **Owner:** baumgart
> **Last updated:** 2026-04-30

## Vision (Elevator Pitch)

Every frontend data service is bound to exactly one **backend surface** — `self`, `institution`, `tenant`, `tenant-admin`, `super-admin`, `teamspace`, or `public`. Service file names, class names, and the URLs they call mirror the backend controller that owns those endpoints, one-to-one. Mixed-surface services are forbidden: when one logical resource needs to be reachable from two surfaces, two services exist. Local cross-surface state (e.g. cached user permissions, current-employee snapshot) lives in dedicated state-owner services without a surface suffix. The result is a service graph that a reader can navigate by URL prefix alone, with no surprises about which auth scope a given call ends up under.

## Surface Taxonomy

A surface is the tuple `(auth scope, route prefix)` enforced by the backend `@Auth(...)` decorator. The frontend treats this tuple as the contract: every HTTP service binds to one of them. The seven surfaces are:

| Surface          | Backend `@Auth` scope | Backend route prefix                          | Frontend filename pattern               | Reference exemplar                                       |
| ---------------- | --------------------- | --------------------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| **self**         | `authenticated`       | `/<resource>/me/...`                          | `<resource>-self.service.ts`            | `apps/tagea-frontend/src/app/services/employee-self.service.ts` |
| **institution**  | `institution`         | `/institutions/:institutionId/<resource>/...` | `institution-<resource>.service.ts`     | `apps/tagea-frontend/src/app/services/institution-employees.service.ts` |
| **tenant**       | `tenant`              | `/tenant/<resource>/...`                      | `tenant-<resource>.service.ts`          | `apps/tagea-frontend/src/app/services/tenant-employees.service.ts` |
| **tenant-admin** | `tenant-admin`        | `/administration/<resource>/...`              | `tenant-admin-<resource>.service.ts`    | (refactor pending — see Backlog)                         |
| **super-admin**  | `super-admin`         | `/super-admin/<resource>/...`                 | `super-admin-<resource>.service.ts`     | `apps/tagea-frontend/src/app/admin/super-admin-lms/...`  |
| **teamspace**    | `teamspace`           | route-embedded teamspace ID                   | `teamspace-<resource>.service.ts`       | (rare as standalone service; usually folded into institution-context UIs) |
| **public**       | `public`              | `/public/<resource>/...`                      | `public-<resource>.service.ts`          | `apps/tagea-frontend/src/app/services/public-registration.service.ts` |

The backend `@Auth({ scope, ... })` decorator is the source of truth; the available scopes are defined in `apps/tagea-backend/src/auth/authorization/auth.decorator.ts`. Backend exploration (commit `885e950d` and prior) confirmed there are no exceptions to the scope-route correlation: every controller with `scope: 'institution'` lives under `institutions/:institutionId/...`, every controller with `scope: 'tenant'` under `tenant/...`, and so on.

## Backend Mirror

For any backend resource that has multiple controllers, the frontend has matching services with identical surface decomposition. Concrete example — employees:

| Backend controller                                           | Backend route                              | Frontend service                           | Frontend filename                          |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------ | ------------------------------------------ |
| `EmployeeSelfServiceController`                              | `employees/me`                             | `EmployeeSelfService`                      | `services/employee-self.service.ts`        |
| `InstitutionEmployeesController`                             | `institutions/:institutionId/employees`    | `InstitutionEmployeesService`              | `services/institution-employees.service.ts` |
| `TenantEmployeesController`                                  | `tenant/employees`                         | `TenantEmployeesService`                   | `services/tenant-employees.service.ts`     |

Renaming or moving a backend controller obliges the matching frontend service to follow. A change in route prefix is a breaking change for the spec; the spec must be updated in the same PR (per `specs/CLAUDE.md`).

## Naming Convention

### Filename

- **`<surface>-<resource>.service.ts`** for `institution`, `tenant`, `tenant-admin`, `super-admin`, `teamspace`, `public` — surface comes first, hyphenated, then the resource.
- **`<resource>-self.service.ts`** for the `self` surface — resource first, `-self` suffix. The asymmetry mirrors the backend (`EmployeeSelfServiceController` is named resource-first because `me` is a path segment owned by the resource, not a top-level prefix).
- The resource is singular when the service represents one logical entity from the caller's perspective (`employee-self.service.ts` — there is one current employee), plural when the service exposes a collection (`institution-employees.service.ts`).

### Class name

`<Resource><Surface>Service` for institution/tenant/etc. (`InstitutionEmployeesService`), `<Resource>SelfService` for self (`EmployeeSelfService`). Surface segment is capitalized, no hyphens.

### Injection

`@Injectable({ providedIn: 'root' })`. Tree-shakable singletons; no module-level providers.

### Import path

All surface services live under `apps/tagea-frontend/src/app/services/`. Feature-specific helpers (e.g. `app/pages/pep-page/pep.service.ts`) are not surface services and are out of scope; they call surface services internally rather than the HTTP client directly.

### Method-name redundancy

When a method's surface is already encoded in the service class name, the method name does NOT repeat it. The split cuts illustrate this — every method that previously embedded a surface qualifier shed it on the way into the new service:

| Legacy method on monolithic service       | New method on surface service                          |
| ----------------------------------------- | ------------------------------------------------------ |
| `getInstitutionPermissions()`             | `InstitutionPermissionsService.getPermissions()`       |
| `getInstitutionRolePermissions()`         | `InstitutionPermissionsService.getRolePermissions()`   |
| `updateInstitutionRolePermissions(...)`   | `InstitutionPermissionsService.updateRolePermissions(...)` |
| `resetInstitutionToDefaults()`            | `InstitutionPermissionsService.resetToDefaults()`      |
| `getInstitutionRoles()`                   | `InstitutionRolesService.getRoles()`                   |
| `setInstitutionPermissions(...)`          | `InstitutionRolesService.setPermissions(...)`          |
| `getClientAdmin(id)`                      | `TenantAdminClientsService.getClient(id)`              |
| `createClientAdmin(dto, ids)`             | `TenantAdminClientsService.createClient(dto, ids)`     |
| `updateClientAdmin(id, dto)`              | `TenantAdminClientsService.updateClient(id, dto)`      |

Rule: read each call as `<service>.<verb><Noun>`. If the noun already contains the surface (e.g. "Institution" inside `getInstitutionRoles`, "Admin" inside `getClientAdmin`), strip it. Tenant-surface methods that include `institutionId` as a *filter parameter* (e.g. `TenantPermissionsService.getAllPermissions(institutionId?)`) are not affected — the surface is still tenant; the parameter is a query filter.

### Flutter port note

The naming convention above is Angular-specific. The Flutter port mirrors the same surface decomposition with idiomatic naming — file names like `<surface>_<resource>_repository.dart` (snake_case), classes like `<Surface><Resource>Repository`. The mapping (one surface → one repository) is the verbatim part; the casing is not.

## Decision Rule: When to Split

A service must be split when **any** of these is true:

1. It calls endpoints under two or more URL prefixes that map to different `@Auth` scopes.
2. Its constructor/initialization branches on `institutionId == null` to decide between `tenant/...` and `institutions/:id/...` routes.
3. Two callers of the same service pass mutually exclusive context (one needs institution, the other doesn't) and the service has to translate that internally.

If exactly one is true the split is mandatory; the diagnostic is "I'm injecting one service but I get back results from a different auth scope than I expected."

A service must **not** be split when:

- It performs no HTTP calls (utility services, formatters, platform adapters — `theme.service.ts`, `html-sanitizer.service.ts`, etc.).
- It calls only public/unauthenticated endpoints (already a single surface — `public`).
- It calls endpoints under one prefix; surface determination is unambiguous.

## Shared Local State Pattern

Some logical state is consumed across surfaces but doesn't itself belong to one. The current example is the user's effective permission set: it is fetched from a tenant endpoint, but `hasPermission(...)` is called from institution-scoped components, tenant-scoped components, and shell-level guards.

For state of this shape:

- The state lives in a dedicated service **without a surface suffix** (e.g. `UserPermissionsService`).
- That service exposes the read API (`hasPermission`, `userPermissions$`) and the local mutation API (`setUserPermissions`, `clearPermissions`).
- It does **not** make HTTP calls. The HTTP fetch lives in the corresponding surface service (e.g. `TenantPermissionsService.getEffective()`); a bootstrap effect or facade reads from the surface service and writes into the state-owner service.

This separation is verbatim for Flutter: the equivalent split is `tenant_permissions_repository.dart` (HTTP) plus `user_permissions_notifier.dart` (Riverpod-style state). Concrete naming is Flutter-idiomatic; the separation is binding.

## Mixed-Dialog and Mixed-Page Pattern

Some UI components are surface-spanning by design — for example the employee dialog opened from the tenant directory must edit employees regardless of which institution they happen to belong to.

For this case:

- The component injects **both** surface services directly (`InstitutionEmployeesService` and `TenantEmployeesService` in `EmployeeDialogComponent`).
- It selects the surface with an explicit input or signal (`restrictToInstitutionId`), not by inferring from runtime conditions.
- It does **not** wrap the two services in a third "facade" service that branches internally — that recreates the mixed-surface anti-pattern at a higher layer.

The acceptance test for this rule is: looking at the component's class body, a reader can identify which surface every HTTP call targets without reading the service implementation.

### Worked example: `ClientDialogComponent`

The client dialog opens from two contexts: institution-scoped pages (a counsellor adds a client to their institution) and the tenant-admin clients list (an admin manages clients across institutions). Surface selection is data-driven:

- `data.adminContext?: { institutionId?: string }` — input that signals admin-mode and optionally constrains the institution
- `adminCreateMode = computed(() => data.mode === 'create' && !!data.adminContext)`

The component's constructor injects both services side-by-side:

```typescript
constructor(
  private institutionClientsService: InstitutionClientsService,
  private tenantAdminClientsService: TenantAdminClientsService,
  // ...
)
```

Each call site picks one explicitly:

```typescript
result = adminCreateMode()
  ? await tenantAdminClientsService.createClient(dto, institutionIds)
  : await institutionClientsService.createClient(dto);

result = data.adminContext
  ? await tenantAdminClientsService.updateClient(id, dto)
  : await institutionClientsService.updateClient(id, dto);
```

The pattern matches `EmployeeDialogComponent` even though the predicate is different (`adminContext` here, `restrictToInstitutionId` there). The shared rule: NO wrapper service, both services in the constructor, branching is data-driven and visible at the call site.

## Test Infrastructure

Mock factories follow the same surface decomposition as the services they mock. When a monolithic service is split, its mock factory is split too:

- `createMockBasicClientService()` → `createMockInstitutionClientsService()` + `createMockTenantAdminClientsService()`

The shared test helper `provideTestServices()` (in `apps/tagea-frontend/src/app/testing/mock-services.ts`) provides every surface-scoped service token; tests that exercise mixed-surface components get both tokens registered automatically. Tests that build their own provider arrays (e.g. `*.security.spec.ts` files) must register a mock for each injected service:

```typescript
// In a security spec for a mixed-surface dialog:
{ provide: InstitutionClientsService, useValue: mockInstitutionClientsService },
{ provide: TenantAdminClientsService, useValue: mockTenantAdminClientsService },
```

The `ServiceOverrides` interface follows the same naming, one key per surface:

```typescript
overrides?: {
  institutionClientsService?: Partial<jasmine.SpyObj<InstitutionClientsService>>;
  tenantAdminClientsService?: Partial<jasmine.SpyObj<TenantAdminClientsService>>;
};
```

When the legacy mock factory is removed in the split's final commit, the spec files that used it are migrated to the new factories in the same commit so the test infrastructure never goes through a broken intermediate state.

## Migration Playbook

When promoting an existing mixed-surface service to the convention, the proven sequence (validated by five completed cuts: `EmployeesService`, `EmailAvailabilityService`, `PermissionsService`, `RolesService`, `BasicClientService` — see References for commit ranges):

1. **Inventory the call sites.** Grep for every injection of the legacy service. Group them by which method they call. Each method maps to a target surface based on its URL prefix.
2. **Create the new surface services.** One file per target surface, with `providedIn: 'root'`. Copy the relevant methods over verbatim (do not refactor signatures in this step). Keep the legacy service untouched.
3. **Migrate callers in self-service-only first.** The `self` surface is the smallest scope and the safest landing zone; route guards and authentication assumptions are stable there.
4. **Migrate institution-scoped callers.** Cases, calendar, dialogs opened from institution pages.
5. **Migrate tenant-scoped callers.** Admin pages, tenant directory, sweep tools.
6. **Handle mixed-surface dialogs explicitly.** Do not migrate them in a "context-aware" wrapper; inject both new services directly per the Mixed-Dialog pattern above.
7. **Delete the legacy service.** A standalone commit, after all callers compile against the new services. The build is the verification: a forgotten caller surfaces immediately.
8. **Update default-role-permissions / route guards if the split also tightened auth scope.** Most cuts don't, but `EmployeesService` did because the previous tenant-only check was wrong for institution callers.

The migration is not a single PR. The series above can be 5–8 commits depending on call-site count; each is independently revertable.

## Known Mixed-Surface Backlog

As of 2026-04-30, every previously-known mixed-surface service has been migrated. The cuts that closed the backlog:

| Service                    | Resulting services                                                                          | Migration commits     |
| -------------------------- | ------------------------------------------------------------------------------------------- | --------------------- |
| `EmployeesService`         | `EmployeeSelfService` + `InstitutionEmployeesService` + `TenantEmployeesService`            | `a836c039` → `14004433` |
| `EmailAvailabilityService` | `InstitutionEmailAvailabilityService` + `TenantEmailAvailabilityService`                    | `885e950d`            |
| `PermissionsService`       | `TenantPermissionsService` + `InstitutionPermissionsService` + `UserPermissionsService` (state owner) | `3f64556c` → `3e9c1ea6` |
| `RolesService`             | `TenantRolesService` + `InstitutionRolesService`                                            | `aab1b1f1` → `864aedef` |
| `BasicClientService`       | `InstitutionClientsService` + `TenantAdminClientsService`                                   | `a641e60b` → `f7af9f03` |

Future detection of new mixed-surface services should be flagged via the Decision Rule and added back to this table.

## Naming Inconsistencies to Address

- `apps/tagea-frontend/src/app/services/admin-appointment-templates.service.ts` — `admin-` is not one of the seven defined surface prefixes. The backend route is `/administration/...` under `scope: 'tenant-admin'`, so the canonical name is `tenant-admin-appointment-templates.service.ts`. Pure rename; no behavior change.
- A handful of services live outside `apps/tagea-frontend/src/app/services/` (`app/core/tenant-resolution.service.ts`, `app/admin/super-admin-*/...`). These are intentional — feature-local helpers — and not in scope of this convention. Document the exception in the file's comment header so future readers don't try to migrate them.

## Acceptance Criteria

- [ ] **Given** a new HTTP service is added **When** it makes calls to a single backend surface **Then** its filename matches `<surface>-<resource>.service.ts` (or `<resource>-self.service.ts` for the self surface).
- [ ] **Given** a new HTTP service is added **When** it would call endpoints under two distinct `@Auth` scopes **Then** the change is rejected and the work is restructured into one service per surface.
- [ ] **Given** local state is shared across surface boundaries (e.g. cached permission set) **Then** the state lives in a dedicated state-owner service without a surface suffix and the HTTP fetch lives in the corresponding surface service.
- [ ] **Given** a backend controller is renamed or moved **When** the route prefix changes **Then** the matching frontend service is renamed in the same PR.
- [ ] **Given** a UI component must operate across surfaces **Then** it injects each surface service directly and selects between them via an explicit input — it does not delegate to a wrapper service.
- [ ] **Given** a service performs no HTTP calls **Then** the surface convention does not apply and the service may be named freely.
- [ ] **Given** an existing service violates the convention **When** it is migrated **Then** the steps in the Migration Playbook are followed, with one commit per surface to keep individual changes revertable.
- [ ] **Given** the Flutter port reads this spec **Then** it adopts the same surface decomposition with idiomatic Flutter naming (snake_case repository files, Notifier-style state owners) — the separation is binding, the naming is not.
- [ ] **Given** a method on a surface-scoped service **When** the surface name is already in the class **Then** the method name does NOT repeat the surface (e.g. `InstitutionPermissionsService.getPermissions`, not `getInstitutionPermissions`).
- [ ] **Given** a monolithic service mock factory exists **When** the service is split **Then** the mock factory is split into one factory per surface, `provideTestServices` registers all surface tokens, and inline mocks in `*.security.spec.ts` files register both/all surface mocks for mixed-surface components.

## Non-Goals

- **Backend controller layout.** This spec describes the frontend contract; the backend's `@Auth({ scope })` decorator and route prefixes are inputs, not outputs. Backend changes are governed by the backend's own conventions.
- **Service implementation patterns** beyond surface scoping (caching strategies, request batching, retry logic, optimistic updates). Those are per-service decisions.
- **State management within a single surface.** Whether a surface service uses signals, BehaviorSubjects, or stateless methods is not regulated here.
- **Naming for non-HTTP services** (theme, language, sanitizers, native bridges). Out of scope.
- **Folder structure beyond "services live in `app/services/`".** Subfolder grouping is not mandated.
- **Permissions / role design.** Lives in `cross-cutting/entity-permissions/`.
- **Feature flags and tenant features.** Lives in `cross-cutting/context-resolution/`.

## Edge Cases

- **Service with one HTTP call to an unscoped backend endpoint** (e.g. health check, version endpoint). Treat as `public` surface even if not under `/public/...`. Document the rationale in a one-line file comment.
- **Service that wraps an external SDK** (Matrix client, Sentry SDK). Not a Tagea backend surface — convention does not apply. Name freely.
- **Service that fetches from one surface and pushes to another** (e.g. fetches a profile from tenant and posts a change to institution). This is a mixed-surface service by definition; split it. The orchestration of "fetch then push" lives in a facade or component, not in a service.
- **Bootstrap-time fetch into shared local state.** A bootstrap effect calls `TenantPermissionsService.getEffective()` and writes the result to `UserPermissionsService.setUserPermissions(...)`. The effect is the bridge; neither service knows about the other.
- **Service that is currently single-surface but might gain a second surface in future.** Do not pre-split. Wait until the second surface actually exists; the migration playbook makes it cheap to split later.
- **Tenant-admin endpoints under `/administration/...` that some legacy services still call as if they were a separate "admin" world.** They are the `tenant-admin` surface. The spec records this so future readers don't re-invent a fourth layer.
- **Backend has `scope: 'teamspace'` controllers, but standalone teamspace services are rare in the frontend.** Most teamspace UI calls live in pages under `apps/tagea-frontend/src/app/pages/teamspace/`, which inject institution-scoped services because the teamspace's institution context is already in the URL. If a future feature requires a dedicated teamspace surface service, the naming is `teamspace-<resource>.service.ts`.

## References

**Reference exemplars (services that follow the convention):**

- `apps/tagea-frontend/src/app/services/employee-self.service.ts`
- `apps/tagea-frontend/src/app/services/institution-employees.service.ts`
- `apps/tagea-frontend/src/app/services/tenant-employees.service.ts`
- `apps/tagea-frontend/src/app/services/institution-email-availability.service.ts`
- `apps/tagea-frontend/src/app/services/tenant-email-availability.service.ts`
- `apps/tagea-frontend/src/app/services/tenant-permissions.service.ts`
- `apps/tagea-frontend/src/app/services/institution-permissions.service.ts`
- `apps/tagea-frontend/src/app/services/tenant-roles.service.ts`
- `apps/tagea-frontend/src/app/services/institution-roles.service.ts`
- `apps/tagea-frontend/src/app/services/institution-clients.service.ts`
- `apps/tagea-frontend/src/app/services/tenant-admin-clients.service.ts`

**State-owner exemplar (cross-surface local state, no HTTP):**

- `apps/tagea-frontend/src/app/services/user-permissions.service.ts` — owns `userPermissions$`, `hasPermission`, `hasAnyPermission`, `setUserPermissions`, `clearPermissions`. Bridge effect that fills it from the surface service lives in `apps/tagea-frontend/src/app/services/unified-auth.service.ts` (the `effect` that calls `permissionsService.setUserPermissions(perms)`).

**Backend mirror (controllers the exemplars track):**

- `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`
- `apps/tagea-backend/src/users/controllers/institution-employees.controller.ts`
- `apps/tagea-backend/src/users/controllers/tenant-employees.controller.ts`

**Auth scope definition:**

- `apps/tagea-backend/src/auth/authorization/auth.decorator.ts` — the `AuthConfig` interface is the source of truth for which scopes exist.

**Migration history (worked examples):**

- `EmployeesService` — five commits: `a836c039`, `54a03a0f`, `64a7eef9`, `a3311a6d`, `14004433`.
- `EmailAvailabilityService` — one commit: `885e950d`.
- `PermissionsService` — five commits: `3f64556c`, `ff2f0c43`, `068ef6db`, `8106e1db`, `3e9c1ea6`.
- `RolesService` — five commits: `aab1b1f1`, `4040ecf6`, `c50d08cd`, `17cc6fdd`, `864aedef`.
- `BasicClientService` — five commits: `a641e60b`, `3af8ca35`, `c13f9ce3`, `9d94c416`, `f7af9f03`.

**Mixed-dialog examples:**

- `apps/tagea-frontend/src/app/components/employee-dialog/employee-dialog.component.ts` — injects `InstitutionEmployeesService` and `TenantEmployeesService` directly; selects via `restrictToInstitutionId`.
- `apps/tagea-frontend/src/app/components/client-dialog/client-dialog.component.ts` — injects `InstitutionClientsService` and `TenantAdminClientsService` directly; selects via `data.adminContext` and the `adminCreateMode` computed signal.

**Test infrastructure:**

- `apps/tagea-frontend/src/app/testing/mock-services.ts` — surface-scoped `createMock<Surface><Resource>Service` factories, `provideTestServices` aggregator, `ServiceOverrides` interface.
- `apps/tagea-frontend/src/app/components/client-dialog/client-dialog.component.security.spec.ts` — mixed-dialog test that registers both `InstitutionClientsService` and `TenantAdminClientsService` mocks.

**Related cross-cutting specs:**

- `cross-cutting/http-interceptors/spec.md` — describes the request middleware that runs underneath every service call.
- `cross-cutting/context-resolution/spec.md` — describes how `tenantId`, `institutionId`, and the user permission set are resolved at bootstrap and on context switches.
- `cross-cutting/entity-permissions/spec.md` — describes the RBAC model whose permissions the surface services enforce.
