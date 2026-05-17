# Contracts: Personnel — Zeitkonten

## Existing endpoints (reused, scoped to tenant)

### `GET /tenant/personnel/time-accounts/overview` *(NEW)*

Aggregiert `TimeAccountService.getOverview()` über alle Einrichtungen des Tenants. Filter via Query.

**Query:**

- `month` (1-12, optional — default: current month)
- `year` (optional — default: current year)
- `institutionId` (UUID, optional — Subset einer Einrichtung)
- `includeInactive` (boolean, default: false)

**Response:**

> Documentation-only shape — planned, not yet in source.

```ts
interface PersonnelTimeAccountOverview {
  month: number;
  year: number;
  entries: PersonnelTimeAccountEntry[];
  kpis: PersonnelTimeAccountKpis;
}

interface PersonnelTimeAccountEntry {
  employee_id: string;
  employee_name: string;
  personnel_number: string | null;
  primary_institution_id: string;
  primary_institution_name: string;
  target_minutes: number;
  absence_minutes: number;
  actual_minutes: number;
  difference_minutes: number;     // signed
  previous_balance_minutes: number;
  balance_minutes: number;        // signed cumulative
  is_locked: boolean;
}

interface PersonnelTimeAccountKpis {
  total_employees: number;
  surplus_employees: number;       // balance > 0
  deficit_employees: number;       // balance < 0
  critical_deficit_employees: number; // balance < -2400 (40h)
  largest_deficit_minutes: number; // signed (negative)
}
```

**Errors:** 401, 403 (`tenant.time_accounts.view`), 404 (tenant unknown)

### `GET /tenant/personnel/time-accounts/{employeeId}/history`

Per-employee 12-month history (reuses `TimeAccountService.getHistory()`).

**Query:** `monthCount` (default: 12, max: 36)

**Response:** `TimeAccountOverviewEntry[]` (existing shape from PEP feature).

### `POST /tenant/personnel/time-accounts/{employeeId}/adjustments`

Wraps the existing backend method `addManualAdjustment` on `TimeAccountService`. Same DTO + auth pattern, but tenant-scoped.

**Body:**

> Documentation-only shape — planned, not yet in source.

```ts
interface TimeAccountAdjustmentRequest {
  month: number;
  year: number;
  delta_minutes: number;  // signed
  reason: string;         // min 5 chars, max 500
}
```

**Response:** Updated `TimeAccountOverviewEntry`.

**Errors:** 401, 403 (`tenant.time_accounts.adjust`), 409 (`MONTH_LOCKED`), 422 (`INVALID_REASON_LENGTH`)

## Data Models

> Documentation-only shape — planned, not yet in source.

```ts
// Source: apps/tagea-backend/src/workforce-planning/entities/time-account-entry.entity.ts
// (referenced, not redefined)
```

## Events

None in V1. Future: emit `time_account.adjusted` for cross-tenant audit aggregation.
