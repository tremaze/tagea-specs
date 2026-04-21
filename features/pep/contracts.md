# Contracts: PEP

## Service

`PepService` at [`apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts`](../../../apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts).

```ts
// apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts
class PepService {
  getScheduleData(_institutionId: string, start: string, end: string): Observable<PepScheduleData>;

  getOverview(_institutionId: string, year: number, month: number): Observable<TimeAccountOverviewEntry[]>;

  getPerformanceKpis(_institutionId: string, year: number, month: number): Observable<PerformanceKpis>;
}
```

> The `_institutionId` argument is ignored — the service resolves the institution from `InstitutionContextService` and builds URLs via `ApiConfigService.getInstitutionApiUrl(id, endpoint)`.

## Backend endpoints

Mounted under `${INSTITUTION_ROUTE_PREFIX}/time-accounts` (see `apps/tagea-backend/src/workforce-planning/controllers/time-account.controller.ts`). Controller guards: `FeatureGuard` + `@RequireFeature('pep')`; every route `@Auth({ scope: 'institution', permissions: [PERMISSIONS.EMPLOYEES_VIEW] })`.

| Method | Path                             | Query DTO                                       | Returns                      |
| ------ | -------------------------------- | ----------------------------------------------- | ---------------------------- |
| GET    | `time-accounts/schedule-data`    | `PepScheduleFiltersDto` (`start`, `end`)        | `PepScheduleData`            |
| GET    | `time-accounts/overview`         | `WorkforceOverviewFiltersDto` (`year`, `month`) | `TimeAccountOverviewEntry[]` |
| GET    | `time-accounts/performance-kpis` | `WorkforceOverviewFiltersDto` (`year`, `month`) | `PerformanceKpis`            |

Related endpoints on the same controller (not used by this page):

- `GET time-accounts/:employeeId?year=` → `TimeAccountEntry[]` (employee history)
- `POST time-accounts/:employeeId/adjustments` → `TimeAccountEntry` (requires `EMPLOYEES_EDIT`)

## Data Models

```ts
// apps/tagea-frontend/src/app/pages/pep-page/pep.model.ts
interface TimeAccountOverviewEntry {
  employee_id: string;
  first_name: string;
  last_name: string;
  target_minutes: number;
  absence_minutes: number;
  actual_minutes: number;
  difference_minutes: number;
  previous_balance_minutes: number;
  balance_minutes: number;
  is_locked: boolean;
}

interface PerformanceKpis {
  utilization_percent: number;
  billing_rate_percent: number;
  billable_hours: number;
}

interface PepScheduleEmployee {
  employee_id: string;
  first_name: string;
  last_name: string;
}

interface PepScheduleWorkingHours {
  employee_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  shift_template_id?: string | null;
}

interface PepScheduleTrackedTime {
  id: string;
  employee_id: string;
  start: string;
  end: string;
  break_duration: number;
}

interface PepScheduleAbsence {
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
}

interface PepScheduleData {
  employees: PepScheduleEmployee[];
  working_hours: PepScheduleWorkingHours[];
  tracked_times: PepScheduleTrackedTime[];
  absences: PepScheduleAbsence[];
}
```

Frontend and backend share the same shapes — backend interfaces live in `apps/tagea-backend/src/workforce-planning/services/time-account.service.ts`.

## Tabs

Tab order in the template (index matches `activeTab` signal):

- **0 — Dienstplan** (`pep.tabs.schedule`): renders `PepScheduleComponent`, only while `activeTab() === 0`.
- **1 — Zeitkonten** (`pep.tabs.timeAccounts`): month + year `mat-select`, KPI card (`EntityKpiCardComponent`), `MatTable` of `TimeAccountOverviewEntry` with columns `name`, `target`, `absence`, `actual`, `difference`, `timeAccount`, `balance`, `status`.
