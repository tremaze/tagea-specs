# Contracts: Department Membership Management

> API endpoints, DTOs, events — everything that flows between frontend and backend.

## Endpoints

The same routes exist under two prefixes with the same semantics:

- `tenant/institutions/:institutionId/departments/:id/users` — tenant-scope, requires `departments.manage` on tenant
- `institutions/:institutionId/departments/:id/users` — institution-scope, requires `departments.manage` and the caller to be assigned to `institutionId`

Method-by-method, the semantics are:

### `GET /departments/:id/users`

Read current membership.

**Response:**

> Documentation-only shape.

```ts
type DepartmentUsersResponse = Employee[];
```

**Error codes:** 401, 403 (lacks `departments.view`), 404 (department not found)

### `POST /departments/:id/users`

**Additive.** Adds the given users to the department. Already-members are silently kept; conflicts are not errors. Empty `user_ids` is a no-op (returns `[]`).

**Request body:**

> Documentation-only shape (backend DTO; Angular uses `AddUsersData` in `apps/tagea-frontend/src/app/admin/models/department.types.ts`).

```ts
interface AddUsersDto {
  user_ids: string[]; // UUIDs; may include already-assigned users
}
```

**Response:**

> Documentation-only shape.

```ts
type AddUsersResponse = UserDepartmentAssignment[]; // newly created rows only
```

**Status:** 201 Created
**Error codes:** 401, 403 (lacks `departments.manage`), 404 (department or user not found)

### `PUT /departments/:id/users`

**Replace.** Sets the department's membership to exactly `user_ids`. Anyone currently assigned but not in the list is removed. Anyone in the list but not currently assigned is added.

**Safeguard:** if the operation would remove more than 50% of current members (and at least one member would be removed), the request is rejected with HTTP 400 unless `force: true` is set in the body. The threshold matches the existing Vivendi-sync `DEFAULT_MAX_CLEAR_PCT` constant.

**Request body:**

> Documentation-only shape (backend DTO; Angular uses `ReplaceUsersData` in `apps/tagea-frontend/src/app/admin/models/department.types.ts`).

```ts
interface ReplaceUsersDto {
  user_ids: string[]; // UUIDs; the new complete membership
  force?: boolean;    // bypass the >50% safeguard; default false
}
```

**Response:**

> Documentation-only shape (Angular surfaces this as `ReplaceUsersResult`).

```ts
interface ReplaceUsersResponse {
  added: UserDepartmentAssignment[];
  removed_user_ids: string[];
  total_after: number;
}
```

**Status:** 200 OK
**Error codes:** 401, 403, 404, 400 with `error: "REPLACE_SAFEGUARD_TRIPPED"` when the safeguard fires.

Safeguard error body:

> Documentation-only shape (NestJS exception payload; Angular handles as a generic `HttpErrorResponse`).

```ts
interface ReplaceSafeguardError {
  statusCode: 400;
  error: 'REPLACE_SAFEGUARD_TRIPPED';
  message: string;
  removed_count: number;
  current_count: number;
  threshold_pct: number; // e.g. 0.5
}
```

### `DELETE /departments/:id/users/:userId`

Single-user removal. Unchanged from prior behavior.

**Status:** 204 No Content
**Error codes:** 401, 403, 404

## Events (WebSocket / Push)

None. Membership changes do not emit live events.

## Audit

Every INSERT/UPDATE/DELETE on `user_department_assignments` writes a row to `entity_changelog` via the `trg_changelog_user_department_assignments` trigger. The trigger captures `actor_user_id` (from the `audit.actor` session variable, set by the request middleware) and the operation type. This is unchanged.

## Data Models

```ts
// Source: apps/tagea-backend/src/departments/entities/user-department-assignment.entity.ts
interface UserDepartmentAssignment {
  id: string;          // uuid
  user_id: string;     // FK Employee.id
  department_id: string; // FK Department.id
  source: 'manual' | 'vivendi-sync' | 'azure-sync';
  assigned_at: string; // ISO 8601
}
```

> **Flutter port note:** The mobile app reuses the Angular HTTP services via Capacitor — no separate Dart client is needed for these endpoints today.
