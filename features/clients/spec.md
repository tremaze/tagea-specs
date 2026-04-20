# Feature: Clients List

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff clients list at `/einrichtung/:institutionId/clients`. Table/card view of all clients in the institution with search, filters, and quick-create. Tapping a row opens `/einrichtung/:id/profile/:clientId` (see [profile-detail](../profile-detail/spec.md) — P2, not specced yet).

## User Stories

- As a **staff member** I want a searchable list of all clients in my institution, so that I can quickly find any client.
- As a **staff member** I want to create a new client from here, so that onboarding is one-step.
- As a **staff member** I want multi-criteria filtering (status, employee, date range, etc.), so that I can triage caseloads.

## Acceptance Criteria

### List

- [ ] **Given** the page loads, **When** `ClientsDataService` / `BasicClientService` resolve, **Then** clients render as rows (desktop) or cards (mobile), showing name, age, assigned employee (with color chip via `getEmployeeColor`), and status indicators.
- [ ] **Given** a text search is entered, **When** the user pauses (debounce), **Then** the server performs a search query and the list updates.
- [ ] **Given** filter chips / dropdowns render (status, employee, date range), **When** any filter changes, **Then** the list reloads.
- [ ] **Given** the viewport is mobile, **When** the filters FAB fires, **Then** `ClientFiltersBottomSheetComponent` opens.
- [ ] **Given** a row / card is tapped, **When** navigation resolves, **Then** open `/einrichtung/:institutionId/profile/:clientId`.

### Create / edit / delete

- [ ] **Given** the user presses "New client", **When** the dialog opens, **Then** `ClientDialogComponent` is shown with an empty form.
- [ ] **Given** the user chooses "Delete" from a row's menu, **When** the confirm dialog resolves, **Then** `DeleteConfirmationDialogComponent` lists related entities (cases, appointments) for context before committing the delete.
- [ ] **Given** permission `clients.edit` is missing, **When** the row menu renders, **Then** delete / edit actions are hidden via `HasPermissionDirective`.

## UI States

| State     | When?                   | Rendering                      |
| --------- | ----------------------- | ------------------------------ |
| Loading   | Initial fetch           | Spinner                        |
| Empty     | No clients match filter | Empty-state + "New client" CTA |
| Populated | Clients visible         | Search + filters + table/cards |
| Error     | Fetch failure           | Error panel + retry            |

## Non-Goals

- **Bulk operations** (bulk-assign employee, bulk-delete) — not in scope.
- **Inline editing** in the list — only via dialog or detail page.

## Edge Cases

- **Client without assigned employee** — chip omitted; filter by "unassigned" supported.
- **Archived clients** — toggled via a filter chip; default view may exclude them.
- **Soft-delete vs hard-delete** — `DeleteConfirmationDialogComponent` surfaces related-entity count; actual semantics owned by `BasicClientService`.
- **Permission-gated actions** — `HasPermissionDirective` hides menu entries; verify which permission flags which action.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'clients.view'`.
- **Edit/delete gated by:** `clients.edit` (via `HasPermissionDirective`).
- **Feature guards:** `HasFeatureDirective` hides feature-flagged UI.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Not a push target. Clients list reflects backend state on reload.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific (if ported):**

- P2 / non-goal for Flutter. Documentation only.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/clients-page/clients-page.ts`](../../../apps/tagea-frontend/src/app/pages/clients-page/clients-page.ts)
- **Services:** `BasicClientService`, `ClientsDataService`, `UnifiedAuthService`, `EmployeesService`
- **Models:** `ClientData`
- **Dialogs:** `ClientDialogComponent`, `DeleteConfirmationDialogComponent`
- **Filter sheet:** `ClientFiltersBottomSheetComponent`
- **Directives:** `HasPermissionDirective`, `HasFeatureDirective`
- **Utilities:** `getEmployeeColor`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
