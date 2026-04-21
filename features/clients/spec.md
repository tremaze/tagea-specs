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

- [ ] **Given** the page loads, **When** `ClientsDataService` / `BasicClientService` resolve, **Then** clients render as rows (desktop) or cards (mobile), showing name, birth date, counselors (Bezugsmitarbeiter) with color chip via `getEmployeeColor`, and portal-access / status indicators.
- [ ] **Given** a text search is entered, **When** the user pauses (300ms debounce), **Then** the server performs a search query and the list updates.
- [ ] **Given** filter controls render (search, phone, street, postal code, birth date, category multi-select, department), **When** any filter changes, **Then** the list reloads and category/department preferences are persisted via `EmployeesService.updateClientsFilterPreferences`.
- [ ] **Given** the viewport is mobile, **When** the filters FAB fires `openFilterSheet()`, **Then** `ClientFiltersBottomSheetComponent` opens seeded with the current filter values and the institution's departments.
- [ ] **Given** a row / card is tapped, **When** navigation resolves, **Then** open `/einrichtung/:institutionId/profile/:clientId`.
- [ ] **Given** the list is scrolled near the bottom, **When** the IntersectionObserver sentinel enters the viewport, **Then** `ClientsDataService.loadMore()` is called up to `MAX_AUTO_LOAD = 300`; beyond that a manual "Load more" button is shown.

### Create / edit / delete / portal login

- [ ] **Given** the user presses "New client", **When** the dialog opens, **Then** `ClientDialogComponent` is shown in `mode: 'create'` with an empty form; gated by `clients.create`.
- [ ] **Given** the user chooses "Edit" from a row's menu, **When** `BasicClientService.getClient(id)` resolves, **Then** `ClientDialogComponent` opens in `mode: 'edit'` with the full `Client`; gated by `clients.edit`.
- [ ] **Given** the user chooses "Delete" from a row's menu, **When** `BasicClientService.getRelatedEntities(id)` resolves, **Then** `DeleteConfirmationDialogComponent` lists related entities (cases, appointments, relationships, reminders, financial records, documents) and requires the user to type the client name (`confirmationText`) before committing `deleteClient`; gated by `clients.delete`.
- [ ] **Given** the client has `category === 'client'` and an email, **When** the user triggers "Enable login", **Then** `BasicClientService.enableClientLogin(id)` is called and an invitation email is sent; gated by `clients.enable_login`.
- [ ] **Given** `login_enabled` is true, **When** the user triggers "Disable login", **Then** `BasicClientService.disableClientLogin(id)` is called and active sessions are terminated; gated by `clients.enable_login`.

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

- **Client without counselors** — counselor chip omitted; list query still returns the client.
- **Category filter defaults to `['client']`** — related persons and contacts are excluded by default and restored from the user's persisted preferences on load.
- **Cascade-delete preview may fail** — if `getRelatedEntities` throws, the confirmation dialog still opens without the related-entity sections; the error is logged but non-blocking.
- **Enable-login validation is client-side too** — non-`client` categories or missing emails short-circuit with a snackbar before hitting the backend.
- **Permission-gated actions** — `*appHasPermission` hides menu entries individually (`clients.create`, `clients.edit`, `clients.delete`, `clients.enable_login`).

## Permissions & Tenant/Institution

- **Route guard:** `permissionGuard` with `requiredPermission: 'clients.view'` (see `apps/tagea-frontend/src/app/routes/institution.routes.ts`).
- **UI-level gates (via `*appHasPermission`):**
  - `clients.create` — "New client" button / FAB, "Create first client" CTA
  - `clients.edit` — row-menu "Edit" action
  - `clients.delete` — row-menu "Delete" action
  - `clients.enable_login` — "Enable login" / "Disable login" menu items
- **Backend guards:** `@Auth({ scope: 'institution', permissions: [...] })` on every method in `ClientsController` — see [contracts.md](./contracts.md) for the per-endpoint mapping.
- **Feature guards:** `HasFeatureDirective` hides feature-flagged UI.
- **Institution context:** `UnifiedAuthService.institutionId()` (URL-derived); wire URL built via `getInstitutionApiUrl` → `${INSTITUTION_ROUTE_PREFIX}/clients`.

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
- **Models:** `ClientData`, `Client`, `ClientFilters` (all in `apps/tagea-frontend/src/app/models/client.model.ts`)
- **Dialogs:** `ClientDialogComponent`, `DeleteConfirmationDialogComponent`
- **Filter sheet:** `ClientFiltersBottomSheetComponent`
- **Directives:** `HasPermissionDirective` (selector `*appHasPermission`), `HasFeatureDirective`
- **Utilities:** `getEmployeeColor`, `institutionRoute`
- **Backend controller:** `apps/tagea-backend/src/clients/clients.controller.ts` (`${INSTITUTION_ROUTE_PREFIX}/clients`)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
