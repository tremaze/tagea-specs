# Contracts: Tasks

## Service: `TasksService`

From [`tasks.service.ts`](../../../apps/tagea-frontend/src/app/services/tasks.service.ts):

| Method                         | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `getTasksSummary()`            | Task counts for navigation badges (`GET /tasks/summary`)       |
| `getTasks(query?: TasksQuery)` | Paginated tasks list with filtering (`GET /tasks`)             |
| `notifyTasksChanged()`         | Emits on `onRefreshNeeded$` so the nav badge reloads           |
| `onRefreshNeeded$`             | Observable consumed by `app.ts` to trigger `getTasksSummary()` |

## Data Models

```ts
// apps/tagea-frontend/src/app/services/tasks.service.ts
export type TaskType = 'case' | 'appointment' | 'client';

export interface TaskItem {
  id: string;
  type: TaskType;
  title: string;
  subtitle?: string;
  client_id?: string;
  client_name?: string;
  case_id?: string;
  case_number?: string;
  template_name?: string;
  template_icon?: string;
  template_color?: string;
  assigned_employee_ids?: string[];
  assigned_employee_names?: string[];
  department_id?: string;
  department_name?: string;
  created_at: string;
  updated_at?: string;
  start_datetime?: string;
  end_datetime?: string;
  status?: string;
  invalid_fields: number;
}

export interface TasksListResponse {
  items: TaskItem[];
  total: number;
  cases_count: number;
  appointments_count: number;
  clients_count: number;
}

export interface TasksSummary {
  total: number;
  cases: number;
  appointments: number;
  clients: number;
}

export interface TasksQuery {
  type?: TaskType;
  assigned_employee_id?: string;
  department_id?: string;
  template_id?: string;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'start_datetime';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

## Backend endpoints

Controller: [`TasksController`](../../../apps/tagea-backend/src/tasks/tasks.controller.ts)
Base path: `institutions/:institutionId/tasks`

| Method | Path       | Auth                                                    | DTO                                      |
| ------ | ---------- | ------------------------------------------------------- | ---------------------------------------- |
| GET    | `/summary` | `Auth(institution, [DASHBOARD_VIEW])` + `tasks` feature | → `TasksSummaryDto`                      |
| GET    | `/`        | `Auth(institution, [DASHBOARD_VIEW])` + `tasks` feature | `TasksQueryDto` → `TasksListResponseDto` |

Controller-level: `@UseGuards(FeatureGuard)` + `@RequireFeature('tasks')`.

Backend DTOs: [`task-item.dto.ts`](../../../apps/tagea-backend/src/tasks/dto/task-item.dto.ts) — `TaskItemDto`, `TasksListResponseDto`, `TasksSummaryDto`, `TasksQueryDto`.

## Navigation targets

The component does **not** emit a pure route for every type — appointments open a dialog.

| `type`        | UX                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `case`        | Router navigation to `/einrichtung/:institutionId/cases/:id/data` with query param `highlightErrors=true`           |
| `client`      | Router navigation to `/einrichtung/:institutionId/profile/:id/stammdaten` with query param `highlightErrors=true`   |
| `appointment` | Opens `AppointmentDialogV2Component` (lazy-loaded) with `{ mode: 'edit', highlightErrors: true }` — no route change |
