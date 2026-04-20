# Contracts: Dashboard

## Services

| Service                 | Methods (indicative)                                     | Purpose               |
| ----------------------- | -------------------------------------------------------- | --------------------- |
| `DashboardDataService`  | `getKpis()`, `getRecentActivity()` (or similar — verify) | KPI + timeline data   |
| `AppointmentsService`   | used for "new appointment" dialog                        | Creation              |
| `UnifiedAuthService`    | `employee()` signal                                      | Welcome-name source   |
| `TenantFeaturesService` | feature flags                                            | Toggle KPI visibility |

## Data Models

```ts
// Component-local
interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  timestamp: Date;
  status?: 'aktiv' | 'abgeschlossen' | 'pending';
}

// From reports module — used by EntityKpiCardComponent
interface EntityKpiValue {
  label: string;
  value: number | string;
  delta?: number;
  // + metadata
}
```

> Exact `DashboardDataService` API lives in [`dashboard-data.service.ts`](../../../apps/tagea-frontend/src/app/services/dashboard-data.service.ts); Flutter port reads there for final wiring.
