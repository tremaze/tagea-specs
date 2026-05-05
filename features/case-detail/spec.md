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
- [ ] **Data:** custom fields + stammdaten. Tab label is "Falldaten" in the German UI.
- [ ] **Reminders:** reminder rules + timeline.
- [ ] **Documents:** attached documents + upload.

### Falldaten missing-fields badge + invalid-appointments badge

The "Falldaten" tab renders a badge with the count of required or statistic-relevant case fields that are still empty. The "Termine" tab renders a separate badge for appointments whose `appointment.invalid_fields > 0`. Both follow the same rule: server count is the source of truth on initial render and after saves; a live count from form state takes over while the user is editing.

- [ ] **Given** the user opens a case and has not yet visited the Falldaten tab, **When** the layout renders, **Then** the Falldaten badge shows `case.invalid_fields` from the server (or hides if `0`).
- [ ] **Given** the user opens the Falldaten tab and edits fields, **When** form state changes, **Then** the badge updates live from the count of empty required/statistic-relevant fields (custom fields + repeating-group rows + statistic-relevant case entity fields).
- [ ] **Given** the user saves Falldaten, **When** the PUT response arrives, **Then** the badge resets to the response's `invalid_fields` value — server stays the source of truth.
- [ ] **Given** the case has appointments with missing required/statistic-relevant fields, **When** the appointments tab badge renders, **Then** it shows the count of appointments where `invalid_fields > 0`, derived from `case.invalid_appointments` on the server.
- [ ] **Given** an admin updates a report's `validation_rules.required_custom_fields` or `appointment_rules`, **When** `sync_statistic_relevant_fields()` runs, **Then** affected case and appointment counters are recalculated and the badges reflect the new state on next load.

### Repeating-group custom fields — local edit persistence

When a Falldaten custom-field group is configured as `is_repeating`, it renders as a card that opens a side-panel dialog (`TageaFieldGroupDialogComponent`) for editing. All edits within a session — newly added rows, edits on existing rows, and row deletions — are tracked on the parent (`TageaCustomFieldsComponent`) and survive close/reopen of the side panel. Persistence ends only on save or on confirmed discard via `UnsavedChangesGuard` / `discardChanges()`.

- [ ] **Given** the user adds a row in the side panel and closes it without saving, **When** they reopen the same group, **Then** the previously-added row is still visible with the same field values.
- [ ] **Given** the user edits an existing row's field in the side panel and closes without saving, **When** they reopen, **Then** the edited value is shown — not the server value.
- [ ] **Given** the user deletes a row in the side panel and closes without saving, **When** they reopen, **Then** the row stays hidden (deletion is part of the local change set until save).
- [ ] **Given** the user saves successfully, **When** the response arrives, **Then** the local change set is cleared, server-loaded rows replace tempIds, and the side panel reflects the server-acknowledged state on next open.
- [ ] **Given** the user discards via `UnsavedChangesGuard`, **When** the discard is confirmed, **Then** the local change set is cleared and the side panel returns to the server state on next open.

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
