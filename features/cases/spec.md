# Feature: Cases List

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff cases list at `/einrichtung/:institutionId/cases`. Searchable/filterable case catalog grouped by category, status-colored chips, and an auto-load ceiling to prevent pathologically large fetches. Tapping a row opens the case detail with tabs.

## User Stories

- As a **staff member** I want to see all cases in my institution, so that I can navigate to active work.
- As a **staff member** I want to filter by status and category, so that I focus on relevant cases.
- As a **staff member** I want to create or delete cases, so that caseload admin is possible from one place.

## Acceptance Criteria

### List

- [ ] **Given** the page loads, **When** `CasesDataService.getCases(...)` resolves, **Then** cases render with status chip (colored via `getCaseStatusColor`, labeled via `getCaseStatusLabel`), category (icon via `CATEGORY_ICONS`), assigned employee chip (via `getEmployeeColor`), and timestamp.
- [ ] **Given** the result set exceeds `MAX_AUTO_LOAD = 300`, **When** more results would be fetched, **Then** auto-load stops and a "load more" affordance is shown — prevents accidental large fetches.
- [ ] **Given** filter chips render, **When** filters (status, category, date range, employee) change, **Then** the list reloads.
- [ ] **Given** a text search is entered, **When** the user pauses (debounce), **Then** the server searches and the list updates.
- [ ] **Given** the viewport is mobile, **When** the FAB fires, **Then** `CaseFiltersBottomSheetComponent` opens.
- [ ] **Given** a row is tapped, **When** navigation resolves, **Then** open `/einrichtung/:institutionId/cases/:caseId` (see Case Detail Tabs inventory — P2, separate spec).

### Create / delete

- [ ] **Given** the user presses "New case", **When** the action fires, **Then** `CaseEditService` drives the creation flow (dialog or route — verify).
- [ ] **Given** the user chooses "Delete" from a row's menu, **When** confirm resolves, **Then** `DeleteConfirmationDialogComponent` shows related entities and commits the delete if confirmed.

## UI States

| State                 | When?                                          | Rendering                      |
| --------------------- | ---------------------------------------------- | ------------------------------ |
| Loading               | Initial fetch                                  | Spinner                        |
| Empty                 | No cases match filter                          | Empty-state + "New case" CTA   |
| Populated             | Cases visible                                  | Search + filters + table/cards |
| Auto-load ceiling hit | `cases.length >= MAX_AUTO_LOAD` and more exist | "Load more" button             |
| Error                 | Fetch failure                                  | Error panel + retry            |

## Non-Goals

- **Bulk operations** — not implemented.
- **Case-financial / approvals management** — lives inside the case detail tabs (separate spec).

## Edge Cases

- **Status transitions** — `CaseStatus` enum drives label + color; additions require mirrored updates in `getCaseStatusLabel` / `getCaseStatusColor` utilities.
- **Category icons** — `CATEGORY_ICONS` maps category strings to Material icon names; missing category falls back to a default icon.
- **Auto-load ceiling (`MAX_AUTO_LOAD = 300`)** — critical edge case; a naïve port that paginates forever would degrade performance on large institutions.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'cases.view'`.
- **Feature guard:** `caseFeatureGuard` (tenant-level).
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Not a push target. Case state reflects backend on reload.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific (if ported):**

- P2 / non-goal for Flutter. Documentation only.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/cases-page/cases-page.ts`](../../../apps/tagea-frontend/src/app/pages/cases-page/cases-page.ts)
- **Services:** `CaseManagementService`, `CaseEditService`, `CasesDataService`, `UnifiedAuthService`
- **Models:** `Case`, `CaseStatus`, `getCaseStatusLabel`, `getCaseStatusColor`, `CATEGORY_ICONS` (from `case.model.ts`)
- **Dialogs:** `DeleteConfirmationDialogComponent`
- **Filter sheet:** `CaseFiltersBottomSheetComponent`
- **Utilities:** `getEmployeeColor`, `institutionRoute`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
