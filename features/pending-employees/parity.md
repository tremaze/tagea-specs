# Parity: Pending Employees

## Angular

- **Status:** ✅ Implemented
- **Page:** [`apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/pending-employees-page.component.ts)
- **Dialog:** `EmployeeApprovalDialogComponent` ([`employee-approval-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/pending-employees/employee-approval-dialog.component.ts))
- **Route:** `/pending-employees` in `routes/institution.routes.ts` (guarded by `permissionGuard` / `employees.edit`)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2 admin surface)

## Port Log

| Date       | Who      | What                                                       |
| ---------- | -------- | ---------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only)                          |
| 2026-04-21 | ltoenjes | Audit: fixed route, model casing, dialog result, endpoints |
