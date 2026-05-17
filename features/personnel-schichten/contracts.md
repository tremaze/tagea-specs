# Contracts: Personnel — Schichtverwaltung

## New entity

> Documentation-only shape — planned, not yet in source.

```ts
// apps/tagea-backend/src/workforce-planning/shift-planning/entities/shift-assignment.entity.ts
@Entity('shift_assignments')
@Index(['employee_id', 'date'])
@Index(['institution_id', 'date'])
export class ShiftAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') employee_id: string;
  @Column('uuid') shift_template_id: string;
  @Column('uuid') institution_id: string;
  @Column('date') date: string;                // ISO date, no time
  @Column({ type: 'enum', enum: ShiftAssignmentStatus, default: 'draft' })
  status: 'draft' | 'published' | 'cancelled';
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'text', nullable: true }) cancellation_reason: string | null;
  @CreateDateColumn() created_at: Date;
  @Column('uuid') created_by_employee_id: string;
  @UpdateDateColumn() updated_at: Date;
  @Column({ type: 'uuid', nullable: true }) updated_by_employee_id: string | null;
}
```

**Migration:** `CreateShiftAssignmentsTable` — table + 2 indexes + FK `shift_template_id REFERENCES shift_templates(id) ON DELETE RESTRICT` + FK `employee_id REFERENCES employees(id) ON DELETE CASCADE` + FK `institution_id REFERENCES institutions(id) ON DELETE RESTRICT`.

**Audit trigger:** Add `shift_assignments` to the `track_entity_changelog` trigger list (siehe `memory/project_entity_changelog_audit.md`).

## Endpoints

### `GET /tenant/personnel/shifts/week`

**Query:**

- `startDate` (ISO date, Monday — required)
- `institutionId` (UUID, optional — Subset)
- `includeCancelled` (boolean, default: false)

**Response:**

> Documentation-only shape — planned, not yet in source.

```ts
interface ShiftWeekResponse {
  startDate: string;
  endDate: string;
  employees: ShiftWeekEmployee[];
}

interface ShiftWeekEmployee {
  employee_id: string;
  employee_name: string;
  personnel_number: string | null;
  contract_weekly_minutes: number | null;  // null = no contract
  assignments: ShiftAssignmentDto[];
  weekly_planned_minutes: number;          // sum across week (excl. cancelled)
  exceeds_contract: boolean;               // weekly_planned_minutes > contract_weekly_minutes
}

interface ShiftAssignmentDto {
  id: string;
  date: string;
  shift_template_id: string;
  shift_template_name: string;
  start_time: string;     // HH:mm
  end_time: string;       // HH:mm
  duration_minutes: number;
  institution_id: string;
  institution_name: string;
  status: 'draft' | 'published' | 'cancelled';
  notes: string | null;
}
```

**Errors:** 401, 403 (`tenant.shifts.view`)

### `POST /tenant/personnel/shifts/assignments`

**Body:**

> Documentation-only shape — planned, not yet in source.

```ts
interface CreateShiftAssignmentRequest {
  employee_id: string;
  shift_template_id: string;
  institution_id: string;
  date: string;
  notes?: string;
  force?: boolean;        // bypass CONFLICT_OVERLAP
}
```

**Response:** `ShiftAssignmentDto` with `status: 'draft'`

**Errors:** 401, 403 (`tenant.shifts.plan`), 404, 409 (`CONFLICT_OVERLAP` — body lists conflicting assignment IDs), 422 (`CONTRACT_VIOLATION` as **warning** in response header, not blocking)

### `PATCH /tenant/personnel/shifts/assignments/{id}`

**Body:** Partial `{ employee_id?, shift_template_id?, institution_id?, date?, notes?, force? }`

**Response:** Updated `ShiftAssignmentDto`

**Errors:** 401, 403, 404, 409, 422

### `POST /tenant/personnel/shifts/assignments/{id}/cancel`

**Body:** `{ reason?: string }`

**Response:** `ShiftAssignmentDto` with `status: 'cancelled'`

**Errors:** 401, 403, 404, 409 (`ALREADY_CANCELLED`)

### `POST /tenant/personnel/shifts/publish`

Bulk-publish all `draft` assignments matching the filter.

**Body:**

> Documentation-only shape — planned, not yet in source.

```ts
interface BulkPublishRequest {
  startDate: string;       // inclusive (ISO date)
  endDate: string;         // inclusive
  institutionId?: string;
  employeeIds?: string[];  // subset, default: all
}
```

**Response:**

> Documentation-only shape — planned, not yet in source.

```ts
interface BulkPublishResponse {
  publishedCount: number;
  notifiedEmployeeIds: string[];
}
```

**Side-effect:** triggers `SHIFT_ASSIGNMENT_PUBLISHED` notification per affected employee.

**Errors:** 401, 403 (`tenant.shifts.plan`)

### `GET /tenant/personnel/shifts/my-upcoming`

Employee self-view.

**Query:** `days` (default: 14, max: 90)

**Response:** `ShiftAssignmentDto[]` filtered to `employee_id = current user`, `status = 'published'`, `date BETWEEN today AND today+days`.

**Errors:** 401, 403 (`tenant.shifts.view_own`)

## Events (WebSocket / Push)

- `SHIFT_ASSIGNMENT_PUBLISHED` — per-employee notification on bulk-publish
  - Payload: `{ assignmentCount: number, weekStartDate: string }`
  - Deep link: `/personal/meine-schichten`

## Data flow

```
[Planer creates] ──► [shift_assignment row, status='draft']
                                │
                                ▼
[Planer publishes]──► [bulk UPDATE status='published']
                                │
                                ▼
                        [NotificationService.dispatch SHIFT_ASSIGNMENT_PUBLISHED]
                                │
                                ▼
                        [Employee sees in /personal/meine-schichten]
```
