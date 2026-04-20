# Contracts: Tasks

## Service: `TasksService`

From [`tasks.service.ts`](../../../apps/tagea-frontend/src/app/services/tasks.service.ts):

| Method                        | Purpose               |
| ----------------------------- | --------------------- |
| `getTasks(query: TasksQuery)` | Aggregated tasks list |

## Data Models

```ts
// apps/tagea-frontend/src/app/services/tasks.service.ts
type TaskType = 'case' | 'appointment' | 'client';

interface TaskItem {
  id: string;
  type: TaskType;
  title: string;
  clientName?: string;
  invalidFields: number;
  // + metadata — entity reference for navigation
}

interface TasksQuery {
  types?: TaskType[];
  search?: string;
  page?: number;
  limit?: number;
}
```

Exact field set lives in the service file; Flutter port reads there.

## Navigation targets

On tap, the component routes by `type`:

| `type`        | Target                                          |
| ------------- | ----------------------------------------------- |
| `case`        | `/einrichtung/:id/cases/:entityId`              |
| `appointment` | `/einrichtung/:id/staff/appointments/:entityId` |
| `client`      | `/einrichtung/:id/profile/:entityId`            |
