# Feature: Tasks

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Aggregated validation-tasks page at `/einrichtung/:institutionId/tasks`. Shows entities (Cases / Appointments / Clients) that have `invalid_fields > 0` — meaning they are missing required or statistic-relevant custom fields. Filter chips by type + search by title or client name; tapping a task navigates to the entity's detail view so the user can fix the fields.

## User Stories

- As a **staff member** I want to see all incomplete entities that need data entry, so that I can close validation gaps.
- As a **staff member** I want to filter by entity type, so that I can focus on one class of task.
- As a **staff member** I want to search by title/client, so that I can find a specific task.

## Acceptance Criteria

### List

- [ ] **Given** the user opens `/tasks`, **When** `TasksService.getTasks(query)` resolves, **Then** tasks render as rows in a table (desktop) or cards (mobile).
- [ ] **Given** filter chips render, **When** a type chip is tapped (`case`, `appointment`, `client`), **Then** the query filters to that `TaskType`.
- [ ] **Given** the search field receives text, **When** the user pauses typing (debounce), **Then** the query re-fires with the search term.
- [ ] **Given** a task row is tapped, **When** navigation resolves, **Then** the user lands on the entity's detail route (e.g. `/einrichtung/:id/cases/:caseId`, `/einrichtung/:id/staff/appointments/:id`, `/einrichtung/:id/profile/:clientId`).
- [ ] **Given** the viewport is mobile, **When** the filters FAB fires, **Then** `TasksFiltersBottomSheetComponent` opens.

### Persistence of filter/search state

- [ ] **Given** the user has active filter + search state, **When** they navigate away and back, **Then** the state is restored (see commit `cd2b32bca` — "Filter persistieren + explizite UI-Auswahl respektieren").

## UI States

| State     | When?                 | Rendering                                       |
| --------- | --------------------- | ----------------------------------------------- |
| Loading   | Initial fetch         | Spinner                                         |
| Empty     | No tasks match filter | Empty-state illustration + "all caught up" text |
| Populated | Tasks visible         | Filter chips + search + table/cards             |
| Error     | Fetch failure         | Error panel + retry                             |

## Non-Goals

- **Bulk-resolve tasks** — not implemented.
- **Creation of new tasks** — tasks are derived from entity state (`invalid_fields > 0`), not user-created.
- **Task assignment** — tasks are not assignable; they belong to whoever edits the underlying entity.

## Edge Cases

- **Entity gets fixed externally** — a task disappears on next load when `invalid_fields` drops to 0; no push notification.
- **User lacks permission to view a task type** — `tasksFeatureGuard` + permission gates; filter chip may hide if the type is entirely disabled for this user.
- **Client-name matching** — search is server-side; verify exact match semantics against `TasksService`.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'institution.access'`.
- **Feature guard:** `tasksFeatureGuard` (tenant-level feature flag).
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Not a push target. Tasks update passively on reload.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific (if ever ported):**

- P2 / non-goal for Flutter. Documentation only.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts`](../../../apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts)
- **Service:** [`TasksService`](../../../apps/tagea-frontend/src/app/services/tasks.service.ts) (exports `TaskItem`, `TaskType`, `TasksQuery`)
- **Related services:** `AppointmentsService`, `EmployeesService`
- **Filter sheet:** `TasksFiltersBottomSheetComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
