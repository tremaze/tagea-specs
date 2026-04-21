# Feature: Dashboard (Institution)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Staff dashboard at `/einrichtung/:institutionId/dashboard`. Personalized welcome header, a compact statistics strip (today's / week's appointments, new clients, optional Docs-Score), an optional working-time KPI card for tenants with the PEP feature, a "next appointment" card, and a Quick-Actions row (new client / go to calendar / new employee).

## User Stories

- As a **staff member** I want a quick overview of today's relevant activity, so that I can orient myself when I log in.
- As a **staff member** I want to jump into common flows (create client, open calendar, create employee) without navigating menus.
- As a **staff member with PEP** I want to see my own working-time balance, utilization, and billing rate for the current month.

## Acceptance Criteria

### Welcome header

- [ ] **Given** the page loads, **When** the employee signal resolves, **Then** the header shows "Welcome back, {firstName}" (falls back to `dashboard.employee` when no first name is available) plus a help-tooltip button for the `dashboard-overview` article.

### Statistics strip

- [ ] **Given** `DashboardDataService.loadIfNeeded()` completes, **When** the tiles render, **Then** they display `appointmentsToday`, `appointmentsThisWeek`, and `newClientsThisMonth` from `DashboardKPIs`.
- [ ] **Given** the tenant has the `tasks` feature enabled, **When** the strip renders, **Then** a fourth "Docs-Score" tile is shown that links to `/tasks`, displays the score as a percentage with a colored dot (green ≥ 80, yellow ≥ 50, red otherwise), shows "—" when `totalCases === 0`, and a `{valid}/{total}` case counter underneath.

### Working-time KPIs (PEP only)

- [ ] **Given** `TenantFeaturesService.isPepEnabled()` is true **and** `GET /dashboard/time-account-kpis` resolves, **Then** an `EntityKpiCardComponent` with icon `schedule` renders three KPIs: **Balance** (formatted `±H:MM` from `balance_minutes`, type `duration`), **Utilization** (`utilization_percent%`, type `percentage`), **Billing Rate** (`billing_rate_percent%`, type `percentage`).
- [ ] **Given** PEP is disabled **or** the time-account request fails, **Then** the working-time section is not shown (failure silently clears the signal).

### Next-appointment card

- [ ] **Given** `nextAppointment()` signal resolves non-null, **Then** a card shows the appointment title, start datetime (locale `de-DE`, weekday + date + time), optional location, optional primary client name (`last_name, first_name`), and an icon inferred from template name (`psychology` / `phone_in_talk` / `groups` / `home` / `video_call` / default `event`).
- [ ] **Given** the user taps "Show details", **When** the full appointment loads, **Then** `AppointmentDialogV2Component` opens in mode `edit`; on close with result the next-appointment signal refreshes.
- [ ] **Given** loading the full appointment fails, **Then** a snackbar "Termin konnte nicht geladen werden" appears for 3 s.

### Quick Actions

- [ ] **Given** the user presses "New client", **Then** `ClientDialogComponent` opens with `data: { mode: 'create' }`; on close with a result the router navigates to `institutionRoute(id, 'profile', result.id)`.
- [ ] **Given** the user presses "Go to calendar", **Then** the router navigates to `institutionRoute(id, 'calendar')`.
- [ ] **Given** the user has `employees.create` permission and presses "New employee", **Then** `EmployeeDialogComponent` opens with `data: { mode: 'create' }`. The tile is hidden when the permission is absent.

## UI States

| State                       | When?                                            | Rendering                                                                                     |
| --------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Loading                     | Initial fetch (`DashboardDataService.loading()`) | Spinner / skeleton                                                                            |
| Populated                   | KPIs resolved                                    | Header + stats strip + (optional) time-KPI card + (optional) next-appointment + quick actions |
| Error                       | `DashboardDataService.error()` non-null          | Error panel + retry                                                                           |
| No next appointment         | `nextAppointment()` is null                      | Next-appointment section hidden                                                               |
| PEP disabled or TA kpi null | `!isPepEnabled()` or `timeAccountKpis()` null    | Time-KPI section hidden                                                                       |

## Non-Goals

- **Full BI / analytics** — separate [reports](../reports/spec.md) feature.
- **Cross-institution aggregation** — dashboard is scoped to the active institution only.
- **Server-driven activity timeline** — the Activity-Timeline imported by the component is currently fed from hard-coded sample data and is not part of the primary rendered flow. A real feed is out of scope for this spec.

## Edge Cases

- **Tenant feature flags** — `TenantFeaturesService.isTasksEnabled()` hides the Docs-Score tile; `isPepEnabled()` hides the time-account KPI section and skips `GET /time-account-kpis`.
- **No cases** — Docs-Score shows "—" and the "no cases" copy instead of the `valid/total` counter.
- **Missing employee context** — `DashboardDataService.load()` is a no-op if `UnifiedAuthService.employee()` is null.
- **Missing `employees.create` permission** — the "New employee" quick-action card is suppressed.

## Permissions & Tenant/Institution

- **Required permission:** `PERMISSIONS.DASHBOARD_VIEW` (backend `@Auth` on both endpoints). Frontend reads the same via route guard setup on the dashboard route.
- **Feature guard:** `/time-account-kpis` requires tenant feature `pep` via `FeatureGuard` + `@RequireFeature('pep')`.
- **Institution context:** from the URL (`:institutionId`), resolved server-side through the `INSTITUTION_ROUTE_PREFIX` on the controller.

## Notifications (Push / In-App)

- Not a primary push target.
- After closing the appointment-details dialog with a changed result, the next-appointment signal is refreshed.

## i18n Keys

> User-facing strings remain in German.

- `dashboard.welcomeBack` (with `{{ name }}` placeholder), `.todayOverview`, `.helpTooltip`, `.employee`
- `dashboard.statistics`, `.statisticsSubtitle`, `.appointmentsToday`, `.appointmentsThisWeek`, `.newClientsThisMonth`, `.docsScore`, `.casesCount` (with `{{ valid }}` / `{{ total }}`), `.noCases`
- `dashboard.tooltipAppointmentsToday`, `.tooltipAppointmentsWeek`, `.tooltipNewClients`, `.tooltipDocsScore`, `.tooltipNewClient`, `.tooltipCalendar`
- `dashboard.timeKpi.title`, `.timeKpi.balance`, `.timeKpi.balanceTooltip`, `.timeKpi.utilization`, `.timeKpi.utilizationTooltip`, `.timeKpi.billingRate`, `.timeKpi.billingRateTooltip`
- `dashboard.nextAppointment`, `.nextAppointmentSubtitle`, `.showDetails`
- `dashboard.quickActions`, `.quickActionsSubtitle`, `.createNewClient`, `.createNewClientDesc`, `.goToCalendar`, `.goToCalendarDesc`, `.createNewEmployee`, `.createNewEmployeeDesc`

## Offline Behavior

**Flutter-specific:**

- Cached KPI snapshot available offline with "last updated" banner.
- Quick-create dialogs require online — block when offline.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts)
- **Services:** `DashboardService`, `DashboardDataService`, `AppointmentsService`, `UnifiedAuthService`, `TenantFeaturesService`
- **Dialogs:** `ClientDialogComponent`, `EmployeeDialogComponent`, `AppointmentDialogV2Component`
- **Components:** `EntityKpiCardComponent` (Time-KPI card), `ActivityTimelineComponent` (imported, currently sample-data only), `HelpButtonComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
