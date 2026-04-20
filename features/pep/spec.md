# Feature: PEP (Personaleinsatzplanung)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Personnel deployment / time-account page at `/einrichtung/:institutionId/pep`. Shows staff time-account overview (`TimeAccountOverviewEntry[]`), KPIs (`PerformanceKpis`), and a schedule sub-view for personnel planning. Tabbed layout for account vs. schedule.

## User Stories

- As an **admin** I want to see each staff member's time-account (overtime, vacation, sick days), so that I can balance workloads.
- As an **admin** I want a schedule view, so that I can plan shifts and see capacity.
- As an **admin** I want KPIs at a glance, so that I know whether the institution is on track.

## Acceptance Criteria

- [ ] **Given** the page loads, **When** `PepService` resolves, **Then** the overview tab shows a `MatTable` of `TimeAccountOverviewEntry` rows (employee, balance, overtime, vacation taken/left, sick days, progress bars).
- [ ] **Given** KPIs resolve, **When** tiles render, **Then** `EntityKpiCardComponent` displays `PerformanceKpis` (exact KPI set: verify against component).
- [ ] **Given** the user switches to the Schedule tab, **When** the tab activates, **Then** `PepScheduleComponent` renders the personnel schedule.
- [ ] **Given** a filter select changes (time range / employee / group), **When** the selection fires, **Then** the table + KPIs reload.

## UI States

| State                    | When?             | Rendering                 |
| ------------------------ | ----------------- | ------------------------- |
| Loading                  | Fetch in-flight   | Spinner                   |
| Populated (overview tab) | Entries visible   | KPIs + time-account table |
| Populated (schedule tab) | Schedule rendered | `PepScheduleComponent`    |
| Error                    | Fetch failure     | Error text                |

## Non-Goals

- **Direct schedule editing** — schedule is viewer-only here; edits happen in `ShiftTemplatesAdminComponent` (einstellungen).
- **Payroll integration** — separate Gehaltsnachweise feature.

## Edge Cases

- **Employee without a time-account entry** — excluded from the table; "missing setup" indicator may show in the detail view.
- **Fractional overtime (negative hours)** — displayed with sign; progress bar colors reflect direction.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'employees.view'`.
- **Feature guard:** `pepFeatureGuard`.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Not a push target.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/pep-page/pep-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/pep-page/pep-page.component.ts)
- **Sub-component:** `PepScheduleComponent` at `apps/tagea-frontend/src/app/pages/pep-page/pep-schedule/pep-schedule.component.ts`
- **Service + model:** `PepService`, `TimeAccountOverviewEntry`, `PerformanceKpis` at `apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts` + `pep.model.ts`
- **KPI card:** `EntityKpiCardComponent` + `EntityKpiValue`
- **Backend endpoints:** see [contracts.md](./contracts.md)
