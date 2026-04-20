# Contracts: Reports

## Structure

Reports live in the lazy-loaded module `apps/tagea-frontend/src/app/reports/`:

- Routes: [`reports-routing.module.ts`](../../../apps/tagea-frontend/src/app/reports/reports-routing.module.ts)
- Pages: `pages/{reports-list,report-builder,report-detail}/*`
- Components: `components/*` (field selector, filter builder, grouping/sorting config, preview, history, info cards, KPI card)
- Dialogs: `components/{report-duplicate-dialog,report-progress-dialog,caridata-submission-dialog,confirm-dialog}/*`

Services + data models live adjacent to the components. Exact service names + method signatures are inside the module — Flutter port (if ever attempted) should browse the folder as the authoritative source.

## KPI card

`EntityKpiCardComponent` (also used by [dashboard](../dashboard/spec.md) and [pep](../pep/spec.md)) renders `EntityKpiValue` tiles with label + value + optional delta.

## External integrations

- **Caridata submission** — `CaridataSubmissionDialogComponent` submits report output to an external Caridata system. Tenant-configured endpoint; only certain entity types / report shapes are eligible.

> **Flutter port note:** Reports are a heavyweight admin feature (builder with dynamic field selection, nested filter groups, live preview). Porting cost is high; scope is ❌ for Flutter MVP.
