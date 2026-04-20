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
- [ ] **Stammdaten:** form-heavy; `UnsavedChangesGuard` applies.
- [ ] **Relationships:** family / managed-client links.
- [ ] **Financial:** financial-support records (feature-gated).
- [ ] **Reminders:** reminder rules for the client.
- [ ] **Documents:** attached documents.
- [ ] **Messages:** message history with the client.
- [ ] **Cases:** cases the client is involved in (feature-gated).
- [ ] **Reports:** list of reports for the client (feature-gated); tapping opens `reports/:reportId` with `ClientReportEditorComponent`.

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
