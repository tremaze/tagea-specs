# Contracts: Personnel — Zeiterfassung

## New entity

> Documentation-only shape — planned, not yet in source.

```ts
// apps/tagea-backend/src/time-tracking/entities/time-correction-request.entity.ts
@Entity('time_correction_requests')
@Index(['status', 'created_at'])
@Index(['tracked_time_id'])
export class TimeCorrectionRequestEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') tracked_time_id: string;
  @Column('uuid') requested_by_employee_id: string;
  @Column({ type: 'timestamptz' }) original_start: Date;
  @Column({ type: 'timestamptz', nullable: true }) original_end: Date | null;
  @Column('int') original_break_minutes: number;
  @Column({ type: 'timestamptz' }) proposed_start: Date;
  @Column({ type: 'timestamptz', nullable: true }) proposed_end: Date | null;
  @Column('int') proposed_break_minutes: number;
  @Column('text') reason: string;
  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';
  @Column({ type: 'text', nullable: true }) approval_reason: string | null;
  @Column({ type: 'uuid', nullable: true }) decided_by_employee_id: string | null;
  @Column({ type: 'timestamptz', nullable: true }) decided_at: Date | null;
  @CreateDateColumn() created_at: Date;
}
```

**Migration:** `CreateTimeCorrectionRequestsTable` — table + 2 indexes + FK `tracked_time_id REFERENCES tracked_time(id) ON DELETE CASCADE` + FK `requested_by_employee_id REFERENCES employees(id) ON DELETE RESTRICT`.

**Audit trigger:** Add `time_correction_requests` to `track_entity_changelog` trigger list.

## Endpoints

### `GET /tenant/personnel/time-tracking/overview`

**Query:**

- `from` (ISO date, required)
- `to` (ISO date, required, max 31 day range)
- `institutionId` (UUID, optional)
- `employeeIds` (CSV UUID, optional)
- `vivendiStatus` (`synced` | `pending` | `error`, optional)

**Response:**

> Documentation-only shape — planned, not yet in source.

```ts
interface TimeTrackingOverviewResponse {
  from: string;
  to: string;
  entries: TrackedTimeOverviewDto[];
}

interface TrackedTimeOverviewDto {
  id: string;
  employee_id: string;
  employee_name: string;
  personnel_number: string | null;
  institution_id: string;
  institution_name: string;
  date: string;                          // ISO date
  start: string;                         // ISO timestamp
  end: string | null;                    // null = open
  break_minutes: number;
  total_minutes: number;                 // end-start-break, 0 if open
  vivendi_status: 'synced' | 'pending' | 'error' | 'not_applicable';
  vivendi_error_message: string | null;
  has_pending_correction: boolean;
  is_locked: boolean;                    // month locked
}
```

**Errors:** 401, 403 (`tenant.time_tracking.view`), 422 (`RANGE_TOO_LARGE`)

### `GET /tenant/personnel/time-tracking/{trackedTimeId}/detail`

Sub-entries plus correction history.

**Response:**

> Documentation-only shape — planned, not yet in source.

```ts
interface TrackedTimeDetailResponse {
  tracked: TrackedTimeOverviewDto;
  entries: TimeTrackingEntryDto[];       // existing shape
  corrections: TimeCorrectionRequestDto[];
  notes: string | null;
}
```

### `POST /personal/time-tracking/{trackedTimeId}/corrections`

Employee self-service. NOT under `/tenant/{tenantId}` — `tenantId` derived from `tracked_time` row.

**Body:**

> Documentation-only shape — planned, not yet in source.

```ts
interface CreateCorrectionRequest {
  proposed_start: string;          // ISO timestamp
  proposed_end: string | null;
  proposed_break_minutes: number;
  reason: string;                  // min 5 chars, max 500
}
```

**Response:** `TimeCorrectionRequestDto`

**Errors:** 401, 403 (`tenant.time_tracking.request_correction`), 404, 409 (`MONTH_LOCKED`, `ENTRY_TOO_OLD`)

### `GET /tenant/personnel/time-tracking/corrections`

Approval queue.

**Query:**

- `status` (`pending` | `approved` | `rejected`, default: `pending`)
- `institutionId` (UUID, optional)
- `page`, `pageSize` (pagination)

**Response:** Paginated `TimeCorrectionRequestDto[]`

**Errors:** 401, 403 (`tenant.time_tracking.approve`)

### `POST /tenant/personnel/time-tracking/corrections/{id}/approve`

**Body:** `{ approval_reason?: string }`

**Response:** Updated `TimeCorrectionRequestDto`

**Side-effect:**
1. `UPDATE tracked_time SET start/end/break = proposed_*, vivendi_adopted=false`
2. Write `entity_changelog` for `tracked_time` (source=user, metadata={correction_id})
3. Dispatch `TIME_CORRECTION_APPROVED` notification to requester

**Errors:** 401, 403 (`tenant.time_tracking.approve`), 404, 409 (`ALREADY_DECIDED`, `MONTH_LOCKED`), 403 (`SELF_APPROVAL_FORBIDDEN` — `decided_by_employee_id === requested_by_employee_id`)

### `POST /tenant/personnel/time-tracking/corrections/{id}/reject`

**Body:** `{ approval_reason: string }` (required for reject — min 5 chars)

**Response:** Updated `TimeCorrectionRequestDto`

**Side-effect:** Dispatch `TIME_CORRECTION_REJECTED` notification to requester.

**Errors:** 401, 403, 404, 409, 422 (`REASON_REQUIRED`)

### `GET /personal/time-tracking/me/recent`

Employee self-view — letzte 14 Tage eigene `tracked_time`.

**Query:** `days` (default: 14, max: 31)

**Response:** `TrackedTimeOverviewDto[]` filtered to current employee.

**Errors:** 401

## Events / Notifications

| Notification Type             | Trigger                           | Recipient                              | Deep-link                          |
| ----------------------------- | --------------------------------- | -------------------------------------- | ---------------------------------- |
| `TIME_CORRECTION_REQUESTED`   | New `correction_request`          | Users with `tenant.time_tracking.approve` | `/personal/zeiterfassung/genehmigungen` |
| `TIME_CORRECTION_APPROVED`    | Approval                          | Requester                              | `/personal/meine-zeiten`          |
| `TIME_CORRECTION_REJECTED`    | Rejection                         | Requester                              | `/personal/meine-zeiten`          |

## Data Models (existing, referenced)

> Documentation-only shape — planned, not yet in source.

```ts
// Source: apps/tagea-backend/src/time-tracking/entities/tracked-time.entity.ts
// (referenced, not redefined)
```
