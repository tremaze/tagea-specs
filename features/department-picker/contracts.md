# Contracts: Department Picker

> API endpoints and response shapes for the department-picker source endpoints. All routes live under the institution-scoped prefix and require an active institution context.

## Endpoints

### `GET /institutions/:institutionId/departments/assignable`

Returns the set of departments the **current employee** may use as a target for assignment in the given institution. Used by every UI that lets the user pick a department: client dialogs, case dialogs, list filter dropdowns.

**Auth:** `@Auth({ scope: 'institution', allowedUserTypes: [EMPLOYEE] })`. The institution-context middleware additionally enforces that the caller is assigned to `:institutionId`.

**Server-side decision:**

```
if principal.is_tenant_admin
   OR PermissionResolverService.hasPermission(ctx, 'institution.departments.access_all', 'institution'):
       return all departments WHERE institution_id = :institutionId AND is_active = true
else:
       return departments JOIN user_department_assignments
           WHERE department.institution_id = :institutionId
             AND department.is_active = true
             AND user_department_assignments.user_id = principal.id
```

The endpoint never returns inactive departments. Departments are sorted by `name` ascending.

**Response:**

> Documentation-only shape.

```ts
// Source: apps/tagea-backend/src/departments/entities/department.entity.ts
type AssignableDepartmentsResponse = Department[];
```

Where `Department` matches the existing entity:

```ts
interface Department {
  id: string;             // UUID
  name: string;
  description: string | null;
  is_active: boolean;     // always true in this response
  institution_id: string; // always equal to the path param
  created_at: string;     // ISO 8601
  updated_at: string;
}
```

**Error codes:** 401 (unauthenticated), 403 (caller not assigned to institution), 404 (institution does not exist).

**No "(Kein Department)" sentinel.** The empty/null option is a UI concern; the backend never returns a synthetic NULL row. Consumers that want to offer "no department" as a choice render it locally.

### `GET /institutions/:institutionId/departments/my-memberships`

Returns the **principal's own department memberships** in the given institution. Used by the employee profile page to render "Meine Abteilungen". Distinct from `/assignable` because:

- It always reflects own memberships, regardless of `access_all`.
- It is read-only display data, not a picker for write operations.

**Auth:** `@Auth({ scope: 'institution', allowedUserTypes: [EMPLOYEE] })`. No additional permission required.

**Server-side query:**

```
return departments JOIN user_department_assignments
    WHERE department.institution_id = :institutionId
      AND department.is_active = true
      AND user_department_assignments.user_id = principal.id
```

**Response:**

> Documentation-only shape.

```ts
type MyMembershipsResponse = Department[];
```

**Error codes:** 401, 403 (caller not assigned to institution).

## Permissions

```ts
// Source: packages/permissions/src/lib/permissions.ts
const EMPLOYEE_PERMISSIONS = {
  // ...existing...
  DEPARTMENTS_ACCESS_ALL: 'institution.departments.access_all',
};
```

Default role mapping (seeded by tenant migration; see Phase 1a):

| `EmployeeRole` | `DEPARTMENTS_ACCESS_ALL` | Notes |
| -------------- | ------------------------ | ----- |
| `ADMIN`        | ✅                       | Tenant-Admin role; matches the existing seeding of `CLIENTS_VIEW_ALL_DEPARTMENTS` / `CASES_VIEW_ALL_DEPARTMENTS` (lines 222, 245 in `default-role-permissions.ts`). |
| `MANAGER`      | ❌                       | Einrichtungs-Admin: today already restricted to own department reach. Permission is editable per tenant. |
| `SUPERVISOR`   | ❌                       | Anchored to own departments by default. |
| `COUNSELOR`    | ❌                       | Berater: anchored to own departments. |

`principal.is_tenant_admin === true` short-circuits to "full access" before the permission is consulted. The permission is editable per role on the role-administration screen, like every other permission.

## Frontend service surface

```ts
// Source: apps/tagea-frontend/src/app/admin/services/departments-http.service.ts
class DepartmentsHttpService {
  // New methods, both institution-scoped via institutionUrl(...)
  getAssignable(): Observable<Department[]>;
  getMyMembershipsInInstitution(): Observable<Department[]>;

  // Existing methods kept:
  getActive(): Observable<Department[]>;          // admin / "Einrichtung verwalten"
  getByInstitution(institutionId: string): Observable<Department[]>; // employee-edit dialog
  getAll(): Observable<Department[]>;             // admin
}
```

The legacy `getMyDepartments(): Observable<Department[]>` and the underlying `GET /auth/me/departments` are removed in Phase 5 (post-migration cleanup).

## Migration notes

- `permissions` table: insert one row per tenant with `name = 'institution.departments.access_all'`, `category = 'departments'`, `action = 'access_all'`, scope `institution`. Pattern matches `20260205140000-AddClientProfileDeletePermission.ts`.
- `role_permissions`: link the new permission to `tenant-admin` and `einrichtungs-admin` for all existing tenants.
- `default-role-permissions.ts`: add `EMPLOYEE_PERMISSIONS.DEPARTMENTS_ACCESS_ALL` to the same two roles' lists (alphabetically sorted).
- No data migration of existing `user_department_assignments` rows is needed — the new endpoint reads them as-is.

> **Flutter port note:** Same wire contract on both endpoints. Dart models should mirror `Department` exactly; the `(Kein Department)` option is rendered as `null` in the form and serialized to `department_id: null` on submit.
