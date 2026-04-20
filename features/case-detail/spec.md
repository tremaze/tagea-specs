# Feature: Case Detail

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Tabbed case-detail page at `/einrichtung/:institutionId/cases/:id/**`. `CaseDetailLayoutComponent` hosts the shell; child routes define tabs for Overview, Appointments, Financial, Approvals, Data, Reminders, and Documents. Unsaved-changes guard prevents accidental data loss across tabs.

## User Stories

- As a **staff member** I want to see everything about a case in one place with tab navigation, so that I can drill into specifics without losing context.
- As a **staff member** I want feature-flag-gated tabs (financial / approvals), so that irrelevant tabs don't appear for my tenant.
- As a **staff member** I want unsaved-changes protection, so that I don't lose edits by switching tabs.

## Tabs

From `CASE_CHILD_ROUTES` in `routes/case.routes.ts`:

| Tab                | Path           | Component                      | Feature gate                   |
| ------------------ | -------------- | ------------------------------ | ------------------------------ |
| Overview (default) | `overview`     | `CaseOverviewTabComponent`     | —                              |
| Appointments       | `appointments` | `CaseAppointmentsTabComponent` | —                              |
| Financial          | `financial`    | `CaseFinancialTabComponent`    | `financialSupportFeatureGuard` |
| Approvals          | `approvals`    | `CaseApprovalsTabComponent`    | `approvalsFeatureGuard`        |
| Data               | `data`         | `CaseDataTabComponent`         | —                              |
| Reminders          | `reminders`    | `CaseRemindersTabComponent`    | —                              |
| Documents          | `documents`    | `CaseDocumentsTabComponent`    | —                              |

## Acceptance Criteria

- [ ] **Given** the user opens `/cases/:id`, **When** the route activates, **Then** `CaseDetailLayoutComponent` loads and redirects to `overview` by default (`path: '', redirectTo: 'overview'`).
- [ ] **Given** a feature-flag-gated tab is configured off, **When** the user attempts its URL, **Then** the feature guard blocks activation.
- [ ] **Given** `UnsavedChangesGuard` is `canDeactivate` on the layout, **When** the user navigates away from the route with a dirty form, **Then** the confirmation dialog shows.

### Per-tab highlights (compact)

- [ ] **Overview:** summary fields + status + quick actions.
- [ ] **Appointments:** list of appointments tied to the case; tap opens appointment detail.
- [ ] **Financial:** financial-support records + templates (feature-gated).
- [ ] **Approvals:** approval-link management (feature-gated).
- [ ] **Data:** custom fields + stammdaten.
- [ ] **Reminders:** reminder rules + timeline.
- [ ] **Documents:** attached documents + upload.

## UI States

| State      | When?             | Rendering                        |
| ---------- | ----------------- | -------------------------------- |
| Loading    | Fetching case     | Spinner                          |
| Populated  | Case resolved     | Tab bar + active tab content     |
| Dirty form | User edited a tab | Save/discard affordances per tab |
| Error      | Fetch failure     | Error panel + retry              |

## Non-Goals

- **Case creation** — happens from [cases](../cases/spec.md) via dialog.
- **Bulk operations across tabs** — each tab handles its own concern.

## Edge Cases

- **Deep-link to a feature-gated tab when feature is off** — guard denies; user lands on overview.
- **Case with orphaned appointments** — appointments that were severed from the case still appear in a fallback list.

## Permissions & Tenant/Institution

- **Route-level guards on `cases/:id`:** only `canDeactivate: [UnsavedChangesGuard]`. The route has **no** `permissionGuard` of its own and does **not** inherit `cases.view` from the sibling `cases` list route (Angular child routes do not inherit sibling `canActivate` guards).
- **Effective access gate:** the `INSTITUTION_PARENT_ROUTE` applies `institutionUrlGuard`, which validates the institution context. Per-tab feature guards (table above) handle finer-grained access for tabs.
- **`UnsavedChangesGuard`** applied at the layout via route-level `canDeactivate`.

## References

- **Route file:** [`apps/tagea-frontend/src/app/routes/case.routes.ts`](../../../apps/tagea-frontend/src/app/routes/case.routes.ts)
- **Layout component:** `CaseDetailLayoutComponent` at [`apps/tagea-frontend/src/app/pages/case-detail-page/case-detail-layout.component.ts`](../../../apps/tagea-frontend/src/app/pages/case-detail-page/case-detail-layout.component.ts)
- **Tab components:** `case-detail-page/tabs/case-{overview,appointments,financial,approvals,data,reminders,documents}-tab.component.ts`
- **Feature guards:** `financialSupportFeatureGuard`, `approvalsFeatureGuard`
- **Backend endpoints:** see [contracts.md](./contracts.md)
