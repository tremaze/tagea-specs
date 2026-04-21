# Feature: Routing and Guards

> **Status:** 🚧 In progress
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

This bundle is the **authoritative map** of the entire Angular application's route tree and guard hierarchy. Per-feature specs reference individual guards; this document captures the complete picture — the three top-level layouts (`public-main`, `secure-shell`, `secure-main`), where each URL branch lives, which guards gate it, and how the entry-decision logic routes an arriving user to the correct landing page based on auth state, tenant features, user type, and employee status.

## User Stories

- As a **returning authenticated user** I want to be redirected to my preferred landing page (teamspace or institution dashboard) when I hit `/` so I don't have to navigate manually.
- As a **client user** I want any route I enter to route me into `/client-portal/*` — I should never see employee UI.
- As a **pending-approval employee** I want to be blocked at `/awaiting-approval` and prevented from reaching the main app until my account is activated.
- As a **super admin without a tenant** I want to reach `/no-tenant` with a usable page rather than a crash.
- As a **deep-linked user** (e.g. opening `/einrichtung/:id/clients` from a bookmark) I want the guards to validate the institution UUID, check feature flags and my access, and either let me through or redirect me to a meaningful fallback.

## Acceptance Criteria

- [ ] **Given** an unauthenticated visitor **When** they hit `/` **Then** `rootRedirectGuard` tries refresh-token recovery, then silent SSO, and on failure routes to `/welcome`.
- [ ] **Given** an authenticated visitor **When** they hit `/welcome`, `/landing`, or `/booking` **Then** `redirectIfAuthenticatedGuard` routes them to `/dashboard` (unless the path starts with an excluded prefix: `/auth/callback`, `/blocked-access`, `/no-tenant`, `/auth-error`, `/session-expired`, `/public/`).
- [ ] **Given** an authenticated employee with tenant feature `institutions` disabled **When** they hit `/einrichtung/:id/*` **Then** `institutionUrlGuard` redirects to `/teamspace` (or `/blocked-access` if teamspace is also disabled).
- [ ] **Given** an employee with `status = PENDING_APPROVAL` **When** they navigate to any route inside `secure-main` **Then** `activeEmployeeGuard` redirects to `/awaiting-approval`.
- [ ] **Given** a client user **When** they reach the wildcard `**` under `secure-main` **Then** `defaultModeRedirectGuard` routes them to `/client-portal`.
- [ ] **Given** an employee with both modes enabled **When** they reach the wildcard `**` **Then** `defaultModeRedirectGuard` honors `NavigationModeService.currentMode()` (default teamspace → `/teamspace`; einrichtung → `/einrichtung/:id/dashboard`).
- [ ] **Given** a route with `canActivate: [permissionGuard, chatFeatureGuard]` **When** any guard returns `UrlTree` or `false` **Then** Angular short-circuits left-to-right and the later guards do not execute.
- [ ] **Given** a form with unsaved changes **When** the user navigates away **Then** `UnsavedChangesGuard` opens a dialog and only allows navigation after the user picks Save, Discard, or acknowledges Cancel.

## UI States

Routing itself has no user-visible state; the states live in the three layout components and are inherited by all children. This table captures the layout decision points.

| State            | When?                                                                     | What does the user see?                                               | A11y notes                            |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- |
| Public shell     | URL matches `PUBLIC_ROUTES` branch                                        | `public-main` with optional header (`showHeader` route-data)          | Header reachable via Tab              |
| Pending-approval | Authenticated employee with `status=pending_approval` on any secure route | `secure-shell` → `EmployeeAwaitingApprovalComponent`                  | Focus moves to status heading         |
| Main app         | Authenticated, active employee or client                                  | `secure-shell` → `secure-main` with nav + feature content             | Skip-to-content link in `secure-main` |
| Error / Blocked  | `no-tenant`, `blocked-access`, `auth-error`, `session-expired`            | Inside `public-main` (never redirected away, even when authenticated) | Error heading is `role="alert"`       |

## Flows

### Top-level route tree

```
/ (angular root)
├── PUBLIC_ROUTES (layouts/public-main) — redirectIfAuthenticatedGuard
│   ├── ''                              — rootRedirectGuard                        (empty-path, full match)
│   ├── auth/callback                   — AuthCallbackComponent                    (OAuth return — excluded from redirect)
│   ├── login                           → redirect to auth/callback
│   ├── no-tenant                       — NoTenantComponent                        (excluded)
│   ├── blocked-access                  — BlockedAccessComponent                   (excluded)
│   ├── auth-error                      — AuthErrorComponent                       (excluded)
│   ├── session-expired                 — SessionExpiredComponent                  (excluded)
│   ├── public/password-reset/:userId/:token (excluded — prefix /public/)
│   ├── public/email-verified           (excluded)
│   ├── public/register                 (excluded, showHeader)
│   ├── public/video/:token             (excluded)
│   ├── welcome                         — LandingPageComponent
│   ├── landing                         → redirect to welcome
│   └── booking                         — BookingPageComponent                     (showHeader)
│
└── '' (layouts/secure-shell) — AUTH_GUARD
    ├── awaiting-approval               — pendingEmployeeGuard
    ├── chat/room/:roomId               — permissionGuard + chatFeatureGuard       (data: chat.access)
    ├── chat/invite/:roomId             — permissionGuard + chatFeatureGuard       (data: chat.access)
    │
    └── '' (layouts/secure-main) — activeEmployeeGuard
        ├── ai-chat                     — aiChatFeatureGuard                       (lazy)
        ├── chat                        — permissionGuard + chatFeatureGuard       (lazy, data: chat.access)
        ├── super-admin                 — permissionGuard                          (lazy, data: admin.access)
        ├── teamspace/*                 — TEAMSPACE_ROUTES                         (see below)
        ├── dateien                     — fileStorageFeatureGuard                  (lazy)
        ├── client-portal/*             — clientPortalGuard → CLIENT_PORTAL_CHILD_ROUTES
        ├── einrichtung/:institutionId  — institutionUrlGuard → INSTITUTION_CHILDREN
        ├── employee-profile            — (canDeactivate: UnsavedChangesGuard)
        ├── einstellungen/*             — einstellungenGuard (lazy → EINSTELLUNGEN_ROUTES)
        └── **                          — defaultModeRedirectGuard (wildcard catch-all)
```

Lazy-loaded branches (via `loadComponent`/`loadChildren`): nearly every leaf component, plus the module-level branches `super-admin`, `dateien`, `reports` (under institution), `einstellungen/*`, `lms/*`, and `teamspace/lms/*`. `PUBLIC_ROUTES` and the two layout components are also lazy. Eager: `INSTITUTION_PARENT_ROUTE` (route config only — leaf components are still lazy).

### Entry-decision flow on `/` (rootRedirectGuard)

```
Visit /
  │
  ▼
await authService.isInitialized$
  │
  ├── authService.isAuthenticated ────────────────► /dashboard
  │
  ├── authService.hasRefreshToken()
  │     └── await ensureAuthenticated()
  │          └── if refreshed ─────────────────────► /dashboard
  │
  ├── await authService.trySilentLogin()
  │     └── if SSO session found ──────────────────► /dashboard
  │
  └── else ────────────────────────────────────────► /welcome
```

`/dashboard` has no route definition of its own — it matches the wildcard `**` inside `secure-main`, which delegates to `defaultModeRedirectGuard`. The redirect chain `/` → `/dashboard` → final landing page is intentional: it lets any other code navigate to `/dashboard` and trust that the correct mode-based landing page will be chosen.

### Wildcard landing flow (defaultModeRedirectGuard)

```
Reach ** inside secure-main
  │
  ▼
await tenantFeaturesService.features() !== null   (max 3s)
  │
  ├── authService.isClient() ───────────────────────► /client-portal
  │
  ├── isInstitutionsEnabled && hasAccessibleInstitutions && isTeamspaceEnabled
  │     └── navigationMode = teamspace ─────────────► /teamspace
  │     └── else ──────────────────────────────────► /einrichtung/:id/dashboard
  │
  ├── isInstitutionsEnabled && hasAccessibleInstitutions
  │     └── ───────────────────────────────────────► /einrichtung/:id/dashboard
  │
  ├── isTeamspaceEnabled ───────────────────────────► /teamspace
  │
  ├── isInstitutionsEnabled && (isTenantAdmin || isSuperAdmin)
  │     ├── institutionId ─────────────────────────► /einrichtung/:id/dashboard
  │     └── no institutionId ──────────────────────► /blocked-access
  │
  └── fallback ─────────────────────────────────────► /blocked-access
```

`redirectToInstitution()` prefers `authService.institutionId()`; if unset, it takes `authorizationStore.accessibleInstitutionIds()[0]`; if the accessible list is empty, falls back to `/blocked-access`.

### Institution deep-link flow (institutionUrlGuard)

```
Visit /einrichtung/:institutionId/*
  │
  ▼
isValidUuid(institutionId) ───── false ─────► /
  │
  ▼
await employee loaded && features loaded (max 5s)
  │
  ├── !employee ────────────────────────────► /login
  │
  ├── !isInstitutionsEnabled
  │     ├── isTeamspaceEnabled ────────────► /teamspace
  │     └── else ──────────────────────────► /blocked-access
  │
  ├── !hasCounselingInstitutions && !admin ─► /teamspace or /blocked-access
  │
  ├── setInstitutionFromUrl(institutionId)
  │
  ├── !hasInstitutionAccess && !admin ─────► /teamspace or /blocked-access
  │
  └── true ─────────────────────────────────► proceed
```

### redirectIfAuthenticatedGuard (public routes)

```
EXCLUDED_PATHS = [
  '/auth/callback',
  '/blocked-access',
  '/no-tenant',
  '/auth-error',
  '/session-expired',
  '/public/'                  // prefix — covers password-reset, email-verified, register, video
]

  │
  ├── state.url.startsWith(excluded) ──► allow (return true)
  │
  ├── !authService.canAuthenticate() ─► allow
  │
  ├── await ensureAuthenticated()
  │     └── authenticated ────────────► /dashboard
  │
  └── else ────────────────────────────► allow
```

### Guard stacking

Angular runs `canActivate: [a, b, c]` **left to right, sequentially**. If any returns `false` or a `UrlTree`, subsequent guards are skipped and navigation is preempted. Canonical stacks in this app:

| Stack                                                                       | Example path                                                                                    | Semantics                                                                                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[permissionGuard, <featureGuard>]`                                         | `/einrichtung/:id/cases` with `data: { requiredPermission: 'cases.view' }` + `caseFeatureGuard` | Check RBAC first (cheap, in-memory), then feature flag (may wait on `tenantFeaturesService.loading$`).                                                      |
| `[tenantPermissionGuard, teamspaceFeatureGuard]`                            | `/teamspace/news`                                                                               | Tenant-level permission (`teamspace_news.view`) before feature flag.                                                                                        |
| `[teamspaceAdminOnlyGuard, teamspaceFeatureGuard]`                          | `/teamspace/submissions/konfiguration`                                                          | Role check first, then feature flag.                                                                                                                        |
| `[AUTH_GUARD]` on `secure-shell` + `[activeEmployeeGuard]` on `secure-main` | Any main-app route                                                                              | Parent guards run before child guards. `AUTH_GUARD` gates the whole secure tree; `activeEmployeeGuard` then blocks pending employees from the inner layout. |
| `[tenantPermissionGuard, teamspaceFeatureGuard, schulungenFeatureGuard]`    | `/teamspace/lms/*`                                                                              | Three guards — permission, module, and sub-feature.                                                                                                         |

### Unsaved-changes flow (canDeactivate)

Attached as `canDeactivate: [UnsavedChangesGuard]` to `employee-profile`, `client-portal/profil`, institution `profile/:id/stammdaten`, institution `cases/:id`, and any case tab that hosts an editable form. The guarded component must implement `CanComponentDeactivate` (`canDeactivate()`, optional `getUnsavedChanges()`, `getEntityName()`, `saveChanges()`). On `false`, the guard opens `UnsavedChangesDialogComponent` with `disableClose: true`; actions: `save` (delegates to `saveChanges()`), `discard` (allow), `cancel` (block).

## Non-Goals

- Per-feature routing details — those live in the individual feature specs. This bundle only captures the skeleton and guard taxonomy.
- RBAC rule definition — `permissionGuard` consumes `requiredPermission` from route data but the permission name mapping (e.g. what `cases.view` actually grants) is covered by the RBAC bundle.
- OAuth flow mechanics — `auth/callback` behavior is in the authentication spec.

## Edge Cases

- **Race on reload**: `defaultModeRedirectGuard`, `institutionUrlGuard`, `teamspaceAdminGuard`, and the feature guards all wait on `waitForCondition(...)` (3–5s) before reading state. If the condition never resolves, they fall through to their default branches (usually `/blocked-access` or the redirect target).
- **Infinite-redirect prevention in `permissionGuard`**: if the required permission is `dashboard.view` or the user lacks `dashboard.view`, the guard redirects to `/blocked-access` instead of `/dashboard` to avoid a loop.
- **`tenantPermissionGuard` on `teamspace_home.view`**: tries `TEAMSPACE_NAV_FALLBACK_ORDER` (news → submissions → events → kalender → directory → knowledge-base → lms) before falling back to `/dashboard` (if institutions) or `/blocked-access`.
- **Invalid UUID in institution URL**: `institutionUrlGuard` redirects to `/` without logging an error — malformed links silently reset.
- **Client on employee routes**: `activeEmployeeGuard` lets clients pass (return `true`) because client-specific routing happens downstream in `defaultModeRedirectGuard` or `clientPortalGuard`.
- **Auth error during `clientPortalGuard`**: if `profileLoadError()` is set, redirects to `/auth-error` rather than `/welcome` so the error page can surface the reason.
- **`einstellungen` redirect cascade**: `einstellungen/` (empty) calls `einstellungenDefaultRedirectGuard` which picks one of 4 targets based on admin scope, navigation mode, and institution context. Legacy flat paths (`einstellungen/klienten-felder` etc.) have dedicated legacy redirect guards that reconstruct the full `einstellungen/einrichtung/:id/…` URL.
- **`pendingEmployeeGuard` gotcha**: placed _inside_ `secure-shell` but _outside_ `secure-main`, so pending employees bypass `activeEmployeeGuard` only for this one route. If `activeEmployeeGuard` runs first for any reason, pending employees would be redirected to `/awaiting-approval` — which is exactly the route guarded by `pendingEmployeeGuard`. The guard order is therefore load-bearing.

## Permissions & Tenant/Institution

This bundle consolidates every guard check; per-route specifics live in the per-feature specs.

- **Required roles:** All five — client, employee (active/pending), schulung-admin, tenant-admin, super-admin. Different routes gate different slices.
- **Institution context:** `institutionUrlGuard` is the sole writer of `UnifiedAuthService.setInstitutionFromUrl()`. Every `/einrichtung/:institutionId/*` URL sets context as a side effect of navigation.
- **Backend access checks:** Guards only check **local** state (signals fed by the auth bootstrap). The backend performs authoritative checks on every request and can return 401/403 — those are handled by HTTP interceptors (see [http-interceptors spec](../http-interceptors/spec.md)), not guards.

## Notifications (Push / In-App)

Not applicable — routing is not a notification source.

## i18n Keys

Routing has no user-visible strings. Guard `console.warn`/`console.log` messages are developer-only (English). The components reached by guard redirects (`BlockedAccessComponent`, `NoTenantComponent`, `AuthErrorComponent`, `SessionExpiredComponent`, `EmployeeAwaitingApprovalComponent`) own their own i18n keys.

## Offline Behavior

Flutter-specific. All guards run synchronously against local in-memory signals after an initial `waitForCondition`; they never issue HTTP calls. In Flutter the equivalent logic belongs in GoRouter `redirect`/`refreshListenable` wired to the Riverpod providers that hold `UnifiedAuthService` / `TenantFeaturesService` state.

## References

- **Angular implementation:**
  - `apps/tagea-frontend/src/app/app.routes.ts` (top-level tree)
  - `apps/tagea-frontend/src/app/routes/*.routes.ts` (branch route tables)
  - `apps/tagea-frontend/src/app/guards/*.ts` (all guard functions)
  - `apps/tagea-frontend/src/app/pages/einstellungen/einstellungen.routes.ts` (settings sub-tree with its own inline guards)
  - `apps/tagea-frontend/src/app/pages/files/files.routes.ts`, `apps/tagea-frontend/src/app/pages/lms/lms.routes.ts` (feature sub-trees)
- **E2E tests:** `apps/tagea-frontend-e2e/src/*` — nearly every test exercises guard flows by navigating to specific URLs with specific test users.
- **Backend endpoints:** None directly — see [contracts.md](./contracts.md) for the guard → service contract.
