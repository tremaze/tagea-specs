# Feature: Reports (Berichte)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Tenant reporting suite at `/einrichtung/:institutionId/reports/**` (lazy-loaded). Dashboard → list → builder → detail flow. Users browse KPI-style reports, build custom ones via a field-picker + filter/group/sort configuration, run them, and download results.

## User Stories

- As an **admin** I want an overview of all configured reports, so that I know what's available.
- As an **admin** I want to build a custom report, so that I can pull data specific to my question.
- As an **admin** I want to view a report's results + history, so that I can trace numbers back.

## Sub-Routes

| Path               | Component                   | Purpose                     |
| ------------------ | --------------------------- | --------------------------- |
| `/reports`         | `ReportsDashboardComponent` | KPI dashboard + entry point |
| `/reports/list`    | `ReportsListComponent`      | All configured reports      |
| `/reports/builder` | `ReportBuilderComponent`    | Create / edit a report      |
| `/reports/:id`     | `ReportDetailComponent`     | Run + view + history        |

## Acceptance Criteria

### Dashboard

- [ ] **Given** the user opens `/reports`, **When** `ReportsDashboardComponent` loads, **Then** KPI tiles + shortcuts render.

### List

- [ ] **Given** the user opens `/reports/list`, **When** the list resolves, **Then** reports render with title, entity type, last run, and actions.

### Builder

- [ ] **Given** the user opens `/reports/builder`, **When** the builder loads, **Then** they can:
  - select an **entity** (clients / appointments / cases / etc.)
  - pick fields via `ReportFieldSelectorComponent`
  - configure filters via `ReportFilterBuilderComponent`
  - configure grouping via `ReportGroupingConfigComponent`
  - configure sorting via `ReportSortingConfigComponent`
  - preview via `ReportPreviewComponent`
- [ ] **Given** the user saves, **When** the payload submits, **Then** a new report definition is persisted and they are routed to `/reports/:id`.
- [ ] **Given** the user duplicates an existing report, **When** `ReportDuplicateDialogComponent` confirms, **Then** a cloned definition is created and opened in the builder.

### Detail

- [ ] **Given** the user opens `/reports/:id`, **When** the detail loads, **Then** report definition + last-run preview + `ReportHistoryComponent` render.
- [ ] **Given** the user runs the report, **When** execution starts, **Then** `ReportProgressDialogComponent` shows live progress; on complete, results render in `ReportPreviewComponent`.
- [ ] **Given** the tenant has Caridata submission enabled, **When** the corresponding action fires, **Then** `CaridataSubmissionDialogComponent` opens for external-system submission.

## UI States

| State            | When?            | Rendering                             |
| ---------------- | ---------------- | ------------------------------------- |
| Loading          | Any fetch        | Spinner                               |
| Populated        | Data rendered    | Sub-route-specific UI                 |
| Running (detail) | Report execution | `ReportProgressDialogComponent` modal |
| Error            | Failure          | Error text + retry                    |

## Non-Goals

- **Scheduled reports / email delivery** — verify; may or may not be scoped into this feature.
- **Cross-tenant aggregation** — scoped per institution.

## Edge Cases

- **Large report results** — pagination or truncation inside the preview; verify behavior.
- **Filter builder complexity** — nested AND/OR groups; field-type-specific operators live in `ReportFilterBuilderComponent`.
- **History retention** — backend retention policy unknown; UI surfaces whatever the backend returns.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'reports.view'`.
- **Feature guard:** `reportsFeatureGuard`.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Report-run complete could trigger a notification for long-running reports — verify.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal (admin analytics tool).

## References

- **Route module:** [`apps/tagea-frontend/src/app/reports/reports-routing.module.ts`](../../../apps/tagea-frontend/src/app/reports/reports-routing.module.ts)
- **Module:** [`apps/tagea-frontend/src/app/reports/reports.module.ts`](../../../apps/tagea-frontend/src/app/reports/reports.module.ts)
- **Sub-pages:** `ReportsDashboardComponent`, `ReportsListComponent`, `ReportBuilderComponent`, `ReportDetailComponent`
- **Sub-components:** `ReportDefinitionComponent`, `ReportFieldSelectorComponent`, `ReportFilterBuilderComponent`, `ReportGroupingConfigComponent`, `ReportSortingConfigComponent`, `ReportPreviewComponent`, `ReportHistoryComponent`, `ReportInfoCardComponent`, `ReportInfoBottomSheetComponent`, `EntityKpiCardComponent`
- **Dialogs:** `ReportDuplicateDialogComponent`, `ReportProgressDialogComponent`, `CaridataSubmissionDialogComponent`, `ConfirmDialogComponent`
- **Backend endpoints:** see [contracts.md](./contracts.md)
