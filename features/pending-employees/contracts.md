# Contracts: Pending Employees

## Service: `EmployeesService`

Methods used on this page (exact signatures in the service file):

- `getPendingEmployees()` — list pending registrations
- `approvePendingEmployee(employeeId, approval)` — commit approval with institutions + role

## Data Models

```ts
// apps/tagea-frontend/src/app/models/employee.model.ts
interface PendingEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  registered_at: string;
  // + metadata — verify full shape
}
```

## Dialog contract

```ts
// pending-employees/employee-approval-dialog.component.ts
interface EmployeeApprovalDialogData {
  employee: PendingEmployee;
}

interface EmployeeApprovalDialogResult {
  institutionIds: string[];
  role: string;
  // + approver metadata
}
```
