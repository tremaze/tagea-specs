# Feature: PEP (Personaleinsatzplanung)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Personnel deployment / time-account page at `/einrichtung/:institutionId/pep`. Tabbed layout: a **schedule** view (`PepScheduleComponent`) and a **time-accounts** overview (monthly `TimeAccountOverviewEntry[]` per employee + `PerformanceKpis` tiles).

## User Stories

- As an **admin** I want a schedule view, so that I can see shifts, tracked times and absences per employee.
- As an **admin** I want to see each staff member's monthly time-account (target, absence, actual, difference, previous balance, balance, lock state) so that I can balance workloads.
- As an **admin** I want KPIs at a glance (utilization, billing rate, billable hours), so that I know whether the institution is on track.

## Acceptance Criteria

- [ ] **Given** the page loads, **When** `PepScheduleComponent` renders in tab 0, **Then** the schedule view shows employees, working hours, tracked times and absences for the selected range.
- [ ] **Given** the user switches to tab 1 (Zeitkonten), **When** the month/year selects resolve, **Then** a `MatTable` renders `TimeAccountOverviewEntry` rows with columns: name, target, absence, actual, difference, previous time-account, balance, status (lock icon).
- [ ] **Given** the overview tab is active, **When** `getPerformanceKpis` resolves, **Then** `EntityKpiCardComponent` renders three KPI values: utilization (%), billing rate (%), billable hours (h).
- [ ] **Given** month or year changes, **When** the selection fires, **Then** `getOverview` and `getPerformanceKpis` reload.

## UI States

| State                    | When?                    | Rendering                                            |
| ------------------------ | ------------------------ | ---------------------------------------------------- |
| Loading                  | Overview fetch in-flight | `mat-progress-bar` (indeterminate)                   |
| Populated (schedule tab) | Tab 0 active             | `PepScheduleComponent`                               |
| Populated (overview tab) | Entries returned         | KPI card + `MatTable` of time-account entries        |
| Empty (overview tab)     | No entries for the month | `event_busy` icon + `pep.noData`                     |
| Error (overview tab)     | Fetch failure            | Entries cleared, KPIs cleared (no explicit error UI) |

## Non-Goals

- **Direct schedule editing** — schedule is viewer-only here; edits happen in shift/working-hours admin surfaces (einstellungen).
- **Payroll integration** — separate Gehaltsnachweise feature.
- **Manual time-account adjustments UI** — the backend endpoint (`POST /time-accounts/:employeeId/adjustments`) exists but is not wired into this page.

## Edge Cases

- **Signed values** — `difference_minutes`, `previous_balance_minutes`, and `balance_minutes` render with a `+` / `-` prefix and get a positive/negative CSS class.
- **Locked month** — `is_locked: true` renders a `lock` icon with tooltip `pep.locked`; otherwise `lock_open` + `pep.open`.
- **Schedule-tab mount** — the schedule is only mounted while tab 0 is active (`@if (activeTab() === 0)`) to avoid background work.

## Permissions & Tenant/Institution

- **Route guards:** `permissionGuard` + `pepFeatureGuard`.
- **Required permission:** `employees.view` (from route `data`).
- **Backend:** controller decorated with `@UseGuards(FeatureGuard)` + `@RequireFeature('pep')`; every endpoint uses `@Auth({ scope: 'institution', permissions: [PERMISSIONS.EMPLOYEES_VIEW] })`.
- **Institution context:** resolved via `UnifiedAuthService.institutionId()` (the service ignores the `_institutionId` argument and uses `InstitutionContextService` internally).

## Notifications (Push / In-App)

- Not a push target.

## i18n Keys

> User-facing strings remain in German. Keys used on this page include `pep.pageTitle`, `pep.pageSubtitle`, `pep.tabs.schedule`, `pep.tabs.timeAccounts`, `pep.month`, `pep.year`, `pep.employee`, `pep.target`, `pep.absence`, `pep.actual`, `pep.difference`, `pep.timeAccount`, `pep.balance`, `pep.status`, `pep.locked`, `pep.open`, `pep.noData`, `pep.kpi.title`, `pep.kpi.utilization`, `pep.kpi.utilizationTooltip`, `pep.kpi.billingRate`, `pep.kpi.billingRateTooltip`, `pep.kpi.billableHours`, `pep.kpi.billableHoursTooltip`.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Angular page:** [`apps/tagea-frontend/src/app/pages/pep-page/pep-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/pep-page/pep-page.component.ts)
- **Sub-component:** `PepScheduleComponent` at `apps/tagea-frontend/src/app/pages/pep-page/pep-schedule/pep-schedule.component.ts`
- **Service + model:** `PepService`, `TimeAccountOverviewEntry`, `PerformanceKpis`, `PepScheduleData` at `apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts` + `pep.model.ts`
- **KPI card:** `EntityKpiCardComponent` + `EntityKpiValue` at `apps/tagea-frontend/src/app/reports/components/entity-kpi-card/entity-kpi-card.component.ts`
- **Route:** `apps/tagea-frontend/src/app/routes/institution.routes.ts` (path `pep`, guards `permissionGuard` + `pepFeatureGuard`)
- **Backend controller:** `apps/tagea-backend/src/workforce-planning/controllers/time-account.controller.ts`
- **Backend endpoints:** see [contracts.md](./contracts.md)
