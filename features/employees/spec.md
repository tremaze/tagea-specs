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

- [ ] **Given** the page loads, **When** `EmployeesService` resolves, **Then** employees render as rows/cards with name + role chip + status chip + color (via `getEmployeeColor`).
- [ ] **Given** auto-load logic, **When** the count reaches `MAX_AUTO_LOAD = 300` with `BATCH_SIZE = 30`, **Then** further pagination requires explicit user action (identical pattern to [cases](../cases/spec.md)).
- [ ] **Given** filters change (search / role / status), **When** debounce completes, **Then** the list reloads.
- [ ] **Given** the mobile filters FAB fires, **When** opened, **Then** `EmployeesFiltersBottomSheetComponent` renders.
- [ ] **Given** the user presses "New employee" / "Edit", **When** action fires, **Then** `EmployeeDialogComponent` opens in create/edit mode.
- [ ] **Given** the user chooses delete, **When** confirm resolves, **Then** `DeleteConfirmationDialogComponent` shows related entities and commits the delete.
- [ ] **Given** `employees.edit` is missing, **When** the row menu renders, **Then** the **edit** action is hidden via `*appHasPermission="'employees.edit'"`.
- [ ] **Given** `employees.delete` is missing, **When** the row menu renders, **Then** the **delete** action (and its preceding divider) is hidden via `*appHasPermission="'employees.delete'"`.

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

## Edge Cases

- `EMPLOYEE_ROLES` and `EMPLOYEE_STATUS` are const enums exported from `employee.model.ts`; the role chip / status chip color map mirrors them exactly.
- **Soft-delete** — `DeleteConfirmationDialogComponent` surfaces related-entity counts; backend enforces cascade rules.

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
- **Services:** `EmployeesService`, `UnifiedAuthService`
- **Models:** `Employee`, `EMPLOYEE_ROLES`, `EMPLOYEE_STATUS`
- **Dialogs:** `EmployeeDialogComponent`, `DeleteConfirmationDialogComponent`
- **Filter sheet:** `EmployeesFiltersBottomSheetComponent`
- **Card:** `EmployeeCardComponent`
- **Constants:** `BATCH_SIZE = 30`, `MAX_AUTO_LOAD = 300`
- **Backend endpoints:** see [contracts.md](./contracts.md)
