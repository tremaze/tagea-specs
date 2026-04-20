# Contracts: PEP

## Service

`PepService` at [`apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts`](../../../apps/tagea-frontend/src/app/pages/pep-page/pep.service.ts). Exact method signatures in the file.

## Data Models

```ts
// apps/tagea-frontend/src/app/pages/pep-page/pep.model.ts
interface TimeAccountOverviewEntry {
  // Per-employee time-account summary: employee id/name, balance,
  // overtime, vacation taken/left, sick days, etc.
}

interface PerformanceKpis {
  // Tenant-wide or institution-wide personnel KPIs rendered in
  // EntityKpiCardComponent tiles.
}
```

Exact field set is in the model file; Flutter port reads there.

## Tabs

- `overview` — time-account table + KPI tiles (`EntityKpiCardComponent`)
- `schedule` — renders `PepScheduleComponent`
