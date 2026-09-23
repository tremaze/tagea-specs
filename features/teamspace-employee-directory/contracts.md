# Contracts: Teamspace Employee Directory

## Endpoints (verified against backend, 2026-09-23)

All routes are tenant-scoped (`x-tenant-id`). No `X-Institution-ID` header.

| Method + path | Guard | Purpose |
| --- | --- | --- |
| `GET /tenant/employees/directory` | `@Auth({ scope: 'tenant', permissions: [TENANT_EMPLOYEES_LIST] })` | Paginated, searchable directory |
| `GET /tenant/employees/:id/details` | `TENANT_EMPLOYEES_LIST` (+ per-target `assertAccessToEmployeeForAny`) | Person detail with institutions → departments |
| `GET /tenant/employees/:id/profile-picture?size=thumbnail` | `TENANT_EMPLOYEES_LIST` | Avatar bytes (`Cache-Control: private`) — only when `profile_picture_s3_key` / `has_profile_picture` is set |
| `GET /tenant/institutions` | `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })`, `@RequireFeature('institutions')` | Filter options (Angular filters `is_active` client-side) |
| `GET /tenant/institutions/active` | same as above | Active institutions only (Flutter uses this) |

Sources: `apps/tagea-backend/src/users/controllers/tenant-employees.controller.ts`,
`apps/tagea-backend/src/institutions/tenant-institutions.controller.ts`,
`apps/tagea-backend/src/users/employees.service.ts` (`findAllTenantEmployees`).

### `GET /tenant/employees/directory` query

| Param | Type | Directory sends | Notes |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1…n` | Without `page` the endpoint returns a bare array (legacy) |
| `limit` | int 1–100 | `50` | default 30 |
| `search` | string | trimmed term or omitted | ILIKE on `first_name`, `last_name`, `email` |
| `institutionIds` | comma-separated uuids | selected ids or omitted | people assigned to **any** of them |
| `excludePendingOnboarding` | `'true'` | always | filtered **after** pagination → short pages possible |
| `includeTeamspaces` | `'true'` | always | adds `teamspaces: {id, name}[]` (alphabetical) |
| `excludeSelf`, `role`, `status`, `context` | — | never | not used by the directory |

Response (`PaginatedResponse<Employee>` from `models/pagination.model.ts`):

```ts
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number; // more pages exist while page < pages
  limit: number;
}
```

Relevant fields of each item (`Employee` in `models/employee.model.ts`; the
entity is serialized as is, plus two computed fields):

```ts
// Source: apps/tagea-frontend/src/app/models/employee.model.ts
interface Employee {
  id: string;
  email: string | null; // null when hidden (see visibility below)
  first_name: string;
  last_name: string;
  role: string; // legacy single role
  phone_mobile?: string | null;
  phone_landline?: string | null;
  status: string; // 'active' | 'suspended' | …
  profile_picture_s3_key?: string; // non-empty → avatar can be fetched
  institutionRoles?: string[]; // aggregated from institution assignments
  pendingOnboarding?: boolean;
  teamspaces?: TeamspaceRef[]; // only with includeTeamspaces
}

interface TeamspaceRef {
  id: string;
  name: string;
}
```

**Contact visibility:** unless the caller holds `tenant.employees.edit`,
`applyContactVisibilityFilter` sets `email`, `phone_mobile`,
`phone_landline` and `phone_fax` to `null` for people whose
`email_visible` / `phone_mobile_visible` / `phone_landline_visible` flag is
false. The flags themselves stay in the payload; clients must rely on the
`null` values, not on the flags.

### `GET /tenant/employees/:id/details` response

```ts
// Source: apps/tagea-frontend/src/app/models/employee.model.ts
interface EmployeeDetails {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  phone_mobile?: string | null;
  phone_landline?: string | null;
  status: string;
  has_profile_picture?: boolean;
  institutions: {
    id: string;
    name: string;
    departments: { id: string; name: string }[];
  }[];
  tenantRoleId?: string | null;
}
```

Same visibility rule as the list. Teamspaces are **not** part of this
response; the detail reuses the `teamspaces` of the directory row.

**Error codes:** 401 (session), 403 (outside the caller's scope), 404
(deleted meanwhile).

### `GET /tenant/institutions/active` response

Array of the `Institution` entity; the directory only reads:

```ts
// Source: apps/tagea-frontend/src/app/admin/models/institution.types.ts
interface Institution {
  id: string;
  name: string;
  is_active: boolean;
}
```

**Error codes:** 403 when the tenant feature `institutions` is disabled →
the directory hides the filter instead of failing.

## Service: `TenantEmployeesService`

| Method | Purpose |
| --- | --- |
| `getTenantDirectoryPaginated(params)` | `GET tenant/employees/directory` (list, search, filter, paging) |
| `getEmployeeDetails(id)` | `GET tenant/employees/:id/details` |

`InstitutionsHttpService.getAll()` → `GET tenant/institutions` (filter
options).

## Events (WebSocket / Push)

None.

> **Flutter port note:** `packages/teamspace_core` `EmployeeDirectoryApi`
> maps the same JSON (identical field names, nullability). Rows and details
> are kept in memory only; nothing is persisted or logged.
