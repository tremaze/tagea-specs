# Parity: Dashboard

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/dashboard/dashboard-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2, staff-facing; client MVP doesn't include staff dashboard)
- Spec is for documentation / future consideration.

## Known Divergences

| Topic     | Angular                     | Flutter (if ported)                 |
| --------- | --------------------------- | ----------------------------------- |
| KPI tiles | `EntityKpiCardComponent`    | `KpiCard` widget                    |
| Timeline  | `ActivityTimelineComponent` | `ListView` with custom item builder |
| Dialogs   | `MatDialog`                 | `showDialog`                        |

## Port Log

| Date       | Who      | What                                          |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (non-goal scope — documentation) |
