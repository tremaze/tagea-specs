# Contracts: Employees List

## Service: `EmployeesService`

From [`employees.service.ts`](../../../apps/tagea-frontend/src/app/services/employees.service.ts) — exact signatures live there.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/employee.model.ts
interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string; // one of EMPLOYEE_ROLES values (per-institution)
  status: string; // one of EMPLOYEE_STATUS values
  tenant_id: string;
  color?: string | null;
  pendingOnboarding?: boolean;
  last_invitation_sent_at?: Date;
  // + extended fields (phone, custom fields, etc.)
}

// Exported constants — used for chip labels / filter options
const EMPLOYEE_ROLES = ['admin', 'counselor', 'supervisor', 'manager'] as const;
const EMPLOYEE_STATUS = ['active', 'suspended', 'pending_activation', 'pending_approval'] as const;
```

## Dialogs

```ts
interface EmployeeDialogData {
  mode: 'create' | 'edit';
  employee?: Employee;
  showTenantAdminToggle?: boolean;
  preselectedInstitutionId?: string;
  restrictToInstitutionId?: string;
  manageableInstitutionIds?: string[];
}
```

## Constants (component-level)

```ts
const BATCH_SIZE = 30;
const MAX_AUTO_LOAD = 300;
```

## Navigation target

Row tap → `institutionRoute(institutionId, 'profile', employeeId)` is **not** applicable; employees currently have no dedicated detail route from this list (edit happens via dialog). Verify if routing is added in future.
