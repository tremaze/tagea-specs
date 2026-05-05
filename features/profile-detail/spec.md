# Feature: Profile Detail (Client)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Tabbed client-profile page at `/einrichtung/:institutionId/profile/:id/**`. `ProfileLayoutComponent` hosts the shell; 11 child-route tabs cover all aspects of a client's record: overview, appointments, stammdaten, relationships, financial, reminders, documents, messages, cases, reports.

## User Stories

- As a **staff member** I want to see everything about a client in one place with tab navigation, so that I can switch aspects without losing context.
- As a **staff member** I want feature-flag-gated tabs, so that irrelevant surfaces don't appear.
- As a **staff member editing stammdaten** I want unsaved-changes protection, so that I don't lose edits mid-flow.

## Tabs

From `PROFILE_CHILD_ROUTES` in `routes/profile.routes.ts`:

| Tab                | Path                | Component                          | Extra guard                                             |
| ------------------ | ------------------- | ---------------------------------- | ------------------------------------------------------- |
| Overview (default) | `overview`          | `ProfileOverviewTabComponent`      | —                                                       |
| Appointments       | `appointments`      | `ProfileAppointmentsTabComponent`  | —                                                       |
| Stammdaten         | `stammdaten`        | `ProfileStammdatenTabComponent`    | `canDeactivate: UnsavedChangesGuard` (on this tab only) |
| Relationships      | `relationships`     | `ProfileRelationshipsTabComponent` | —                                                       |
| Financial          | `financial`         | `ProfileFinancialTabComponent`     | `financialSupportFeatureGuard`                          |
| Reminders          | `reminders`         | `ProfileRemindersTabComponent`     | —                                                       |
| Documents          | `documents`         | `ProfileDocumentsTabComponent`     | —                                                       |
| Messages           | `messages`          | `ProfileMessagesTabComponent`      | —                                                       |
| Cases              | `cases`             | `ProfileCasesTabComponent`         | `caseFeatureGuard`                                      |
| Reports            | `reports`           | `ProfileReportsTabComponent`       | `clientReportsFeatureGuard`                             |
| Report Detail      | `reports/:reportId` | `ClientReportEditorComponent`      | `clientReportsFeatureGuard`                             |

## Acceptance Criteria

- [ ] **Given** the user opens `/profile/:id`, **When** the route activates, **Then** `ProfileLayoutComponent` loads and redirects to `overview` by default.
- [ ] **Given** the parent route sets `PROFILE_BASE_GUARDS = { canActivate: [permissionGuard], data: { requiredPermission: 'clients.view' } }`, **When** a user without `clients.view` attempts access, **Then** `permissionGuard` blocks.
- [ ] **Given** the Stammdaten tab has `canDeactivate: [UnsavedChangesGuard]`, **When** the user navigates away with a dirty form, **Then** the confirmation dialog shows (only for this tab — other tabs don't have the guard applied).
- [ ] **Given** a feature-flag-gated tab is disabled, **When** the user attempts its URL, **Then** the corresponding feature guard blocks activation.

### Per-tab highlights (compact)

- [ ] **Overview:** client summary + recent activity.
- [ ] **Appointments:** client's appointments list.
- [ ] **Stammdaten:** form-heavy; `UnsavedChangesGuard` applies. Tab label is "Profil" in the German UI.
- [ ] **Relationships:** family / managed-client links.
- [ ] **Financial:** financial-support records (feature-gated).
- [ ] **Reminders:** reminder rules for the client.
- [ ] **Documents:** attached documents.
- [ ] **Messages:** message history with the client.
- [ ] **Cases:** cases the client is involved in (feature-gated).
- [ ] **Reports:** list of reports for the client (feature-gated); tapping opens `reports/:reportId` with `ClientReportEditorComponent`.

### Stammdaten / Profil missing-fields badge

The "Profil" tab renders a numeric badge next to its label that signals how many required or statistic-relevant client fields are still empty. The count comes from two sources that the layout merges into a single computed value:

- **Server count** — `client.invalid_fields`, recalculated by the `update_client_validity` PG trigger whenever `clients` rows or related `custom_field_values` change. Includes both client custom fields (`is_required` ∨ `is_statistic_relevant`) and client entity fields listed in `statistic_relevant_entity_fields` (driven by reports' `validation_rules.required_entity_fields` for `entity: 'client'`).
- **Live count** — computed in the Stammdaten tab from current form state, updated as the user types so the badge reflects unsaved edits without a round-trip.

- [ ] **Given** the user opens a client and has not visited the Stammdaten tab in this session, **When** the layout renders, **Then** the badge shows the server count `client.invalid_fields` (or hides if `0`).
- [ ] **Given** the Stammdaten tab has been mounted at least once, **When** the user edits any field, **Then** the badge updates live from form state — without requiring a save.
- [ ] **Given** the user saves the Stammdaten or custom fields, **When** the API responds with the updated client, **Then** the live count is reset to the server count from the response — server stays the source of truth across saves.
- [ ] **Given** an admin marks a client field as statistic-relevant via a report's `validation_rules`, **When** the next page load happens for any affected client, **Then** the badge reflects the new requirement (DB trigger has already updated `clients.invalid_fields`).
- [ ] **Given** a tenant with `tenantFeaturesService.isTasksEnabled() === false`, **When** the layout renders, **Then** the badge is suppressed regardless of count.

### Repeating-group custom fields — local edit persistence

When a custom-field group is configured as `is_repeating`, the Stammdaten/Profil tab renders it as a card that opens a side-panel dialog (`TageaFieldGroupDialogComponent`) for editing. All edits within a session — newly added rows, edits on existing rows, and row deletions — are tracked on the parent (`TageaCustomFieldsComponent`) and survive close/reopen of the side panel. Persistence ends only on save or on confirmed discard via `UnsavedChangesGuard` / `discardChanges()`.

- [ ] **Given** the user adds a row in the side panel and closes it without saving, **When** they reopen the same group, **Then** the previously-added row is still visible with the same field values.
- [ ] **Given** the user edits an existing row's field in the side panel and closes without saving, **When** they reopen, **Then** the edited value is shown — not the server value.
- [ ] **Given** the user deletes a row in the side panel and closes without saving, **When** they reopen, **Then** the row stays hidden (deletion is part of the local change set until save).
- [ ] **Given** the user saves successfully, **When** the response arrives, **Then** the local change set is cleared, server-loaded rows replace tempIds, and the side panel reflects the server-acknowledged state on next open.
- [ ] **Given** the user discards via `UnsavedChangesGuard`, **When** the discard is confirmed, **Then** the local change set is cleared and the side panel returns to the server state on next open.

## UI States

| State                   | When?           | Rendering                    |
| ----------------------- | --------------- | ---------------------------- |
| Loading                 | Fetching client | Spinner                      |
| Populated               | Client resolved | Tab bar + active tab content |
| Dirty form (Stammdaten) | User edited     | Save/discard affordances     |
| Error                   | Fetch failure   | Error panel + retry          |

## Non-Goals

- **Client creation** — happens via [clients](../clients/spec.md) list dialog.
- **Bulk operations** — single-client view only.

## Edge Cases

- **Client without any cases** — Cases tab renders empty state.
- **Feature-gated tab deep-link while feature is off** — guard denies; user lands on overview.
- **Report detail sub-route** — `reports/:reportId` navigates into `ClientReportEditorComponent` inside the profile layout, keeping the tab bar visible.

## Permissions & Tenant/Institution

- **Parent permission:** `permissionGuard` with `requiredPermission: 'clients.view'` applied at the `/profile/:id` route.
- **Per-tab gates:** `financialSupportFeatureGuard`, `caseFeatureGuard`, `clientReportsFeatureGuard`, `UnsavedChangesGuard`.
- **Institution context:** URL param (`:institutionId`).

## References

- **Route file:** [`apps/tagea-frontend/src/app/routes/profile.routes.ts`](../../../apps/tagea-frontend/src/app/routes/profile.routes.ts)
- **Layout component:** `ProfileLayoutComponent` at [`apps/tagea-frontend/src/app/pages/profile-page/profile-layout.component.ts`](../../../apps/tagea-frontend/src/app/pages/profile-page/profile-layout.component.ts)
- **Tab components:** `profile-page/tabs/profile-*-tab.component.ts`
- **Report editor:** `components/client-reports/client-report-editor.component.ts`
- **Feature guards:** `financialSupportFeatureGuard`, `caseFeatureGuard`, `clientReportsFeatureGuard`
- **Backend endpoints:** see [contracts.md](./contracts.md)
