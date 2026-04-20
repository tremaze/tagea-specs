# Feature: Dashboard (Institution)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff dashboard at `/einrichtung/:institutionId/dashboard`. Personalized welcome header, KPI tiles (entity counts), activity timeline, and quick-create actions (client / employee / appointment) via dialogs.

## User Stories

- As a **staff member** I want a quick overview of today's relevant activity, so that I can orient myself when I log in.
- As a **staff member** I want one-tap create actions (new client / employee / appointment), so that I can start common flows without navigating.
- As a **staff member** I want to see my institution's KPIs, so that I have an at-a-glance sense of scale.

## Acceptance Criteria

### Welcome + KPIs

- [ ] **Given** the page loads, **When** `DashboardDataService` resolves, **Then** the header shows "Welcome back, {name}" and a help tooltip button.
- [ ] **Given** the KPI signals resolve, **When** tiles render, **Then** `EntityKpiCardComponent` instances display current counts per entity (clients, employees, cases, appointments — verify exact set in template).

### Activity timeline

- [ ] **Given** activity data resolves, **When** `ActivityTimelineComponent` renders, **Then** recent activity items are shown with icon, title, subtitle, timestamp, and optional status (`aktiv` / `abgeschlossen` / `pending`).

### Quick-create actions

- [ ] **Given** the user presses "New client", **When** the action fires, **Then** `ClientDialogComponent` opens as a dialog.
- [ ] **Given** the user presses "New employee", **When** the action fires, **Then** `EmployeeDialogComponent` opens.
- [ ] **Given** the user presses "New appointment", **When** the action fires, **Then** `AppointmentDialogV2Component` opens with mode `create`.

### Navigation

- [ ] **Given** a quick-link in the timeline or KPIs is tapped, **When** the click resolves, **Then** the user lands on the corresponding detail / list route under `institutionRoute(id, ...)`.

## UI States

| State          | When?              | Rendering                                   |
| -------------- | ------------------ | ------------------------------------------- |
| Loading        | Initial fetch      | Spinner                                     |
| Populated      | Data resolved      | Header + KPIs + timeline + quick-create bar |
| Error          | Fetch failure      | Error panel + retry                         |
| Empty timeline | No recent activity | Empty-state inside the timeline             |

## Non-Goals

- **Full BI / analytics** — separate [reports](../reports/spec.md) feature.
- **Cross-institution aggregation** — dashboard is scoped to the active institution only.

## Edge Cases

- **Tenant feature flags** — `TenantFeaturesService` may hide certain KPIs (e.g., cases if `case` feature is disabled). Verify exact conditions with the template.
- **No KPI data available** — tile shows "—" rather than zero (verify).
- **Activity timeline very long** — the component paginates or virtualizes; UI cap is component-owned.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'dashboard.view'`.
- **Institution context:** from the URL (`:institutionId`), which `institutionUrlGuard` validates.

## Notifications (Push / In-App)

- Not a primary push target.
- Activity timeline may reflect recent push-driven changes after refresh.

## i18n Keys

> User-facing strings remain in German.

- `dashboard.welcomeBack` (with `{{ name }}` placeholder), `.todayOverview`, `.helpTooltip`
- Rest owned by the external template.

## Offline Behavior

**Flutter-specific:**

- Cached KPI snapshot available offline with "last updated" banner.
- Quick-create dialogs require online — block when offline.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts)
- **Services:** `DashboardDataService`, `AppointmentsService`, `UnifiedAuthService`, `TenantFeaturesService`
- **Dialogs:** `ClientDialogComponent`, `EmployeeDialogComponent`, `AppointmentDialogV2Component`
- **Components:** `ActivityTimelineComponent`, `EntityKpiCardComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
