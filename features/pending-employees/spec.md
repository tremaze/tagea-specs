# Feature: Pending Employees

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Admin approval page at `/einrichtung/:institutionId/pending-employees`. Shows the queue of newly-registered employees awaiting approval, with an approval dialog that resolves institution / role assignment before activating the account.

## User Stories

- As an **admin** I want to review newly-registered employees, so that I can vet them before granting access.
- As an **admin** I want one-click approve / reject, so that the queue moves fast.

## Acceptance Criteria

- [ ] **Given** the page loads, **When** `EmployeesService.getPendingEmployees()` (or similar — verify) resolves, **Then** pending employees render in a sortable `MatTable` with name, email, registered date, and an "Approve" action.
- [ ] **Given** the user presses Approve, **When** action fires, **Then** `EmployeeApprovalDialogComponent` opens — the admin selects institutions + role before confirming.
- [ ] **Given** the dialog resolves with `EmployeeApprovalDialogResult`, **When** the backend approval call succeeds, **Then** the employee leaves the pending queue and the table updates.
- [ ] **Given** the user presses Reject (if implemented), **When** confirmed, **Then** the employee is removed from the queue.
- [ ] **Given** search input changes, **When** the user types, **Then** the table filters client-side by name/email.

## UI States

| State           | When?           | Rendering                          |
| --------------- | --------------- | ---------------------------------- |
| Loading         | Initial fetch   | Spinner                            |
| Empty           | No pending      | "No pending employees" empty state |
| Populated       | Entries visible | Search + sortable table            |
| Approval dialog | Dialog open     | Institution + role picker          |
| Error           | Fetch failure   | Error text + retry                 |

## Non-Goals

- **Bulk approval** — not implemented.
- **Auto-approval rules** — backend concern.

## Edge Cases

- **Concurrent admins approving the same employee** — backend should reject the duplicate; UI surfaces error.
- **Pending employee list regularly empty** — this page is not entered by default; expected to be empty most of the time.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'employees.edit'`.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- New pending registrations could trigger admin push notifications — verify with backend config.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts)
- **Dialog:** [`employee-approval-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/employee-approval-dialog.component.ts)
- **Service:** `EmployeesService`
- **Model:** `PendingEmployee`
- **Backend endpoints:** see [contracts.md](./contracts.md)
