# Contracts: Employees List

## Service: `EmployeesService`

From [`employees.service.ts`](../../../apps/tagea-frontend/src/app/services/employees.service.ts) — exact signatures live there.

Relevant methods for this surface:

```ts
getEmployeeById(id: string): Observable<Employee>;
updateEmployee(id: string, request: UpdateEmployeeRequest): Observable<Employee>;
// Admin-cross-institution audit timeline (employees.edit gated)
getEmployeeChangelog(id: string, limit?: number, offset?: number): Observable<EmployeeChangelogEntry[]>;
```

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
  /** Who owns the stammdaten record — determines which fields are editable. */
  source?: EmployeeSource;
  color?: string | null;
  pendingOnboarding?: boolean;
  last_invitation_sent_at?: Date;
  // + extended fields (phone, personnel_number, external_reference, custom fields, etc.)
}

type EmployeeSource = 'manual' | 'vivendi-sync' | 'azure-sync';

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

### EmployeeDialog Tabs

The dialog navigation (`navigationItems()` computed) exposes:

| Tab ID        | Visibility condition                                      | Content                                                      |
| ------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `general`     | always                                                    | Stammdaten via `FormCardComponent` + color picker            |
| `assignments` | always                                                    | Institution ↔ Role ↔ Departments panel list                  |
| `contracts`   | `mode === 'edit' && tenantFeaturesService.isPepEnabled()` | `EmploymentContract` list (PEP module)                       |
| `changelog`   | `mode === 'edit' && hasPermission('employees.edit')`      | `EmployeeChangelogTimelineComponent`, backend-paginated (50) |

### Source-Based Field Locking

Field editability in the `general` tab is gated by `data.employee?.source`, matching the server's `EmployeeAbility.computeFieldPermissions`:

| Source         | Stammdaten fields locked (UI disabled + omitted from PATCH)                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `manual`       | none                                                                                                                               |
| `vivendi-sync` | `first_name`, `last_name`, `email`, `phone`, `phone_mobile`, `phone_landline`, `date_of_birth`, `gender`, `personnel_number`, `external_reference` |
| `azure-sync`   | `phone_mobile`, `phone_landline`, `date_of_birth`                                                                                  |

Additionally, `status` is always disabled in the UI and excluded from the PATCH body — status changes flow through dedicated backend actions (`approve`, `reject`, `resendInvitation`).

## Changelog Timeline (Verlauf tab)

```ts
// apps/tagea-frontend/src/app/models/employee-changelog.model.ts
type EmployeeChangelogScope =
  | 'employee'                  // direct edit on the employees row
  | 'institution_assignment'    // junction: institution_employee_assignments
  | 'department_assignment';    // junction: user_department_assignments

type EmployeeChangelogAction = 'created' | 'updated' | 'deleted';

interface EmployeeChangelogEntry {
  id: string;
  changed_at: string;              // ISO 8601
  action: EmployeeChangelogAction;
  source: string;                  // 'user' | 'vivendi-sync' | 'azure-sync' | …
  scope: EmployeeChangelogScope;
  actor: { id: string; name: string } | null;  // null for sync writes
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  // Resolved names (backend enriches):
  institution_id?: string;
  institution_name?: string;
  role_id?: string;
  role_name?: string;
  prev_role_id?: string;
  prev_role_name?: string;
  department_id?: string;
  department_name?: string;
}
```

Backend endpoint: `GET /administration/employees/:id/changelog?limit=50&offset=0` — tenant-scoped, gated by `EMPLOYEES_EDIT`.

## Constants (component-level)

```ts
const BATCH_SIZE = 30;
const MAX_AUTO_LOAD = 300;
const CHANGELOG_PAGE_SIZE = 50;   // dialog 'changelog' tab
```

## Admin Cross-Institution List

Parallel surface at `/administration/nutzer/mitarbeitende` rendered by `AdminEmployeesComponent` — uses the same `EmployeeDialogComponent` for edit/create. Row click opens the edit dialog after loading the full employee via `getEmployeeById(row.id)`. Create uses the standard `mode: 'create'` path with the full cross-institution institution picker.

## Navigation target

Row tap on the institution-scoped list → `EmployeeDialogComponent` (edit). The list does not navigate to a dedicated detail route; the dialog is the edit surface.
