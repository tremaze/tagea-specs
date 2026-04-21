# Contracts: Pending Employees

## Service: `EmployeesService`

Methods used on this page (`apps/tagea-frontend/src/app/services/employees.service.ts`):

- `getPendingEmployees(): Observable<PendingEmployee[]>` — list pending registrations (scoped by backend to institutions the caller can edit).
- `getPendingEmployeesCount(): Observable<{ count: number }>` — derived from the list; used by the nav badge.
- `approveEmployee(employeeId: string, options?: ApproveEmployeeOptions): Observable<Employee>` — commit approval with optional role / institution override.
- `rejectEmployee(employeeId: string): Observable<void>` — reject a pending registration.

## Backend endpoints

All mounted on `TenantEmployeesController` with prefix `tenant/employees`, guarded by `@Auth({ scope: 'tenant', permissions: [PERMISSIONS.EMPLOYEES_EDIT] })`.

| Method | Path                            | Returns                              |
| ------ | ------------------------------- | ------------------------------------ |
| GET    | `/tenant/employees/pending`     | `PendingEmployee[]` (scope-filtered) |
| POST   | `/tenant/employees/:id/approve` | `Employee`                           |
| POST   | `/tenant/employees/:id/reject`  | `204 No Content`                     |

The approve endpoint additionally runs `accessScopeService.hasAccessToEmployee(id, 'employees.edit')` and throws `ForbiddenException` if the caller lacks access to the target employee's institution. The reject endpoint does the same check.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/employee.model.ts
export interface PendingEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
  institutionId: string;
  institutionName: string;
}

export interface ApproveEmployeeOptions {
  role?: EmployeeRole;
  institutionId?: string;
  departmentIds?: string[];
}

export const EMPLOYEE_ROLES = ['admin', 'counselor', 'supervisor', 'manager'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];
```

## Dialog contract

```ts
// apps/tagea-frontend/src/app/pages/pending-employees/employee-approval-dialog.component.ts
export interface EmployeeApprovalDialogData {
  employee: PendingEmployee;
}

export interface EmployeeApprovalDialogResult {
  action: 'approved' | 'rejected' | 'cancelled';
}
```

The dialog owns the approve / reject HTTP calls internally (not the page). On success it closes with `{ action: 'approved' }` or `{ action: 'rejected' }`; the page removes the employee from its local signal when the result is either of those two. Cancel closes with `{ action: 'cancelled' }` and the page takes no action.

Inside `approve()` the dialog only sends `role` / `institutionId` in `ApproveEmployeeOptions` when the admin changed them from the defaults (`counselor` and the employee's original `institutionId`).
