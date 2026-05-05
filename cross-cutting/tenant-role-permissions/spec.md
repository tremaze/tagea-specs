# Cross-Cutting: Tenant Role Permissions

> **Status:** ✅ Specified
> **Owner:** baumgart
> **Last updated:** 2026-04-30

## Vision (Elevator Pitch)

Above the institution shells lives the tenant **administration shell** at `/administration`. It is the place where Trägeradmins manage the entire tenant — institutions, employees across all institutions, integrations, security, audit logs. Access is gated by a single surface permission, `tenant.administration.access`, plus an `is_tenant_admin` boolean flag on the user that bypasses every per-permission check. Four personas exercise the matrix that decides who sees what: **Trägeradmin** (the bypass path), **Träger-Manager** (the perm-resolver path with full tenant.* perms), **Personalverwalter** (HR-only subset), and **Mitarbeiter** (the floor — no admin shell access at all). This spec freezes that matrix.

## Persona Roster

The four tenant personas live in `apps/tagea-frontend-e2e/src/fixtures/personas.ts`. Their institution-scope role varies (Trägeradmin and Träger-Manager are also assigned as institution-`admin`s so they pass the "user must belong to at least one institution" check), but the differentiation here happens at tenant scope.

| Persona              | `tenantRole`        | `is_tenant_admin` | `institutionRole` (assigned for app-access check) |
| -------------------- | ------------------- | ----------------- | ------------------------------------------------- |
| Trägeradmin          | `mitarbeiter`       | ✅                 | `admin`                                            |
| Träger-Manager       | `traeger_manager`   | ❌                 | `admin`                                            |
| Personalverwalter    | `personalverwalter` | ❌                 | (none — institutionScoped: false)                  |
| Mitarbeiter          | `mitarbeiter`       | ❌                 | `counselor` (institution access only)              |

The two paths to admin-shell access are intentionally separate:

- **Bypass path** (Trägeradmin): `is_tenant_admin = true` short-circuits the permission resolver — every tenant.*-permission check returns true regardless of the role assignment. Trägeradmin's tenant role is `mitarbeiter` (the base role), proving the bypass is what grants admin access, not the role.
- **Perm-resolver path** (Träger-Manager): No bypass; the `traeger_manager` tenant role carries every `tenant.*` permission listed in `default-role-permissions.ts`. UI behaves identically to Trägeradmin, but the gate is the role's permission set, not a flag.

The two paths must stay in sync. If a new tenant.*-permission is introduced, the bypass automatically covers it (it short-circuits all checks), but the `traeger_manager` role mapping must be updated explicitly. The split exists so that when a new tenant.* is added without updating the role, only Träger-Manager loses access and the bypass-only spec catches the omission.

## Surface Gates

Two checks decide what each persona sees of the tenant administration:

1. **`tenant.administration.access`** — gate to the entire `/administration` shell. Without it (and without `is_tenant_admin`/`is_super_admin` bypass), every admin sub-route redirects out. Träger-Manager and Personalverwalter hold this; Mitarbeiter does not.

2. **`is_tenant_admin = true`** — bypass that grants every tenant.* permission, including `tenant.administration.access`, regardless of which role is assigned. Only Trägeradmin holds this in the persona roster.

A third gate — `is_super_admin = true` — is reserved for super-admin operations across tenants (e.g. the "Erlaubte Domains" entry). None of the four tenant personas hold it.

## Admin-Shell Sidebar Matrix

The admin sidebar at `nav.admin-nav` lists 20 items in fixed order. The order matches `apps/tagea-frontend/src/app/pages/administration/administration-shell.component.ts`. Visibility per persona:

| Sidebar item             | Required permission (or flag)                | Trägeradmin | Träger-Manager | Personalverwalter | Mitarbeiter |
| ------------------------ | -------------------------------------------- | ----------- | -------------- | ----------------- | ----------- |
| Einrichtungen            | `tenant.institutions.view`                   | ✅           | ✅              | ❌                 | ❌           |
| Teamspaces               | `tenant.teamspaces.view`                     | ✅           | ✅              | ❌                 | ❌           |
| Tätigkeiten              | `tenant.activities.view`                     | ✅           | ✅              | ❌                 | ❌           |
| Mitarbeitende            | `tenant.employees.list`                      | ✅           | ✅              | ✅                 | ❌           |
| Klient*innen             | `tenant.clients.view`                        | ✅           | ✅              | ❌                 | ❌           |
| Rollen & Rechte          | `tenant.roles.view`                          | ✅           | ✅              | ❌                 | ❌           |
| Terminvorlagen           | `tenant.appointment_templates.view`          | ✅           | ✅              | ❌                 | ❌           |
| Berichtsvorlagen         | `tenant.client_report_templates.view`        | ✅           | ✅              | ❌                 | ❌           |
| Teamspace Meldungen      | `tenant.submission_categories.view`          | ✅           | ✅              | ❌                 | ❌           |
| Vivendi                  | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| Microsoft 365            | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| Azure AD Sync            | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| DATEV                    | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| Tagea AI                 | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| Externe Inhalte          | `tenant.integrations.manage`                 | ✅           | ✅              | ❌                 | ❌           |
| Schulungsverwaltung      | `tenant.integrations.manage` + feature flag  | ✅           | ✅              | ❌                 | ❌           |
| Willkommensseite         | `tenant.integrations.manage`                 | ✅           | ✅              | ❌                 | ❌           |
| Sicherheit               | `tenant.security.view`                       | ✅           | ✅              | ❌                 | ❌           |
| Anmeldeprotokolle        | `tenant.audit.login_log.view`                | ✅           | ✅              | ❌                 | ❌           |
| Erlaubte Domains         | `is_super_admin`                             | ❌           | ❌              | ❌                 | ❌           |

Three rules apply across the matrix:

- **Bypass and perm-resolver are equivalent for the visible columns.** Trägeradmin and Träger-Manager show identical visibility — the bypass and the role permissions cover the same items.
- **Mitarbeiter is fully redirected.** They never reach the shell; the sidebar matrix doesn't apply because the entry guard blocks them at `/administration` itself. They get bounced back to the dashboard.
- **Personalverwalter sees one item only.** The HR persona holds `tenant.administration.access` (so they pass the surface gate) plus `tenant.employees.list/view/create/edit` and `tenant.employees.assignments.manage` — exactly the permissions needed to see and operate the Mitarbeitende sub-area. They do NOT hold `tenant.institutions.view` or `tenant.roles.view`; the picker flows that depend on those use endpoints with `anyOf: [TENANT_ROLES_VIEW, TENANT_EMPLOYEES_EDIT]`-style fallbacks so Personalverwalter can still drive the dialog.

## Personalverwalter Action-Level Permissions

Personalverwalter is unique among the four personas in that they reach a sub-area but with restricted actions. Within `/administration/nutzer/mitarbeitende`:

| Action                | Required permission             | Visible for Personalverwalter |
| --------------------- | ------------------------------- | ----------------------------- |
| Neuer Mitarbeiter (top button) | `tenant.employees.create` | ✅ |
| Bearbeiten (row menu) | `tenant.employees.edit`         | ✅                             |
| Löschen (row menu)    | `tenant.employees.delete`       | ❌ (not held)                  |

This is the canonical example of action-level filtering after a persona has cleared the route guard. Tests assert each individually.

## Acceptance Criteria

- [ ] **Given** Trägeradmin **When** they enter `/administration` **Then** every non-super-admin sidebar item (19 items) is visible.
- [ ] **Given** Trägeradmin **When** they navigate to `/administration/sicherheit/sicherheit` **Then** the page loads, even though the assigned tenant role (`mitarbeiter`) does not grant `tenant.security.view` — the bypass path covers it.
- [ ] **Given** Träger-Manager **When** they enter `/administration` **Then** the sidebar matches Trägeradmin (19 items) AND the underlying check is the perm-resolver path (their tenant role carries every tenant.* permission).
- [ ] **Given** Personalverwalter **When** they enter `/administration` **Then** only "Mitarbeitende" is visible in the sidebar; every other tenant-area item is hidden.
- [ ] **Given** Personalverwalter **When** they reach `/administration/nutzer/mitarbeitende` **Then** the "Neuer Mitarbeiter" button is visible and the row menu shows "Bearbeiten" but NOT "Löschen".
- [ ] **Given** Personalverwalter **When** they navigate to a non-HR admin sub-route (e.g. `/administration/organisation/einrichtungen`) **Then** the route guard redirects them away.
- [ ] **Given** Mitarbeiter **When** they navigate to `/administration` (root) **Then** the surface guard redirects them away — they never see the admin shell at all.
- [ ] **Given** Mitarbeiter **When** they navigate to any `/administration/<sub>/<page>` route **Then** the route guard redirects them away.
- [ ] **Given** the `is_tenant_admin` flag is removed from a user **And** their tenant role is `mitarbeiter` **Then** their admin-shell access disappears entirely (proves the bypass is the gate, not the role).
- [ ] **Given** a new `tenant.*` permission is introduced and added only to controllers (not to `traeger_manager` role) **When** Träger-Manager visits the new endpoint **Then** they get 403 — distinct from Trägeradmin who passes via bypass. This is the asymmetry the two-persona split is designed to detect.

## Non-Goals

- **Institution-scope role matrix.** Lives in `cross-cutting/institution-role-permissions/spec.md` (Einrichtungsadmin, Manager, Supervisor, Berater at the `/einrichtung/:id/...` and `/einstellungen/einrichtung/:id/...` shells).
- **Backend endpoint coverage.** Every `@Auth({ scope: 'tenant', permissions: [...] })` decorator and the corresponding sidebar/per-action permission is verified in the backend audit spec (`admin-permissions-config.audit.spec.ts`). UI specs only assert UI-visible behavior.
- **Permission framework itself.** How `is_tenant_admin` is set on `auth_user_tenant`, how role-permissions are resolved, how the bypass short-circuits the resolver — see `cross-cutting/routing-and-guards/` and the auth-guard implementation.
- **Super-admin features.** "Erlaubte Domains" is the one super-admin-only sidebar item. None of the four tenant personas exercise the super-admin path; super-admin coverage lives elsewhere.

## Edge Cases

- **`is_tenant_admin` user with no role assignments.** Allowed in principle (the bypass covers everything), but the app gates app access on the user being assigned to at least one institution. The persona roster therefore assigns Trägeradmin as institution-`admin` — without that, the user would be redirected to a "select an institution" screen even though their tenant rights are unlimited.
- **Tenant role with overlapping institution role.** A user who is both Personalverwalter (tenant) and Berater (institution) sees the union: the HR-restricted admin shell + the full institution work shell. Surface gates compose, not collide.
- **Permission added only to bypass.** Theoretically possible but undesirable: a `tenant.*` permission with no role mapping. Bypass covers it, but anyone using the perm-resolver path (Träger-Manager) loses access. Tests catch this asymmetry by exercising both paths against the same set of UI items.
- **`is_tenant_admin = true` AND tenant role with full perms.** Both gates pass; behavior is identical to either path alone. The two persona split exists to surface inconsistencies, not because the production app distinguishes between users with both vs only one.
- **Feature-flagged sidebar items.** Vivendi, Microsoft 365, Azure AD Sync, DATEV, Tagea AI, and Schulungsverwaltung are all integration items gated by feature flags AND `tenant.integrations.manage`. Tests run with the E2E sandbox seed where flags are on; if a flag is off, the item disappears for everyone — matrix above assumes the flag is on.

## References

**Personas + tenant factory:**

- `apps/tagea-frontend-e2e/src/fixtures/personas.ts` — `PERSONA_CONFIG` for the four tenant personas + ROLE_IDS
- `apps/tagea-frontend-e2e/src/utils/factories/tenant-factory.ts` — provisioning, `is_tenant_admin` flag setting

**Default role-permission mapping:**

- `apps/tagea-backend/src/permissions/default-role-permissions.ts` — `traeger_manager`, `personalverwalter`, `mitarbeiter` mappings
- The `traeger_manager` mapping is intentionally a superset of every `tenant.*` permission (perm-resolver path equivalence to bypass).

**Surface gate definitions + bypass:**

- `packages/permissions/src/lib/permissions.ts` — `EMPLOYEE_PERMISSIONS.TENANT_ADMINISTRATION_ACCESS`, `TENANT_ADMIN`
- `apps/tagea-backend/src/auth/authorization/permission-resolver.service.ts` — `is_tenant_admin` short-circuit
- `apps/tagea-frontend/src/app/pages/administration/administration-shell.component.ts` — `nav.admin-nav` source of the sidebar matrix

**E2E specs that enforce this contract:**

- `apps/tagea-frontend-e2e/src/tests/admin-permissions/tenant-admin.spec.ts` — Trägeradmin (bypass path)
- `apps/tagea-frontend-e2e/src/tests/admin-permissions/traeger-manager.spec.ts` — Träger-Manager (perm-resolver path)
- `apps/tagea-frontend-e2e/src/tests/admin-permissions/personalverwalter.spec.ts` — HR-only subset + per-action visibility
- `apps/tagea-frontend-e2e/src/tests/admin-permissions/mitarbeiter.spec.ts` — full redirect (no admin shell)

**Backend audit spec for endpoint coverage:**

- `apps/tagea-frontend-e2e/src/tests/admin-permissions/admin-permissions-config.audit.spec.ts` — verifies every `@Auth({ scope: 'tenant', ... })` decorator's permission set against the sidebar matrix (file referenced in the persona spec headers; check actual location).

**Related cross-cutting specs:**

- `cross-cutting/institution-role-permissions/spec.md` — sibling for the institution-scope persona matrix
- `cross-cutting/entity-permissions/spec.md` — per-entity action permissions on detail responses
- `cross-cutting/routing-and-guards/spec.md` — guard hierarchy that enforces the surface gate
- `cross-cutting/frontend-service-surfaces/spec.md` — service-side surface decomposition; tenant route prefix is `/tenant/...` and admin endpoints sit under `/administration/...` (`scope: 'tenant-admin'`)
