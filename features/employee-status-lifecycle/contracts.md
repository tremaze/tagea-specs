# Contracts: Employee Status Lifecycle

> API endpoints, DTOs, events, schema changes — everything that flows between frontend and backend.

## State Machine

| From → To           | ACTIVE | SUSPENDED | PENDING_APPROVAL | PENDING_ACTIVATION | DELETED |
| ------------------- | :----: | :-------: | :--------------: | :----------------: | :-----: |
| **(initial)**       |        |           |        ✓         |         ✓          |         |
| ACTIVE              |   —    |     ✓     |                  |                    |    ✓    |
| SUSPENDED           |   ✓    |     —     |                  |                    |    ✓    |
| PENDING_APPROVAL    |   ✓    |           |        —         |                    |    ✓    |
| PENDING_ACTIVATION  |        |           |        ✓         |         —          |    ✓    |
| DELETED             |   ✓    |           |                  |                    |    —    |

`assertTransitionAllowed(from, to, actor)` lives in `EmployeesService` and is called by every status-changing public method. Disallowed transitions throw `BadRequestException`.

## New Endpoints

### `POST /tenant/employees/:id/suspend`

Admin suspends an active employee. Pre-condition: target is `ACTIVE`.

**Permission:** `EMPLOYEES_EDIT` + `accessScopeService.hasAccessToEmployee(id, 'employees.edit')`.

**Request:**

> Documentation-only shape. Backend DTO to be added.

```ts
interface SuspendEmployeeDto {
  reason?: string; // max 500 chars; optional in v1 (see D1)
}
```

**Response:** `Employee` (status now `SUSPENDED`).

**Side-effects (in order):**
1. Keycloak: `enabled:false`
2. Keycloak: invalidate all sessions
3. DB transaction: set `status='suspended'`, GUC `app.current_change_source='admin-suspend'`, GUC `app.current_change_reason=<reason>`

**Error codes:** 400 (illegal transition), 401, 403, 404, 502/503 (Keycloak unreachable).

### `POST /tenant/employees/:id/reactivate`

Admin reactivates a suspended employee. Pre-condition: target is `SUSPENDED`.

**Permission:** `EMPLOYEES_EDIT` + scope check.

**Request:**

> Documentation-only shape. Backend DTO to be added.

```ts
interface ReactivateEmployeeDto {
  reason?: string; // max 500 chars; optional
}
```

**Response:** `Employee` (status now `ACTIVE`).

**Side-effects (in order):**
1. Keycloak: `enabled:true`
2. DB transaction: set `status='active'`, GUC `app.current_change_source='admin-reactivate'`, GUC `app.current_change_reason=<reason>`

Sessions are not invalidated — the user has none. Institution / teamspace assignments are not modified (they were never deleted on suspend).

**Error codes:** 400, 401, 403, 404, 502/503.

## Existing Endpoints (semantics preserved, source attribution added)

| Method | Path                              | `change_source` set | Notes                                                                     |
| ------ | --------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| POST   | `/tenant/employees/:id/approve`   | `admin-approve`     | Existing — wrapper now sets GUC.                                          |
| POST   | `/tenant/employees/:id/reject`    | `admin-reject`      | Existing.                                                                 |
| POST   | `/tenant/employees/:id/restore`   | `admin-restore`     | Existing — extended to reactivate `EMPLOYEE_DELETED` assignments.         |
| DELETE | `/tenant/employees/:id`           | `admin-delete`      | Existing — extended to soft-delete assignments with `EMPLOYEE_DELETED`.   |
| DELETE | `/employees/me`                   | `self-suspend`      | Existing — atomicity ordering corrected (Keycloak first).                 |

## Service Methods (new / changed signatures)

> Documentation-only shape. Backend service signatures to be implemented.

```ts
// apps/tagea-backend/src/users/employees.service.ts
interface ChangeStatusOptions {
  reason?: string;
}

class EmployeesService {
  // NEW — central wrapper used by all status verbs
  changeStatus(
    id: string,
    target: UserStatus,
    actor: { type: 'SELF' | 'ADMIN' | 'SYSTEM'; employeeId?: string },
    source: ChangeSource,
    options?: ChangeStatusOptions,
  ): Promise<Employee>;

  // NEW
  suspend(id: string, actorEmployeeId: string, dto: SuspendEmployeeDto): Promise<Employee>;
  reactivate(id: string, actorEmployeeId: string, dto: ReactivateEmployeeDto): Promise<Employee>;

  // CHANGED — assertTransitionAllowed inserted, ordering corrected
  // (deactivateKeycloakAccount unchanged externally, internal reorder)
  deactivateKeycloakAccount(id: string): Promise<void>;
  restore(id: string): Promise<Employee>; // now also re-attaches EMPLOYEE_DELETED assignments
  approveEmployee(id: string, options?: ApproveEmployeeOptions): Promise<Employee>;
  rejectEmployee(id: string): Promise<void>;
}

type ChangeSource =
  | 'self-suspend'
  | 'admin-suspend'
  | 'admin-reactivate'
  | 'admin-approve'
  | 'admin-reject'
  | 'admin-restore'
  | 'admin-delete';
```

> Documentation-only shape. Existing service signature change.

```ts
// apps/tagea-backend/src/database/tenant-write.service.ts
interface ExecuteWriteOptions {
  changeSource?: string;
  changeReason?: string;
}
class TenantWriteService {
  // CHANGED — accepts optional source/reason; sets GUCs in addition to existing employee_id/institution_id
  setChangelogSessionVars(
    runner: QueryRunner,
    options?: ExecuteWriteOptions,
  ): Promise<void>;
}
```

## Frontend Service Methods (new)

> Documentation-only shape. Frontend service additions to be implemented.

```ts
// apps/tagea-frontend/src/app/services/employees.service.ts
class EmployeesService {
  suspendEmployee(id: string, dto: { reason?: string }): Observable<Employee>;
  reactivateEmployee(id: string, dto: { reason?: string }): Observable<Employee>;
}
```

## Schema Changes

### Migration: `entity_changelog.reason`

> Documentation-only shape. Implementation in `apps/tagea-backend/src/tenant-migrations/<timestamp>-AddEntityChangelogReason.ts`.

```ts
interface EntityChangelogRow {
  // existing
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'created' | 'updated' | 'deleted';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by_employee_id: string | null;
  institution_id: string | null;
  source: string; // default 'user'
  changed_at: string;

  // NEW
  reason: string | null; // VARCHAR(500), NULL allowed, no backfill
}
```

The `track_entity_changelog()` trigger reads `current_setting('app.current_change_reason', true)` and writes it to `reason`. Existing rows remain `NULL`.

### Migration: Soft-delete on assignment tables

> Documentation-only shape.

```ts
interface InstitutionEmployeeAssignmentRow {
  // existing fields...
  deleted_at: string | null; // NEW — TypeORM @DeleteDateColumn
  deleted_reason: 'EMPLOYEE_DELETED' | 'MANUAL' | null; // NEW
}

interface TeamspaceEmployeeAssignmentRow {
  // existing fields...
  deleted_at: string | null; // NEW
  deleted_reason: 'EMPLOYEE_DELETED' | 'MANUAL' | null; // NEW
}
```

Existing hard-deleted rows are gone (no recovery). From the deploy onwards, deletes go through soft-delete.

### Migration: `track_entity_changelog` trigger on `teamspace_employee_assignments`

Mirrors migration `20260422140000` (institution / department assignments). Adds the trigger; existing rows are not retro-recorded.

## Frontend DTOs / Models

> Documentation-only shape. Frontend models to be added.

```ts
// apps/tagea-frontend/src/app/models/employee.model.ts — new types
export interface SuspendEmployeeOptions {
  reason?: string;
}
export interface ReactivateEmployeeOptions {
  reason?: string;
}
```

> Documentation-only shape. Frontend dialog data to be added.

```ts
// apps/tagea-frontend/src/app/components/employee-dialog/employee-status-section.component.ts — dialog data
export interface StatusActionDialogData {
  action: 'suspend' | 'reactivate' | 'restore' | 'delete';
  employee: Employee;
}

export interface StatusActionDialogResult {
  confirmed: boolean;
  reason?: string;
}
```

## Changelog Timeline (rendering contract)

> Documentation-only shape. Extension of existing TimelineEntry — `reason` field to be added.

```ts
// apps/tagea-frontend/src/app/components/employee-dialog/employee-changelog-timeline.component.ts
// Existing TimelineEntry shape (from EmployeeChangelogService) extended:
interface TimelineEntry {
  // existing fields
  changed_at: string;
  source: string; // now possibly: 'user' | 'azure-sync' | 'vivendi-sync' | 'self-suspend' | 'admin-suspend' | 'admin-reactivate' | 'admin-approve' | 'admin-reject' | 'admin-restore' | 'admin-delete'
  actor: { id: string; name: string } | null;
  field?: string; // 'status' triggers special-render path
  old_value?: unknown;
  new_value?: unknown;
  // NEW
  reason: string | null;
}
```

When `field === 'status'`, the component picks the i18n key by `source` (mapping table in spec.md → "i18n Keys") and renders `<verb> am <date> <by actor.name>` instead of the generic `<old> → <new>` row. If `reason` is non-null, a quote-style block renders below.

## Events

No WebSocket / push events in v1. (Future: `EmployeeStatusChangedEvent` for external-service listeners — out of scope.)

## Error Codes

| Code | When                                                    |
| ---- | ------------------------------------------------------- |
| 400  | Illegal status transition; `reason` exceeds 500 chars   |
| 401  | Unauthenticated                                         |
| 403  | Missing permission or scope check failed                |
| 404  | Employee not found                                      |
| 502  | Keycloak admin API failure                              |
| 503  | Keycloak unreachable                                    |
