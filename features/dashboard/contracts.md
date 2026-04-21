# Contracts: Dashboard

## Backend Endpoints

All endpoints mounted under `INSTITUTION_ROUTE_PREFIX + '/dashboard'` — effective path `/api/institution/:institutionId/dashboard/...`.

| Method | Path                 | Auth / Guard                                                                                                             | Purpose                                                                                                |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/kpis`              | `@Auth({ scope: 'institution', permissions: [PERMISSIONS.DASHBOARD_VIEW] })`                                             | Appointment + client + case KPIs for the current employee.                                             |
| `GET`  | `/time-account-kpis` | `FeatureGuard` + `@RequireFeature('pep')` + `@Auth({ scope: 'institution', permissions: [PERMISSIONS.DASHBOARD_VIEW] })` | Personal working-time KPIs (current month). Only available when PEP feature is enabled for the tenant. |

## Services (Frontend)

| Service                 | Public API                                                                                                                                                                                                                                                                                                                                                     | Purpose                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `DashboardService`      | `getDashboardKPIs(): Observable<DashboardKPIs>`, `getTimeAccountKpis(): Observable<EmployeeDashboardTimeKpis>`                                                                                                                                                                                                                                                 | HTTP client wrapping the backend dashboard endpoints.      |
| `DashboardDataService`  | signals `kpis`, `nextAppointment`, `timeAccountKpis`, `loading`, `error`, `isLoaded`; computed signals `appointmentsToday`, `appointmentsThisWeek`, `clientsThisMonth`, `openDocumentations`, `docsScore`, `validCasesCount`, `totalCases`; methods `loadIfNeeded()`, `refresh()`, `refreshNextAppointment()`, `updateNextAppointment(appointment)`, `clear()` | Signal-based facade used by `DashboardPageComponent`.      |
| `AppointmentsService`   | `getUpcomingAppointments(employeeId, limit)`, `getAppointment(id)`                                                                                                                                                                                                                                                                                             | Used for "next appointment" card and details dialog.       |
| `UnifiedAuthService`    | `employee()` signal, `institutionId()` signal, `hasPermission(key)`                                                                                                                                                                                                                                                                                            | Welcome-name source and permission gating.                 |
| `TenantFeaturesService` | `isPepEnabled()`, `isTasksEnabled()`                                                                                                                                                                                                                                                                                                                           | Feature flags toggle Docs-Score tile and Time-KPI section. |

## Data Models

### Wire shapes (from backend DTOs)

```ts
// DashboardKPIsDto → GET /dashboard/kpis
interface DashboardKPIs {
  appointmentsToday: number;
  appointmentsThisWeek: number;
  newClientsThisMonth: number;
  openDocumentations: number; // currently not implemented on backend, always 0
  docsScore: number; // 0–100
  validCasesCount: number;
  totalCases: number;
}

// EmployeePerformanceKpis → GET /dashboard/time-account-kpis
interface EmployeeDashboardTimeKpis {
  balance_minutes: number;
  utilization_percent: number;
  billing_rate_percent: number;
}
```

### Component-local / reused types

```ts
// From reports module — used by EntityKpiCardComponent for the Time KPI section
type KpiValueType = 'count' | 'duration' | 'percentage';

interface EntityKpiValue {
  label: string;
  value: number | string;
  type: KpiValueType;
  tooltip?: string;
}

// Sample data structure used by the embedded mock activity list (component-local,
// not driven by a backend endpoint today). ActivityTimelineComponent's own
// ActivityItem shape lives in components/activity-timeline/activity-timeline.ts.
interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  timestamp: Date;
  status?: 'aktiv' | 'abgeschlossen' | 'pending';
}
```

> Activity data is currently hard-coded in `DashboardPageComponent` — no backend `recent-activity` endpoint exists yet. Flutter port should treat the timeline as a placeholder surface until a real feed is specified.

## References

- **Backend controller:** [`apps/tagea-backend/src/dashboard/dashboard.controller.ts`](../../../apps/tagea-backend/src/dashboard/dashboard.controller.ts)
- **Backend DTO:** [`apps/tagea-backend/src/dashboard/dto/dashboard-kpis.dto.ts`](../../../apps/tagea-backend/src/dashboard/dto/dashboard-kpis.dto.ts)
- **Frontend HTTP service:** [`apps/tagea-frontend/src/app/services/dashboard.service.ts`](../../../apps/tagea-frontend/src/app/services/dashboard.service.ts)
- **Frontend facade:** [`apps/tagea-frontend/src/app/services/dashboard-data.service.ts`](../../../apps/tagea-frontend/src/app/services/dashboard-data.service.ts)
