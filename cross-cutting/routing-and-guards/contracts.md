# Contracts: Routing and Guards

> There is no HTTP contract for routing — guards are pure client-side. This document is the authoritative catalogue of every guard: its type, the service calls it depends on, the route-data it consumes, and the redirect target when it denies access.

## Route file catalogue

| File                                                                      | Purpose                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/tagea-frontend/src/app/app.routes.ts`                               | Top-level tree. Composes `PUBLIC_ROUTES` with the secure-shell + secure-main layouts and wires every first-level branch.                                                                                                                                                                        |
| `apps/tagea-frontend/src/app/routes/public.routes.ts`                     | `PUBLIC_ROUTES` — `public-main` layout wrapping `rootRedirectGuard`, auth/callback, login, error pages (no-tenant, blocked-access, auth-error, session-expired), `public/*` family, welcome, landing, booking.                                                                                  |
| `apps/tagea-frontend/src/app/routes/institution.routes.ts`                | `INSTITUTION_PARENT_ROUTE` (`einrichtung/:institutionId`) + `INSTITUTION_CHILDREN` covering dashboard, tasks, calendar, clients, cases, employees, pending-employees, PEP, billing, reports, knowledge-base, redaktion, klienten-news, dateien, plus profile/:id and cases/:id detail branches. |
| `apps/tagea-frontend/src/app/routes/teamspace.routes.ts`                  | `TEAMSPACE_ROUTES` — personenverzeichnis, submissions (verwaltung/konfiguration), terminbuchungen, home (`''`), news, submissions, lms, redaktion, events, knowledge-base, kalender, buchung/:id, gehaltsnachweise.                                                                             |
| `apps/tagea-frontend/src/app/routes/client-portal.routes.ts`              | `CLIENT_PORTAL_BASE_GUARDS` + `CLIENT_PORTAL_CHILD_ROUTES` — dashboard, termine, dokumente, news, nachrichten, chat, profil.                                                                                                                                                                    |
| `apps/tagea-frontend/src/app/routes/case.routes.ts`                       | `CASE_CHILD_ROUTES` — overview, appointments, financial, approvals, data, reminders, documents (tabs under `cases/:id`).                                                                                                                                                                        |
| `apps/tagea-frontend/src/app/routes/profile.routes.ts`                    | `PROFILE_BASE_GUARDS` + `PROFILE_CHILD_ROUTES` — overview, appointments, stammdaten, relationships, financial, reminders, documents, messages, cases, reports (tabs under `einrichtung/:id/profile/:id`).                                                                                       |
| `apps/tagea-frontend/src/app/pages/einstellungen/einstellungen.routes.ts` | `EINSTELLUNGEN_ROUTES` with einrichtung vs. traeger split, plus legacy redirect guards and `einstellungenDefaultRedirectGuard`.                                                                                                                                                                 |
| `apps/tagea-frontend/src/app/pages/files/files.routes.ts`                 | `FILES_ROUTES` — file-storage feature sub-tree.                                                                                                                                                                                                                                                 |
| `apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`                     | `LMS_ROUTES` — learning management sub-tree.                                                                                                                                                                                                                                                    |

## Guard taxonomy

### 1. Auth guards

| Guard                             | Type            | Source                                      | Purpose                                                                                                                                                                                                       | Route-data | Redirect on deny                                                                      |
| --------------------------------- | --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `AUTH_GUARD` (from `@tagea/auth`) | `CanActivateFn` | library                                     | Gates the entire `secure-shell` subtree. Requires a valid auth session.                                                                                                                                       | —          | library-internal (typically to `/welcome` or `/auth/callback`)                        |
| `redirectIfAuthenticatedGuard`    | `CanActivateFn` | `guards/redirect-if-authenticated.guard.ts` | Wraps `public-main`. If user is already authenticated, bounce to `/dashboard`. Excludes paths starting with `/auth/callback`, `/blocked-access`, `/no-tenant`, `/auth-error`, `/session-expired`, `/public/`. | —          | `/dashboard` (when authenticated and not excluded)                                    |
| `rootRedirectGuard`               | `CanActivateFn` | `guards/root-redirect.guard.ts`             | Attached to empty-path child of `public-main`. Picks `/dashboard` if already / can-become authenticated (refresh-token or silent SSO), otherwise `/welcome`.                                                  | —          | `/dashboard` or `/welcome`                                                            |
| `defaultModeRedirectGuard`        | `CanActivateFn` | `guards/default-mode-redirect.guard.ts`     | Catch-all wildcard under `secure-main`. Resolves the correct landing page based on user type, tenant feature flags, accessible institutions, and saved navigation mode.                                       | —          | `/client-portal` \| `/teamspace` \| `/einrichtung/:id/dashboard` \| `/blocked-access` |

```ts
// redirectIfAuthenticatedGuard source
const EXCLUDED_PATHS = ['/auth/callback', '/blocked-access', '/no-tenant', '/auth-error', '/session-expired', '/public/'];
```

### 2. Permission guards

| Guard                   | Type            | Source                              | Purpose                                                                                                                                                                                             | Route-data                             | Redirect on deny                                                                                       |
| ----------------------- | --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `permissionGuard`       | `CanActivateFn` | `guards/permission.guard.ts`        | Reads `requiredPermission` from route-data and checks `UnifiedAuthService.hasPermission()`. Waits for auth profile to load.                                                                         | `{ requiredPermission: string }`       | clients → `/client-portal`; employee missing `dashboard.view` → `/blocked-access`; else → `/dashboard` |
| `tenantPermissionGuard` | `CanActivateFn` | `guards/tenant-permission.guard.ts` | Reads `requiredTenantPermission` from route-data and checks `UnifiedAuthService.hasTenantPermission()`. For `teamspace_home.view`, falls through `TEAMSPACE_NAV_FALLBACK_ORDER` before redirecting. | `{ requiredTenantPermission: string }` | first allowed teamspace nav route, else `/dashboard` (if institutions) or `/blocked-access`            |

```ts
// tenantPermissionGuard fallback order for teamspace_home.view
const TEAMSPACE_NAV_FALLBACK_ORDER = [
  { permission: 'teamspace_home.view', path: '/teamspace' },
  { permission: 'teamspace_news.view', path: '/teamspace/news' },
  { permission: 'teamspace_submissions.view', path: '/teamspace/submissions' },
  { permission: 'teamspace_events.view', path: '/teamspace/events' },
  { permission: 'teamspace_calendar.view', path: '/teamspace/kalender' },
  { permission: 'teamspace_directory.view', path: '/teamspace/personenverzeichnis' },
  { permission: 'teamspace_knowledge_base.view', path: '/teamspace/knowledge-base' },
  { permission: 'teamspace_lms.view', path: '/teamspace/lms' },
];
```

### 3. Feature-flag guards

All read from `TenantFeaturesService` after awaiting `loading$`. Every guard below returns `true` if the flag is enabled and (where applicable) the user has the tenant permission; otherwise it returns a `UrlTree` to the listed fallback.

| Guard                          | Source                                      | `TenantFeaturesService` method  | Additional checks                                                                           | Redirect on deny                                                                                               |
| ------------------------------ | ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `chatFeatureGuard`             | `guards/chat-feature.guard.ts`              | `isChatEnabled()`               | —                                                                                           | clients → `/client-portal`; else → `/teamspace`                                                                |
| `aiChatFeatureGuard`           | `guards/ai-chat-feature.guard.ts`           | `isAiChatEnabled()`             | blocks clients; requires tenant permission `ai_chat.view`                                   | clients → `/client-portal`; feature off → `/`; no permission → `/teamspace`                                    |
| `teamspaceFeatureGuard`        | `guards/teamspace-feature.guard.ts`         | `isTeamspaceEnabled()`          | —                                                                                           | institutions enabled → `/dashboard`; else → `/blocked-access`                                                  |
| `caseFeatureGuard`             | `guards/case-feature.guard.ts`              | `isCaseManagementEnabled()`     | also requires permission `cases.view`                                                       | institution settings page `klienten-felder`                                                                    |
| `clientPortalGuard`            | `guards/client-portal.guard.ts`             | `isClientPortalEnabled()`       | auth check, profile-load-error guard, blocks employees                                      | unauthenticated → `/welcome`; employee → `/dashboard`; profile error → `/auth-error`; feature off → `/welcome` |
| `fileStorageFeatureGuard`      | `guards/file-storage-feature.guard.ts`      | `isFileStorageEnabled()`        | blocks clients; requires `file_storage.access`                                              | clients → `/client-portal`; else → `/teamspace`                                                                |
| `clientReportsFeatureGuard`    | `guards/client-reports-feature.guard.ts`    | `isClientReportsEnabled()`      | requires permission `client_reports.view`                                                   | institution settings page `klienten-felder`                                                                    |
| `clientMessagesFeatureGuard`   | `guards/client-messages-feature.guard.ts`   | `isClientMessagesEnabled()`     | —                                                                                           | `/`                                                                                                            |
| `pepFeatureGuard`              | `guards/pep-feature.guard.ts`               | `isPepEnabled()`                | —                                                                                           | `/dashboard`                                                                                                   |
| `tasksFeatureGuard`            | `guards/tasks-feature.guard.ts`             | `isTasksEnabled()`              | —                                                                                           | `/dashboard`                                                                                                   |
| `reportsFeatureGuard`          | `guards/reports-feature.guard.ts`           | `isReportsEnabled()`            | —                                                                                           | `/dashboard`                                                                                                   |
| `proofOfSalaryFeatureGuard`    | `guards/proof-of-salary-feature.guard.ts`   | `isProofOfSalaryEnabled()`      | requires `CurrentEmployeeService.hasProofOfSalaryAccess()` (personnel_number + access flag) | `/teamspace`                                                                                                   |
| `schulungenFeatureGuard`       | `guards/schulungen-feature.guard.ts`        | `isSchulungenEnabled()`         | —                                                                                           | `/teamspace`                                                                                                   |
| `billingFeatureGuard`          | `guards/billing-feature.guard.ts`           | `billingProvider() === 'TAGEA'` | —                                                                                           | institution settings page `klienten-felder`                                                                    |
| `approvalsFeatureGuard`        | `guards/billing-feature.guard.ts`           | `isBillingEnabled()`            | —                                                                                           | `/`                                                                                                            |
| `financialSupportFeatureGuard` | `guards/financial-support-feature.guard.ts` | `isFinancialSupportEnabled()`   | —                                                                                           | institution settings page `klienten-felder`                                                                    |
| `institutionsFeatureGuard`     | `guards/institutions-feature.guard.ts`      | `isInstitutionsEnabled()`       | —                                                                                           | institution settings page `klienten-felder`                                                                    |
| `departmentsFeatureGuard`      | `guards/departments-feature.guard.ts`       | `isDepartmentsEnabled()`        | —                                                                                           | institution settings page `klienten-felder`                                                                    |

### 4. Tenant / institution context guards

| Guard                     | Type            | Source                                 | Purpose                                                                                                                                                                             | Redirect on deny                                                                                              |
| ------------------------- | --------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `institutionUrlGuard`     | `CanActivateFn` | `guards/institution-url.guard.ts`      | Validates `institutionId` UUID, waits for employee + features, confirms access via `AuthorizationStore.hasInstitutionAccess()`, calls `UnifiedAuthService.setInstitutionFromUrl()`. | invalid UUID → `/`; no employee → `/login`; feature off → `/teamspace` or `/blocked-access`; no access → same |
| `einstellungenGuard`      | `CanActivateFn` | `guards/einstellungen.guard.ts`        | Allows tenant-admin, super-admin, or anyone with `institutions.manage`/`admin.access`.                                                                                              | `/` if unauthenticated, `/dashboard` otherwise                                                                |
| `tenantAdminGuard`        | `CanActivateFn` | `guards/tenant-admin.guard.ts`         | Requires super-admin or tenant-admin.                                                                                                                                               | `/` unauthenticated, `/dashboard` otherwise                                                                   |
| `adminAccessGuard`        | `CanActivateFn` | `guards/admin-access.guard.ts`         | Tenant-admin, super-admin, or `admin.access` permission. Used in `einstellungen/traeger/mitarbeitende`, `einstellungen/einrichtung/:id/mitarbeitende`.                              | `/` or `/dashboard`                                                                                           |
| `superAdminGuard`         | `CanActivateFn` | `guards/super-admin.guard.ts`          | Requires `isSuperAdmin`.                                                                                                                                                            | `/`                                                                                                           |
| `teamspaceAdminGuard`     | `CanActivateFn` | `guards/teamspace-admin.guard.ts`      | Allows super-admin, or any teamspace admin/bearbeiter role. Used for `teamspace/submissions/verwaltung`.                                                                            | `/`                                                                                                           |
| `teamspaceAdminOnlyGuard` | `CanActivateFn` | `guards/teamspace-admin-only.guard.ts` | Super-admin or teamspace **admin only** (no bearbeiter). Used for konfiguration routes.                                                                                             | `/`                                                                                                           |
| `teamspaceEditorGuard`    | `CanActivateFn` | `guards/teamspace-editor.guard.ts`     | Super-admin, teamspace admin, or redakteur. Used for redaktion routes.                                                                                                              | `/`                                                                                                           |
| `schulungAdminGuard`      | `CanActivateFn` | `guards/schulung-admin.guard.ts`       | Super-admin, tenant-admin, or schulung-admin.                                                                                                                                       | `/`, else `/dashboard`                                                                                        |
| `teamspaceModeGuard`      | `CanActivateFn` | `guards/teamspace-mode.guard.ts`       | Side-effect only: sets `NavigationModeService.setMode('teamspace')` if not already. Always returns `true`.                                                                          | never                                                                                                         |
| `clientPortalModeGuard`   | `CanActivateFn` | `guards/client-portal.guard.ts`        | Stub — returns `true`. Reserved for future mode side-effect.                                                                                                                        | never                                                                                                         |

### 5. Employee-status guards

| Guard                  | Type            | Source                              | Purpose                                                                                                  | Redirect on deny                                                               |
| ---------------------- | --------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `activeEmployeeGuard`  | `CanActivateFn` | `guards/employee-approval.guard.ts` | Blocks employees with `status === 'pending_approval'` from entering `secure-main`. Clients pass through. | unauthenticated → `/welcome`; pending → `/awaiting-approval`                   |
| `pendingEmployeeGuard` | `CanActivateFn` | `guards/employee-approval.guard.ts` | Only allows pending employees onto `/awaiting-approval`. Clients are bounced to client portal.           | unauthenticated → `/welcome`; client → `/client-portal`; active → `/dashboard` |

### 6. Deactivate guards

| Guard                 | Type                                            | Source                            | Purpose                                                                                                                                              |
| --------------------- | ----------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UnsavedChangesGuard` | `CanDeactivate<CanComponentDeactivate>` (class) | `guards/unsaved-changes.guard.ts` | Opens `UnsavedChangesDialogComponent` when the guarded component's `canDeactivate()` returns `false`. Handles `save` / `discard` / `cancel` actions. |

```ts
// Interface the guard expects on any component it protects
export interface CanComponentDeactivate {
  canDeactivate(): boolean | Observable<boolean>;
  getUnsavedChanges?(): UnsavedChangesDialogData['changedFields'];
  getEntityName?(): string;
  saveChanges?(): Observable<boolean> | Promise<boolean> | boolean;
}
```

## Route-data shape

Guards consume these keys from `ActivatedRouteSnapshot.data`:

```ts
// documentation-only
interface RouteData {
  title?: string;
  requiredPermission?: string; // permissionGuard
  requiredTenantPermission?: string; // tenantPermissionGuard
  targetAudience?: 'clients'; // permissionGuard disambiguator (klienten-news)
  mode?: string; // consumed by components, not guards
  context?: string; // consumed by components
  showHeader?: boolean; // public-main layout
}
```

## Guard stacking rules

- Angular runs `canActivate` arrays **left-to-right**, awaiting any returned `Promise`/`Observable` before proceeding.
- First guard that returns `false` or a `UrlTree` short-circuits the rest.
- Parent guards run before child guards. `AUTH_GUARD` on `secure-shell` runs before `activeEmployeeGuard` on the nested `secure-main`.
- `canDeactivate` fires on navigation _away_; `canActivate` on navigation _to_. A route with both receives `canDeactivate` first for the old route, then `canActivate` for the new.

## Guard → service dependency map

| Guard                                                                                                                                                                                                              | Services injected                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `rootRedirectGuard`                                                                                                                                                                                                | `AuthService`, `Router`                                                                                         |
| `redirectIfAuthenticatedGuard`                                                                                                                                                                                     | `AuthService`, `Router`                                                                                         |
| `defaultModeRedirectGuard`                                                                                                                                                                                         | `TenantFeaturesService`, `UnifiedAuthService`, `AuthorizationStore`, `NavigationModeService`, `Router`          |
| `institutionUrlGuard`                                                                                                                                                                                              | `UnifiedAuthService`, `TenantFeaturesService`, `AuthorizationStore`, `Router`                                   |
| `permissionGuard`                                                                                                                                                                                                  | `UnifiedAuthService`, `Router`                                                                                  |
| `tenantPermissionGuard`                                                                                                                                                                                            | `UnifiedAuthService`, `Router`                                                                                  |
| `clientPortalGuard`                                                                                                                                                                                                | `UnifiedAuthService`, `TenantFeaturesService`, `Router`                                                         |
| `activeEmployeeGuard` / `pendingEmployeeGuard`                                                                                                                                                                     | `UnifiedAuthService`, `Router`                                                                                  |
| `einstellungenGuard`                                                                                                                                                                                               | `UnifiedAuthService`, `AuthorizationStore`, `Router`                                                            |
| `tenantAdminGuard` / `superAdminGuard` / `adminAccessGuard` / `schulungAdminGuard`                                                                                                                                 | `UnifiedAuthService`, `Router`                                                                                  |
| `teamspaceAdminGuard` / `teamspaceAdminOnlyGuard` / `teamspaceEditorGuard`                                                                                                                                         | `UnifiedAuthService`, `TeamspaceService`, `Router`                                                              |
| `teamspaceModeGuard`                                                                                                                                                                                               | `NavigationModeService`                                                                                         |
| feature guards (chat, ai-chat, teamspace, case, file-storage, client-reports, client-messages, pep, tasks, reports, proof-of-salary, schulungen, billing, approvals, financial-support, institutions, departments) | `TenantFeaturesService` + varying (`UnifiedAuthService`, `InstitutionContextService`, `CurrentEmployeeService`) |
| `UnsavedChangesGuard`                                                                                                                                                                                              | `MatDialog`                                                                                                     |

> **Flutter port note:** In GoRouter the equivalent is `redirect:` on individual routes plus `refreshListenable:` on the router pointing at the Riverpod providers that back `UnifiedAuthService` and `TenantFeaturesService`. A single `rootRedirect` function can replace `rootRedirectGuard`, `redirectIfAuthenticatedGuard`, and the `defaultModeRedirectGuard` wildcard by inspecting `GoRouterState.uri.path` and the provider snapshots. `canDeactivate` has no direct GoRouter analog — implement via `PopScope` on forms plus a confirmation dialog.
