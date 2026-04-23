# Feature: Teamspace Privileges (Frontend + Backend Consolidation)

> **Status:** 🚧 In Progress
> **Owner:** svenarbeit
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

All teamspace-scoped authorization decisions — both backend and frontend — are resolved through the permission catalog (`submissions.view_all`, `news.create`, `bookings.manage`, …) rather than role-name comparisons (`admin`, `bearbeiter`, `redakteur`). Role names remain only as assignment "buckets" that seed default permission sets. The admin UI that edits the role→permission matrix and the auth pipeline that reads it share a single source of truth (`permissions` + `role_permissions`, filtered by `resource LIKE 'ts.%'`).

## Motivation

Backend access control for teamspaces is already permission-based (`PermissionResolverService`, `submissions.service.applyAccessControl`, `teamspacePermissionsService.getPermissionsByRole`). The frontend — and a small residual set of backend helpers — still compare role names directly. This split has three consequences:

1. **Custom teamspace roles are ignored by the frontend.** A tenant-defined role with `news.create` permission does not unlock the news-editor button, because the button checks `hasAdminOrRedakteurRole()`.
2. **Permission overrides on standard roles are ignored by the frontend.** Stripping `submissions.edit` from the `bearbeiter` default set still leaves the Bearbeiter seeing the submissions-admin navigation.
3. **Admin-matrix edits silently don't take effect at all.** `TeamspacePermissionsService.updateRolePermissions` writes to the legacy `teamspace_role_permissions` table, but `TeamspaceAuthLoaderService` — which populates `/auth/context` — reads from the central `role_permissions` table. A tenant admin can uncheck every box for a role and the user's `teamspaces[*].permissions` in `/auth/context` still comes back with the migration-seeded defaults, because the two tables are now write-only / read-only halves of a split that was half-completed when `ts.*` permissions were merged into the central `permissions` table (migration `20260220200000-MergeTeamspacePermissions`).

This work eliminates the split: the frontend consumes teamspace permissions via `/auth/context` (already served by `AuthorizationStore`), all role-name comparisons are replaced with permission lookups, and `TeamspacePermissionsService` is rewired to the central permission tables so matrix edits reach the auth loader.

## Observable behavior changes

Most behavior is unchanged for the standard roles Admin / Bearbeiter / Redakteur (because their default permission sets already encode the old rule). The following edge cases change:

1. **Custom teamspace roles** now correctly unlock feature-gates based on their granted permissions. Previously they were silently excluded from all UI gates.
2. **Permission overrides** (when a tenant customizes the permissions of a standard role) now take effect in the frontend. Previously they were bypassed.
3. **Admin-matrix edits reach the auth pipeline.** Checking or unchecking a permission box for a teamspace role in Einstellungen → Rollen & Rechte now updates the permission set returned by `/auth/context` for affected users. Previously the write was silently dropped (the UI saved it into a table no consumer read). After the migration (see below), the current frontend-visible state becomes the effective state — if a tenant had unchecked all boxes for a role, those users go from "migration defaults" to zero permissions on first auth after deploy.
4. **Bug fix — Global-Meldungs-Verwaltung "Konfigurieren"-Button** (`global-submissions-verwaltung-page`): previously shown to any teamspace admin, but the button routes to a `tenantAdmin`-guarded page, so non-tenant-admins were redirected away. The button is now gated by tenant-admin access, matching the destination route's guard.

## Acceptance Criteria

- [ ] A user in a custom teamspace role whose permissions include `news.create` sees the news-editor quick-link in the teamspace overview.
- [ ] A user whose `bearbeiter` role has been stripped of `submissions.view_scoped` no longer sees the submissions-management button or the open-submissions sidebar badge.
- [ ] The `/teamspace/submissions/verwaltung` "Konfigurieren"-Button is visible only to users with `admin.access` (tenant-admin path), not to teamspace admins.
- [ ] Navigation-level guards (`teamspaceAdminGuard`, `teamspaceAdminOnlyGuard`, `teamspaceEditorGuard`) accept/reject based on permission presence in at least one teamspace, not on role names.
- [ ] The `/auth/context` response remains the single source of truth; `GET /teamspaces/user/roles-summary` is removed.
- [ ] `grep -rn "TEAMSPACE_ROLES\\." apps/tagea-backend/src` returns only seed / assignment-default / permission-map references — no authorization comparisons.
- [ ] No frontend file references `hasAdminRole`, `hasBearbeiterRole`, `hasAdminOrRedakteurRole`, `hasAdminOrRedakteurRoleInTeamspace`.
- [ ] `PUT /teamspaces/permissions/roles` (unchecking every permission for a role) results in the affected user's `/auth/context` returning `teamspaces[tsId].permissions = []` for that role.
- [ ] `TeamspacePermissionsService` no longer imports `TeamspacePermission` / `TeamspaceRolePermission` entities; all five public methods operate on `Permission` + `RolePermission` filtered by `resource LIKE 'ts.%'`.
- [ ] The sync migration runs idempotently: on first execution, each tenant's `role_permissions` rows for ts.* permissions match the tenant's `teamspace_role_permissions` contents for the corresponding role; on a second execution it is a no-op.

## Permission Mapping (Role-name check → Permission check)

| Frontend location | Previous check | New check (against teamspace permissions from `AuthorizationStore`) |
|---|---|---|
| `secure-main.component.ts` — `loadOpenSubmissionsCount` gate (×3 call sites) | `hasAdminRole ∨ hasBearbeiterRole` | `hasAnyTeamspacePermissionOf(['submissions.view_all','submissions.view_scoped'])` |
| `teamspace-v2-page.component.ts` — News quick-link | `hasAdminOrRedakteurRole` | `hasAnyTeamspacePermissionOf(['news.create','news.edit'])` |
| `knowledge-base-page.component.ts` — `hasKnowledgeManagePermission` | `hasAdminOrRedakteurRole` | `hasAnyTeamspacePermissionOf(['news.create','news.edit'])` |
| `news-page.component.ts` — `hasRedaktionPermission` | `hasAdminOrRedakteurRole` | `hasAnyTeamspacePermissionOf(['news.create','news.edit'])` |
| `events-page.component.ts` — `hasEventManagePermission` | `hasAdminOrRedakteurRole` | `hasAnyTeamspacePermission('events.create')` |
| `termine-page.component.ts` — `hasAvailabilityConfigPermission` | `hasAdminRole` | `hasAnyTeamspacePermission('bookings.manage')` |
| `teamspace-submissions-page.component.ts` — `hasVerwaltungPermission` | `hasAdminRole ∨ hasBearbeiterRole` | `hasAnyTeamspacePermissionOf(['submissions.view_all','submissions.view_scoped'])` |
| `global-submissions-verwaltung-page.component.ts` — `canConfigureSubmissions` | `isSuperAdmin ∨ hasAdminRole` (Teamspace) | `isSuperAdmin ∨ isTenantAdmin` *(bug fix)* |
| `shared-event-detail.component.ts` — `canManageParticipants` | `hasAdminOrRedakteurRoleInTeamspace(tsId)` | `hasTeamspacePermission(tsId, 'events.create')` |
| `teamspace-admin.guard.ts` | `hasAdminRole ∨ hasBearbeiterRole` | `hasAnyTeamspacePermissionOf(['submissions.view_all','submissions.view_scoped'])` |
| `teamspace-admin-only.guard.ts` | `hasAdminRole` | `hasAnyTeamspacePermission('bookings.manage')` |
| `teamspace-editor.guard.ts` | `hasAdminOrRedakteurRole` | `hasAnyTeamspacePermissionOf(['news.create','news.edit'])` |

SuperAdmin short-circuits are preserved everywhere they exist today.

## Backend cleanup

| Location | Action |
|---|---|
| `submissions/services/submissions.service.ts:1342` | Remove dead-code role-name check (`teamspace_role === TEAMSPACE_ROLES.REDAKTEUR continue`) — the immediately-following permission check already excludes Redakteur. |
| `articles/articles.service.ts:727` | Replace `getEditableTeamspacesForUser(employeeId)` with `getTeamspacesWithPermissions(employeeId, ['news.create','news.edit'])`. |
| `teamspaces/services/teamspace-employee-assignments.service.ts:334-371, 411-439` | Delete `hasAdminOrRedakteurRoleInAnyTeamspace`, `hasAdminRoleInAnyTeamspace`, `hasBearbeiterRoleInAnyTeamspace`, `getEditableTeamspacesForUser`. |
| `teamspaces/teamspaces.controller.ts:113-156` | Delete `GET /teamspaces/user/roles-summary` endpoint. |
| `teamspaces/dto/user-teamspace-roles-summary.dto.ts` | Delete DTO. |
| `teamspaces/constants/teamspace-roles.constants.ts:27-68` | Delete `TEAMSPACE_ROLE_HIERARCHY`, `hasTeamspaceRole`, `getStandardTeamspaceRoles`, `isValidStandardRole`. The `TEAMSPACE_ROLES` constant itself stays (used by assignment defaults and `DEFAULT_TEAMSPACE_ROLE_PERMISSIONS`). |
| `teamspaces/services/teamspace-permissions.service.ts` | Rewire all 5 methods to read/write `permissions` + `role_permissions`, filtered by `resource LIKE 'ts.%'`. Drop `TeamspacePermission` / `TeamspaceRolePermission` entity imports. `getPermissionsByRole` / `getRolePermissions` query `role_permissions` by `role_id`; `updateRolePermissions` deletes ts.* rows for that role and reinserts; `resetToDefaults` uses `DEFAULT_TEAMSPACE_ROLE_PERMISSIONS` against the central tables. |
| Tenant migration — sync pass (option "legacy wins") | For each tenant DB: `DELETE FROM role_permissions WHERE role_id IN (<ts role ids>) AND permission_id IN (SELECT id FROM permissions WHERE resource LIKE 'ts.%')`, then reinsert from `teamspace_role_permissions` joined on permission name. Idempotent; re-runs collapse to no-ops. |

## Frontend cleanup

| Location | Action |
|---|---|
| `services/teamspace.service.ts:29-122` | Delete `_rolesSummary`, `hasAdminOrRedakteurRole`, `hasAdminRole`, `hasBearbeiterRole`, `teamspaceRoles`, `rolesSummaryLoaded`, `loadUserRolesSummary`, `refreshUserRolesSummary`, `clearRolesSummary`, `hasAdminOrRedakteurRoleInTeamspace`. |
| `models/teamspace.model.ts` | Delete `UserTeamspaceRolesSummary` interface. |
| `services/authorization-store.service.ts` | Add `hasTeamspacePermission`, `hasAnyTeamspacePermission`, `hasAnyTeamspacePermissionOf`. |

## Non-Goals

- No changes to role-assignment flows (adding/removing a user to a teamspace, choosing a default role).
- **Legacy tables `teamspace_role_permissions` / `teamspace_permissions` are not dropped in this work.** After this change they are effectively write-only relics from the pre-merge era: the sync migration copies their current contents forward once, and nothing reads or writes them afterwards. A follow-up migration can drop them after one release cycle confirms no stragglers.
- No changes to the `/auth/context` response shape — the frontend just starts consuming the `teamspaces` section that already exists.
- No changes to institution-level RBAC (this spec is teamspace-scoped).

## Edge Cases

- **User without any teamspace assignment:** all `hasAnyTeamspacePermission*` return false; all gates closed. SuperAdmin/TenantAdmin gates still open where applicable.
- **User with multiple teamspace assignments:** `hasAnyTeamspacePermission(p)` returns true if *any* assignment grants `p`. `hasTeamspacePermission(tsId, p)` checks the specific teamspace only.
- **`/auth/context` not yet loaded:** callers must `await authorizationStore.isLoaded()` before making navigation/visibility decisions. The three teamspace guards already await `authorizationStore.isLoaded()` via `waitForCondition`.
- **Tenant strips all permissions from a role:** user sees no teamspace features — intended behavior.

## References

- **Prior RBAC work:** `memory/rbac-refactoring-plan.md` (Phases 0–4 complete)
- **Backend permission model:** `apps/tagea-backend/src/teamspaces/constants/teamspace-permissions.constants.ts`, `apps/tagea-backend/src/teamspaces/constants/default-teamspace-role-permissions.ts`
- **Backend auth pipeline:** `apps/tagea-backend/src/auth/authorization/permission-resolver.service.ts`, `apps/tagea-backend/src/auth/authorization/teamspace-auth-loader.service.ts`
- **Frontend context source:** `apps/tagea-frontend/src/app/services/authorization-store.service.ts`
