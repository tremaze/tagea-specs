# Feature: Tasks

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Aggregated validation-tasks page at `/einrichtung/:institutionId/tasks`. Shows entities (Cases / Appointments / Clients) that have `invalid_fields > 0` — meaning they are missing required or statistic-relevant custom fields. Single-select type filter + employee filter + search by title/client/case-number/template; tapping a case or client navigates to its detail view with `highlightErrors=true`, tapping an appointment opens the inline appointment edit dialog.

## User Stories

- As a **staff member** I want to see all incomplete entities that need data entry, so that I can close validation gaps.
- As a **staff member** I want to filter by entity type or assigned employee, so that I can focus on my workload.
- As a **staff member** I want to search by title/client/case number, so that I can find a specific task.
- As a **staff member** I want the navigation badge to show how many open tasks exist, so that I notice new validation gaps.

## Acceptance Criteria

### List

- [ ] **Given** the user opens `/tasks`, **When** `TasksService.getTasks(query)` resolves, **Then** tasks render as rows in a table (desktop) or cards (mobile) and counts per type populate the chips.
- [ ] **Given** the type filter changes to `case`, `appointment`, or `client`, **When** the selection is applied, **Then** the request re-fires with `type` set to that single `TaskType`.
- [ ] **Given** the employee filter changes, **When** the selection is applied, **Then** the request re-fires with `assigned_employee_id`.
- [ ] **Given** the search field receives text, **When** the user pauses typing (300 ms debounce with `distinctUntilChanged`), **Then** `loadTasks()` re-fires with the new `search`.
- [ ] **Given** a `case` row is tapped, **When** navigation resolves, **Then** the user lands on `/einrichtung/:institutionId/cases/:id/data?highlightErrors=true`.
- [ ] **Given** a `client` row is tapped, **When** navigation resolves, **Then** the user lands on `/einrichtung/:institutionId/profile/:id/stammdaten?highlightErrors=true`.
- [ ] **Given** an `appointment` row is tapped, **When** the handler fires, **Then** `AppointmentDialogV2Component` opens (lazy-loaded) with `mode: 'edit'` and `highlightErrors: true`; on save/delete the list reloads.
- [ ] **Given** the viewport is mobile, **When** the filters FAB fires, **Then** `TasksFiltersBottomSheetComponent` opens with the current `typeFilter` and `sortBy`.
- [ ] **Given** the summary badge is visible, **When** `TasksService.notifyTasksChanged()` is called (e.g. after saving an appointment or case), **Then** `onRefreshNeeded$` emits and `app.ts` reloads `getTasksSummary()`.

### Persistence of filter/sort state

- [ ] **Given** the user changes `typeFilter`, `employeeFilter`, or `sortBy`, **When** the change applies, **Then** the component calls `EmployeesService.updateTasksFilterPreferences({ tasks_filter_type, tasks_filter_assigned_employee_id, tasks_filter_sort_by })`.
- [ ] **Given** the user navigates away and back, **When** `ngOnInit` runs, **Then** the previous values are restored from `getPersonalPreferences()` before the first `loadTasks()`.
- [ ] **Given** `clearFilters()` fires, **When** it runs, **Then** type/employee/search reset to empty and `sortBy`/`sortOrder` reset to `created_at` / `desc` and the preferences are persisted.

## UI States

| State     | When?                         | Rendering                                       |
| --------- | ----------------------------- | ----------------------------------------------- |
| Loading   | Initial fetch / filter change | Spinner                                         |
| Empty     | No tasks match filter         | Empty-state illustration + "all caught up" text |
| Populated | Tasks visible                 | Filter chips + search + table/cards             |
| Error     | Fetch failure                 | Snackbar (`tasks.errorLoading`), spinner clears |

## Non-Goals

- **Bulk-resolve tasks** — not implemented.
- **Creation of new tasks** — tasks are derived from entity state (`invalid_fields > 0`), not user-created.
- **Task assignment** — tasks are not assignable; they belong to whoever edits the underlying entity.
- **Multi-type filter** — backend accepts a single `type` (not an array); UI exposes a single-select chip.

## Edge Cases

- **Entity gets fixed externally** — a task disappears on next `loadTasks()` when `invalid_fields` drops to 0. Badge only refreshes when something calls `notifyTasksChanged()`.
- **User lacks permission to view a task type** — `tasksFeatureGuard` + frontend `permissionGuard` (`institution.access`) gate the route. Backend `@Auth` requires `DASHBOARD_VIEW` on the institution scope and `@RequireFeature('tasks')`.
- **Search scope** — server-side search against title/case-number/client-name; additionally the component applies a client-side filter over `title`, `client_name`, `case_number`, and `template_name`.
- **Appointment dialog failure** — if `AppointmentsService.getAppointment(id)` rejects, the `tasks.errorLoadingAppointment` snackbar shows and the dialog never opens.

## Permissions & Tenant/Institution

- **Frontend route guards:** `permissionGuard` with `data.requiredPermission: 'institution.access'` + `tasksFeatureGuard` (tenant-level feature flag).
- **Backend auth:** `@Auth({ scope: 'institution', permissions: [PERMISSIONS.DASHBOARD_VIEW] })` on both endpoints; controller-level `@UseGuards(FeatureGuard)` + `@RequireFeature('tasks')`.
- **Institution context:** URL param, resolved in the frontend via `InstitutionContextService.institutionId()` inside `TasksService.institutionUrl()`.

## Notifications (Push / In-App)

- Not a push target. The nav badge is a pull (`getTasksSummary()`) triggered on app load and whenever `notifyTasksChanged()` fires.

## i18n Keys

> User-facing strings remain in German.

Referenced in the component:

- `tasks.errorLoading`, `tasks.errorLoadingAppointment`
- `tasks.onlyCases`, `tasks.onlyAppointments`, `tasks.onlyClients`, `tasks.allTypes`
- `tasks.sortCreatedAt`, `tasks.sortUpdatedAt`, `tasks.sortStartDate`
- `tasks.typeCase`, `tasks.typeAppointment`, `tasks.typeClient`

## Offline Behavior

**Flutter-specific (if ever ported):**

- P2 / non-goal for Flutter. Documentation only.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts`](../../../apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts)
- **Service:** [`TasksService`](../../../apps/tagea-frontend/src/app/services/tasks.service.ts) (exports `TaskItem`, `TaskType`, `TasksQuery`, `TasksListResponse`, `TasksSummary`)
- **Related services:** `AppointmentsService`, `EmployeesService` (`getPersonalPreferences`, `updateTasksFilterPreferences`), `InstitutionContextService`
- **Filter sheet:** `TasksFiltersBottomSheetComponent`
- **Route guard:** [`tasks-feature.guard.ts`](../../../apps/tagea-frontend/src/app/guards/tasks-feature.guard.ts)
- **Backend:** [`TasksController`](../../../apps/tagea-backend/src/tasks/tasks.controller.ts), [`TasksService`](../../../apps/tagea-backend/src/tasks/tasks.service.ts), [`task-item.dto.ts`](../../../apps/tagea-backend/src/tasks/dto/task-item.dto.ts)
- **E2E tests:** _(none — no tasks-specific spec under `apps/tagea-frontend-e2e/src/`)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
