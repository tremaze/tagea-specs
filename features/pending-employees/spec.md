# Feature: Pending Employees

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Admin approval page at `/pending-employees`. Shows the tenant-wide queue of newly-registered employees awaiting approval, with an approval dialog that lets the admin confirm institution / role before activating the account, or reject the registration outright.

## User Stories

- As an **admin** I want to review newly-registered employees, so that I can vet them before granting access.
- As an **admin** I want one-click Approve / Reject in a dialog, so that the queue moves fast.

## Acceptance Criteria

- [ ] **Given** the page loads, **When** `EmployeesService.getPendingEmployees()` resolves, **Then** pending employees render in a sortable `MatTable` with name, email, institution and registered date (`createdAt`). Clicking a row opens the approval dialog.
- [ ] **Given** the user clicks a row, **When** the action fires, **Then** `EmployeeApprovalDialogComponent` opens — the admin can change the preselected institution and pick a role (`admin | manager | supervisor | counselor`, default `counselor`) before confirming.
- [ ] **Given** the dialog's Freigeben button resolves with `{ action: 'approved' }`, **When** `EmployeesService.approveEmployee(id, options)` succeeds, **Then** the employee leaves the pending queue and the table updates.
- [ ] **Given** the dialog's Ablehnen button resolves with `{ action: 'rejected' }`, **When** `EmployeesService.rejectEmployee(id)` succeeds, **Then** the employee is removed from the queue.
- [ ] **Given** the dialog's Abbrechen button resolves with `{ action: 'cancelled' }`, **When** closed, **Then** the queue is left unchanged.
- [ ] **Given** search input changes, **When** the user types, **Then** the table filters client-side by `firstName`, `lastName`, `email` (case-insensitive substring match).

## UI States

| State           | When?           | Rendering                                                   |
| --------------- | --------------- | ----------------------------------------------------------- |
| Loading         | Initial fetch   | `mat-spinner` centered                                      |
| Empty (global)  | No pending      | "Keine ausstehenden Registrierungen" empty state            |
| Empty (search)  | Filter no hits  | "Keine Treffer" with Alle anzeigen button                   |
| Populated       | Entries visible | Search field + sortable `MatTable` (`mat-sort-header`)      |
| Approval dialog | Dialog open     | Institution + role picker, Abbrechen / Ablehnen / Freigeben |
| Error (dialog)  | Approve/reject  | Inline error message from `err.error?.message`              |

## Non-Goals

- **Bulk approval** — not implemented.
- **Auto-approval rules** — backend concern.
- **Rejection confirmation prompt** — reject is one click inside the dialog.

## Edge Cases

- **Concurrent admins approving the same employee** — backend rejects the duplicate; UI surfaces the error inline in the dialog.
- **Pending employee list regularly empty** — this page is not entered by default; expected to be empty most of the time. A badge count in the nav (`getPendingEmployeesCount()`) draws attention when non-zero.
- **Scope-based filtering** — backend filters the pending list by institutions the caller has `employees.edit` access to (via `AccessScopeService`).

## Permissions & Tenant/Institution

- **Route guard:** `permissionGuard` with `data: { requiredPermission: 'employees.edit' }`.
- **Backend auth:** `@Auth({ scope: 'tenant', permissions: [PERMISSIONS.EMPLOYEES_EDIT] })` on all three endpoints.
- **Institution context:** None — the page is tenant-scoped (`/pending-employees`, not under `/einrichtung/:id`). The backend filters results by the caller's accessible institutions.

## Notifications (Push / In-App)

- New pending registrations could trigger admin push notifications — verify with backend config.

## i18n Keys

> User-facing strings remain in German.

- Page title/subtitle and dialog labels are hardcoded German in the component templates (no Transloco keys for this page yet).

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Angular page:** [`apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts)
- **Approval dialog:** [`employee-approval-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/employee-approval-dialog.component.ts)
- **Service:** `EmployeesService` (`apps/tagea-frontend/src/app/services/employees.service.ts`)
- **Model:** `PendingEmployee`, `ApproveEmployeeOptions`, `EMPLOYEE_ROLES` (`apps/tagea-frontend/src/app/models/employee.model.ts`)
- **Backend controller:** `TenantEmployeesController` (`apps/tagea-backend/src/users/controllers/tenant-employees.controller.ts`)
- **Backend endpoints:** see [contracts.md](./contracts.md)
