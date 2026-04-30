# Cross-Cutting: Institution Role Permissions

> **Status:** ✅ Specified
> **Owner:** baumgart
> **Last updated:** 2026-04-30

## Vision (Elevator Pitch)

Every employee that gets work done inside an institution operates under one of four institution-scope roles: **Admin**, **Manager**, **Supervisor**, or **Counselor (Berater)**. The roles form a strict capability ladder around two surfaces — the institution **work shell** (`/einrichtung/:institutionId/...`) and the institution **settings shell** (`/einstellungen/einrichtung/:institutionId/...`). The settings shell is gated by a single surface permission, `institution.administration.access`; only Admin and Manager hold it. Within the settings shell, individual sub-tabs are filtered by per-resource permissions (e.g. `institution.roles.manage` for the Rollen-Rechte tab). This spec freezes the contract that every E2E and security test currently asserts.

## Persona Roster

The four personas live in `apps/tagea-frontend-e2e/src/fixtures/personas.ts` and are seeded by the tenant factory. Their tenant-scope role is always `mitarbeiter` (the base role) — the differentiation happens at institution scope.

| Persona                 | `institutionRole` | `tenantRole`   | Holds `institution.administration.access` | Holds `institution.roles.manage` | Holds `institution.employees.view` |
| ----------------------- | ----------------- | -------------- | ----------------------------------------- | -------------------------------- | ---------------------------------- |
| Einrichtungsadmin       | `admin`           | `mitarbeiter`  | ✅                                         | ✅                                | ✅                                  |
| Einrichtungsmanager     | `manager`         | `mitarbeiter`  | ✅                                         | ❌                                | ✅                                  |
| Einrichtungssupervisor  | `supervisor`      | `mitarbeiter`  | ❌                                         | ❌                                | ✅                                  |
| Einrichtungsberater     | `counselor`       | `mitarbeiter`  | ❌                                         | ❌                                | ❌                                  |

Default permission lists per role live in `apps/tagea-backend/src/permissions/default-role-permissions.ts`. The three columns above are the differentiators that drive UI visibility; the full list per role contains 30–60 permissions covering CRUD on appointments, cases, clients, reports, etc.

## Surface Gates

Two top-level checks decide what each persona sees of the institution surfaces:

1. **`institution.administration.access`** — gate to the *settings shell* (`/einstellungen/einrichtung/:institutionId/...`). Without it, every settings sub-route redirects out (typically back to the institution dashboard) and the "Einstellungen" link disappears from the work-shell top-nav.

2. **`institution.access`** (held by all four roles via `default-role-permissions.ts`) — gate to the *work shell* (`/einrichtung/:institutionId/...`). All four institution personas pass this gate; the differentiation between them happens at the per-page level (e.g. `institution.employees.view` controls visibility of the work-shell Mitarbeitende entry).

## Settings-Shell Sidebar Matrix

The institution-settings sidebar at `nav.settings-nav` lists items in a single "Einrichtung" section. The order is fixed and matches the order in `apps/tagea-frontend/src/app/pages/einstellungen/einstellungen-page.component.ts`. Each cell is the visibility for the persona at the column head:

| Sub-tab            | Required permission                  | Admin | Manager | Supervisor | Berater |
| ------------------ | ------------------------------------ | ----- | ------- | ---------- | ------- |
| Klienten-Felder    | `institution.custom_fields.view`     | ✅     | ✅       | ❌          | ❌       |
| Terminvorlagen     | `institution.appointment_templates.view` | ✅ | ✅       | ❌          | ❌       |
| Sachmittel         | `institution.financial_support.view` | ✅     | ✅       | ❌          | ❌       |
| Fallverwaltung     | `institution.cases.view`             | ✅     | ✅       | ❌          | ❌       |
| Berichtsvorlagen   | `institution.client_report_templates.view` | ✅ | ✅      | ❌          | ❌       |
| Fachbereiche       | `institution.departments.view`       | ✅     | ✅       | ❌          | ❌       |
| Arbeitszeiten      | `institution.shift_templates.view`   | ✅     | ✅       | ❌          | ❌       |
| Einrichtungsdaten  | `institution.profile.view`           | ✅     | ✅       | ❌          | ❌       |
| Mitarbeitende      | `institution.employees.view`         | ✅     | ✅       | ❌          | ❌       |
| Rollen & Rechte    | `institution.roles.manage`           | ✅     | ❌       | ❌          | ❌       |

Three rules apply across the matrix:

- **Surface gate dominates resource permissions.** Supervisor and Berater are absent from every sub-tab even though they hold some of the per-resource permissions individually (e.g. Supervisor has `institution.cases.view`). The route guard that requires `institution.administration.access` redirects them before the sidebar's per-item filter ever runs.
- **Per-item filter for surface holders.** Admin and Manager pass the surface gate; their per-tab visibility is the AND of `institution.administration.access` and the row's required permission. Manager misses Rollen & Rechte specifically because they lack `institution.roles.manage`.
- **No "Allgemein" section for any institution persona.** The "Allgemein" (tenant-wide) section in the same shell requires tenant-scope permissions which none of the four institution personas hold.

## Work-Shell Top-Nav Matrix

The institution work shell's top-nav (rendered while `NavigationModeService.isEinrichtungMode()` is true) shows up to ten links. Visibility per persona:

| Top-nav item            | Required permission                  | Admin | Manager | Supervisor | Berater |
| ----------------------- | ------------------------------------ | ----- | ------- | ---------- | ------- |
| Dashboard               | `institution.dashboard.view`         | ✅     | ✅       | ✅          | ✅       |
| Kalender                | `institution.appointments.view`      | ✅     | ✅       | ✅          | ✅       |
| Aufgaben                | `institution.tasks.view_all` (or owns) | ✅   | ✅       | ✅          | ✅       |
| Klienten                | `institution.clients.view`           | ✅     | ✅       | ✅          | ✅       |
| Fälle                   | `institution.cases.view`             | ✅     | ✅       | ✅          | ✅       |
| Klienten-Informationen  | `institution.client_news.view`       | ✅     | ✅       | ✅          | ✅       |
| Mitarbeitende           | `institution.employees.view`         | ✅     | ✅       | ✅          | ❌       |
| Berichte                | `institution.reports.view`           | ✅     | ✅       | ✅          | ✅       |
| Wissensdatenbank        | feature flag + `institution.access`  | ✅     | ✅       | ✅          | ✅       |
| Einstellungen           | `institution.administration.access`  | ✅     | ✅       | ❌          | ❌       |

The two columns where the matrix splits are **Mitarbeitende** (Berater out — lacks `institution.employees.view`) and **Einstellungen** (Supervisor + Berater out — lack the surface gate). Everything else is uniform across all four institution personas.

## Mode-Switch Mechanics

`NavigationModeService` keys mode off the URL: any URL starting with `/einrichtung/` flips mode to `einrichtung`; any URL starting with `/teamspace` flips to `teamspace`. URLs starting with `/einstellungen/...` do **NOT** trigger mode detection, so a fresh login that lands on `/teamspace` keeps the empty teamspace top-nav even when the user navigates straight to a settings URL. Tests and humans switch by clicking the mode-toggle button (`button.mode-toggle-button[aria-label="Zu Einrichtung wechseln"]`) on the top bar.

## Acceptance Criteria

- [ ] **Given** Einrichtungsadmin **When** they enter the settings shell **Then** all 10 settings sub-tabs are visible in the "Einrichtung" section AND the "Allgemein" section is absent.
- [ ] **Given** Einrichtungsmanager **When** they enter the settings shell **Then** 9 sub-tabs are visible and the "Rollen & Rechte" entry is absent.
- [ ] **Given** Einrichtungsmanager **When** they navigate directly to `/einstellungen/einrichtung/:id/berechtigungsmatrix` **Then** the route guard redirects them away from that URL.
- [ ] **Given** Einrichtungssupervisor or Einrichtungsberater **When** they enter the settings shell via any sub-route **Then** the route guard redirects them out (lacks `institution.administration.access`).
- [ ] **Given** Einrichtungssupervisor or Einrichtungsberater **When** they look at the work-shell top-nav **Then** "Einstellungen" is absent.
- [ ] **Given** Einrichtungsberater **When** they look at the work-shell top-nav **Then** "Mitarbeitende" is also absent (lacks `institution.employees.view`).
- [ ] **Given** any institution persona **When** they navigate to `/administration` or `/einstellungen/traeger/*` **Then** the route guard redirects them away (no tenant-scope shell access for institution roles).
- [ ] **Given** the surface gate `institution.administration.access` is removed from a role **Then** the corresponding settings shell becomes inaccessible to that role and the "Einstellungen" top-nav entry disappears, regardless of which per-resource permissions the role still holds.

## Non-Goals

- **Tenant-scope role matrix.** Lives in `cross-cutting/tenant-role-permissions/spec.md` (Trägeradmin, Träger-Manager, Personalverwalter, Mitarbeiter at the `/administration` shell).
- **Permission framework itself.** How permissions are stored, granted via `role_permissions`, evaluated by the AuthGuard, and shipped to the frontend authorization context — covered by `cross-cutting/entity-permissions/` (per-entity hints) and the route-guard chain in `cross-cutting/routing-and-guards/`.
- **Action-level permissions inside a sub-tab.** Once a persona is on Mitarbeitende, *which buttons* they see (Erstellen, Bearbeiten, Löschen) is decided by per-action permissions. This spec only covers visibility of the navigation entry.
- **Backend endpoint coverage.** Every institution-scope `@Auth({ scope: 'institution', permissions: [...] })` mapping is enforced server-side; backend audit specs verify that contract directly.
- **Custom institution overrides.** Tenants can override role-permission assignments per institution via `institution_role_permission_overrides`. The base matrix above is the seed; overrides may grant or revoke individual permissions per institution. Tests use the un-overridden seed.

## Edge Cases

- **Persona has surface gate but no resource permissions.** Example: a future role that holds `institution.administration.access` but no `institution.*_view` perms. Expected behavior: settings shell loads (top-nav and route guard pass), but the sidebar renders an empty "Einrichtung" section. The page is reachable but useless. Surfacing this as an empty state is intentional; the alternative (hiding the entire shell) would surprise admins debugging a misconfigured role.
- **Persona has resource permission but no surface gate.** Example: Supervisor has `institution.cases.view` but lacks `institution.administration.access`. The /einstellungen/einrichtung/:id/fallverwaltung route still redirects them out. Per-item permissions are AND-combined with the surface gate.
- **Mode-switch race after login.** A persona who lands on `/teamspace` after login and immediately navigates to `/einstellungen/einrichtung/:id/...` will see an empty settings sidebar even if their role qualifies — `isEinrichtungMode()` is still false because the URL doesn't trigger detection. The fix is to click the mode-toggle button or visit any `/einrichtung/:id/...` URL first. Frontend code does not auto-flip on settings URLs.
- **Tenant-Admin shadow.** A user who is both tenant-admin (`is_tenant_admin = true`) and assigned as Berater to an institution gets the full settings shell via the bypass path. The four-row matrix above describes the *plain* institution roles; the `is_tenant_admin` flag is documented in the tenant spec.
- **Feature-disabled sub-tab.** Sub-tabs whose `requiredFeature` (e.g. `billing`, `caseManagement`, `clientReports`) is off for the tenant disappear from the sidebar even for Admin. The matrix assumes all features are on (the E2E sandbox seed enables them).

## References

**Personas + tenant factory:**

- `apps/tagea-frontend-e2e/src/fixtures/personas.ts` — `PERSONA_CONFIG` for the four institution personas + ROLE_IDS
- `apps/tagea-frontend-e2e/src/utils/factories/tenant-factory.ts` — provisioning + `defaultInstitutionId` exposure

**Default role-permission mapping:**

- `apps/tagea-backend/src/permissions/default-role-permissions.ts`
  - `EmployeeRole.ADMIN` (line 153 onward)
  - `EmployeeRole.MANAGER` (line 84 onward)
  - `EmployeeRole.SUPERVISOR` (line 43 onward)
  - `EmployeeRole.COUNSELOR` (line 5 onward)

**Surface gate definition + sidebar source:**

- `packages/permissions/src/lib/permissions.ts` — `EMPLOYEE_PERMISSIONS.INSTITUTION_ADMINISTRATION_ACCESS` constant
- `apps/tagea-frontend/src/app/pages/einstellungen/einstellungen-page.component.ts` — `allMenuItems[]` is the source of the matrix
- `apps/tagea-frontend/src/app/services/navigation-mode.service.ts` — URL-based mode detection

**E2E specs that enforce this contract:**

- `apps/tagea-frontend-e2e/src/tests/institution-permissions/einrichtungs-admin.spec.ts`
- `apps/tagea-frontend-e2e/src/tests/institution-permissions/einrichtungs-manager.spec.ts`
- `apps/tagea-frontend-e2e/src/tests/institution-permissions/einrichtungs-supervisor.spec.ts`
- `apps/tagea-frontend-e2e/src/tests/institution-permissions/einrichtungs-berater.spec.ts`
- `apps/tagea-frontend-e2e/src/tests/institution-permissions/_helpers.ts` — shared label/route constants

**Related cross-cutting specs:**

- `cross-cutting/tenant-role-permissions/spec.md` — sibling for the tenant-scope persona matrix
- `cross-cutting/entity-permissions/spec.md` — per-entity action permissions on detail responses
- `cross-cutting/routing-and-guards/spec.md` — guard hierarchy that enforces the surface gate
- `cross-cutting/frontend-service-surfaces/spec.md` — service-side surface decomposition; institution route prefix is `/institutions/:institutionId/...`
