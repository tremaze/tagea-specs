# Feature: Employees List

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff-facing employees list at `/einrichtung/:institutionId/employees`. Filterable/searchable table (desktop) / cards (mobile) showing name, role (`EMPLOYEE_ROLES`), status (`EMPLOYEE_STATUS`), and quick actions (edit/delete via dialogs).

## User Stories

- As an **admin** I want to see all employees in my institution, so that I can manage staff.
- As an **admin** I want to add, edit, and delete employees, so that onboarding and offboarding are one-step.
- As an **admin** I want role- and status-filtering, so that I can triage quickly.

## Acceptance Criteria

### List

- [ ] **Given** the page loads, **When** `EmployeesService` resolves, **Then** employees render as rows/cards with name + role chip + status chip + color (via `getEmployeeColor`).
- [ ] **Given** auto-load logic, **When** the count reaches `MAX_AUTO_LOAD = 300` with `BATCH_SIZE = 30`, **Then** further pagination requires explicit user action (identical pattern to [cases](../cases/spec.md)).
- [ ] **Given** filters change (search / role / status), **When** debounce completes, **Then** the list reloads.
- [ ] **Given** the mobile filters FAB fires, **When** opened, **Then** `EmployeesFiltersBottomSheetComponent` renders.
- [ ] **Given** the user presses "New employee" / "Edit", **When** action fires, **Then** `EmployeeDialogComponent` opens in create/edit mode.
- [ ] **Given** the user chooses delete, **When** confirm resolves, **Then** `DeleteConfirmationDialogComponent` shows related entities and commits the delete.
- [ ] **Given** `employees.edit` is missing, **When** the row menu renders, **Then** the **edit** action is hidden via `*appHasPermission="'employees.edit'"`.
- [ ] **Given** `employees.delete` is missing, **When** the row menu renders, **Then** the **delete** action (and its preceding divider) is hidden via `*appHasPermission="'employees.delete'"`.

### EmployeeDialog: source-based field locking

- [ ] **Given** the dialog opens for an employee with `source === 'vivendi-sync'`, **Then** stammdaten fields (name, email, phone\*, date_of_birth, gender, personnel_number, external_reference) render as **disabled** with the Vivendi-managed hint.
- [ ] **Given** the user submits such a form, **When** `updateEmployee()` fires, **Then** the PATCH payload **omits** the locked fields — matching `EmployeeAbility.computeFieldPermissions`, which would reject them with 422.
- [ ] **Given** the employee has `source === 'azure-sync'`, **Then** only `phone_mobile`, `phone_landline`, `date_of_birth` are disabled and omitted from the payload.
- [ ] **Given** the employee has `source === 'manual'` (or undefined) in a Vivendi-enabled tenant, **Then** all stammdaten fields are editable — manually-created employees remain fully editable regardless of the tenant's sync configuration.
- [ ] **Given** the dialog opens in edit mode, **Then** the `status` select is always disabled — status changes flow through dedicated approve/reject/resendInvitation backend actions, not the PATCH endpoint.

### EmployeeDialog: Verlauf (Changelog) tab

- [ ] **Given** the dialog opens in `mode: 'edit'` AND the caller has `employees.edit`, **Then** the navigation shows a **Verlauf** tab with the `history` icon.
- [ ] **Given** the tab is opened for the first time, **When** the user clicks it, **Then** `EmployeesService.getEmployeeChangelog(id, 50, 0)` is called and the result renders as a chronologically descending timeline.
- [ ] **Given** a timeline entry has `source === 'user'`, **Then** the actor's name renders without an additional badge.
- [ ] **Given** a timeline entry has `source !== 'user'` (sync-originated), **Then** a `via Vivendi-Sync` / `via Azure-Sync` badge renders alongside the entry.
- [ ] **Given** a timeline entry has `actor === null`, **Then** the name "System" renders in place of the actor.
- [ ] **Given** an `employee`-scoped `updated` entry lists changed fields, **Then** each field renders with its German label and an `old → new` value pair (allowlist: `first_name`, `last_name`, `email`, `status`, `color`, `is_active`, `role`).
- [ ] **Given** a `status` change is rendered, **Then** enum values map to their localized labels (`active → Aktiv` etc.).
- [ ] **Given** an `institution_assignment` entry, **Then** the sentence renders as `Einrichtung "…" zugewiesen (Rolle: …)` for `created`, `Rolle in "…" von X auf Y geändert` for `updated` with both prev/new role names, or `Einrichtung "…" entfernt` for `deleted`.
- [ ] **Given** a `department_assignment` entry, **Then** the sentence renders as `Fachbereich "…" zugewiesen` or `Fachbereich "…" entfernt`.
- [ ] **Given** the backend returns exactly 50 entries, **Then** a `Weitere laden` button appears; pressing it appends the next page at `offset += 50`.
- [ ] **Given** the first load fails, **Then** a German error message renders with the `error_outline` icon.
- [ ] **Given** no entries exist yet for this employee, **Then** an empty state with `history` icon renders.

## UI States

| State             | When?                     | Rendering                        |
| ----------------- | ------------------------- | -------------------------------- |
| Loading           | Initial fetch             | Spinner                          |
| Empty             | No employees match        | Empty state + "New employee" CTA |
| Populated         | Rows/cards visible        | Search + filters + table/cards   |
| Auto-load ceiling | `length >= MAX_AUTO_LOAD` | "Load more" button               |
| Error             | Fetch failure             | Error panel + retry              |

## Non-Goals

- **Employee-profile detail** — that's `/employee-profile` (separate spec).
- **Bulk-assign institution** — not implemented.
- **Direct status editing** — `status` is display-only in the dialog; changes flow through approve/reject/resendInvitation.
- **User-initiated `source` flipping** — `source` is owned by the backend (vivendi-auto-onboarding sets it on create/link; Azure-sync flips it on personnel_number changes via `refreshEmployeeFromVivendi`).
- **Historical changelog entries from before feature rollout** — the timeline only shows changes recorded by the Postgres `track_entity_changelog` trigger after the migration ran.

## Edge Cases

- `EMPLOYEE_ROLES` and `EMPLOYEE_STATUS` are const enums exported from `employee.model.ts`; the role chip / status chip color map mirrors them exactly.
- **Soft-delete** — `DeleteConfirmationDialogComponent` surfaces related-entity counts; backend enforces cascade rules.
- **Source field is optional on the client type** — `employee.source` may be `undefined` for pre-migration rows or if the admin API returns a lean row that omits it. The dialog treats `undefined` as `manual` (fully editable). The backend is authoritative; if locking is bypassed client-side, the backend's Ability still blocks the mutation.
- **Vivendi-managed employee loses Vivendi link** — if an admin manually clears `external_reference` via some future admin surface, the backend would still leave `source === 'vivendi-sync'` (source is separate). Clients rely on `source`, not on `external_reference`-presence, for locking decisions.
- **Azure-sync flip** — when `AzureSyncService.refreshEmployeeFromVivendi` runs for a `manual` employee whose Graph profile now has a valid `employeeId` matching a Vivendi Mitarbeiter, the backend flips `source` to `vivendi-sync` in the same transaction. The next dialog open reflects the new locks.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'employees.view'` (route-level).
- **Edit gated by:** `employees.edit` via `*appHasPermission` (rendered on the edit menu item in `EmployeeCardComponent`).
- **Delete gated by:** `employees.delete` via `*appHasPermission` (separate permission from edit).
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Not a push target.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal for Flutter.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employees-page/employees-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/employees-page/employees-page.component.ts)
- **Admin cross-institution list:** [`apps/tagea-frontend/src/app/pages/administration/nutzer/admin-employees.component.ts`](../../../apps/tagea-frontend/src/app/pages/administration/nutzer/admin-employees.component.ts) — reuses `EmployeeDialogComponent` for edit/create.
- **Services:** `EmployeesService`, `UnifiedAuthService`, `TenantFeaturesService`
- **Models:** `Employee`, `EmployeeSource`, `EMPLOYEE_ROLES`, `EMPLOYEE_STATUS`, `EmployeeChangelogEntry`
- **Dialogs:** `EmployeeDialogComponent`, `DeleteConfirmationDialogComponent`
- **Timeline component:** [`EmployeeChangelogTimelineComponent`](../../../apps/tagea-frontend/src/app/components/employee-dialog/employee-changelog-timeline.component.ts)
- **Filter sheet:** `EmployeesFiltersBottomSheetComponent`
- **Card:** `EmployeeCardComponent`
- **Constants:** `BATCH_SIZE = 30`, `MAX_AUTO_LOAD = 300`, `CHANGELOG_PAGE_SIZE = 50`
- **Backend ability:** [`EmployeeAbility.computeFieldPermissions`](../../../apps/tagea-backend/src/users/abilities/employee.ability.ts) — source-based forbidden fields.
- **Backend changelog service:** [`EmployeeChangelogService.getTimeline`](../../../apps/tagea-backend/src/administration/services/employee-changelog.service.ts) — UNIONs direct-employee, institution-assignment, and department-assignment changelog rows.
- **Backend onboarding / sync:** [`VivendiAutoOnboardingService.refreshEmployeeFromVivendi`](../../../apps/tagea-backend/src/vivendi-sync/services/vivendi-auto-onboarding.service.ts) — reusable Vivendi-lookup+stammdaten-refresh called from both SSO-login and Azure-Sync cron.
- **Backend endpoints:** see [contracts.md](./contracts.md)
