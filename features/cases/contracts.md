# Contracts: Cases List

## Services

| Service                 | Purpose                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CaseManagementService` | Primary case CRUD (`deleteCase`, etc.)                                                                                                                                                                                  |
| `CaseEditService`       | Creation / edit flow orchestration (`createCase`, `editCase`)                                                                                                                                                           |
| `CasesDataService`      | List composition (filters, search, pagination); exposes `loadIfNeeded`, `applyFilters`, `loadMore`, `refresh`, `updateFilters`, `clearFilters` and signals `cases`, `filters`, `loading`, `loadingMore`, `hasMorePages` |

## Data Models

```ts
// apps/tagea-frontend/src/app/models/case.model.ts
export interface Case {
  id: string;
  client_id: string;

  // Core fields
  case_number: string; // Generated format: YYYY-NNNN
  case_template_id: string | null;
  department_id: string | null;
  assigned_employee_ids: string[]; // Multiple staff members
  registration_date: string; // ISO date string YYYY-MM-DD
  start_date: string; // ISO date string YYYY-MM-DD
  end_date?: string | null;
  general_info: string;
  status: CaseStatus;
  is_archived: boolean;

  // System
  created_by_employee_id: string;
  created_at: string;
  updated_at: string;

  // Validation status (calculated by PostgreSQL triggers)
  invalid_fields: number;
  invalid_appointments: number;

  // Loaded via includes
  client?: { id: string; first_name: string; last_name: string /* … */ };
  caseTemplate?: { id: string; name: string; icon: string; color: string /* … */ };
  assignedEmployees?: { id: string; first_name: string; last_name: string; color?: string | null }[];
  clientCounselors?: { id: string; first_name: string; last_name: string; color?: string | null }[];
  createdByEmployee?: { id: string; first_name: string; last_name: string };
}

// Exact enum values in case.model.ts
export type CaseStatus = 'draft' | 'waitlist' | 'active' | 'on_hold' | 'closed' | 'archived';

// Utility helpers exported alongside the model
export function getCaseStatusLabel(status: CaseStatus): string;
export function getCaseStatusColor(status: CaseStatus): string;

// Record<string, string> — statistics-category name → Material icon
export const CATEGORY_ICONS: Record<string, string>;
```

## Constants

```ts
// Component-level (cases-page.ts)
const MAX_AUTO_LOAD = 300;
// When the fetched count reaches MAX_AUTO_LOAD, further pagination requires
// explicit user action (a "Load more" button) to prevent runaway fetches.
```

## Backend Endpoints

> Base prefix: `INSTITUTION_ROUTE_PREFIX = 'institutions/:institutionId'`
> Guard: `@Auth({ scope: 'institution', permissions: [...] })`

| Method + Path                                    | Permission                 | Purpose                |
| ------------------------------------------------ | -------------------------- | ---------------------- |
| `GET  institutions/:institutionId/cases/minimal` | `PERMISSIONS.CASES_VIEW`   | Paginated minimal list |
| `GET  institutions/:institutionId/cases`         | `PERMISSIONS.CASES_VIEW`   | Filtered list          |
| `GET  institutions/:institutionId/cases/:id`     | `PERMISSIONS.CASES_VIEW`   | Single case            |
| `POST institutions/:institutionId/cases`         | `PERMISSIONS.CASES_CREATE` | Create                 |
| `PATCH institutions/:institutionId/cases/:id`    | `PERMISSIONS.CASES_EDIT`   | Update                 |
| `DELETE institutions/:institutionId/cases/:id`   | `PERMISSIONS.CASES_DELETE` | Delete                 |

Permission string values (from `permissions.constants.ts`): `cases.view`, `cases.create`, `cases.edit`, `cases.delete`.

## Navigation target

Row tap → `institutionRoute(authService.institutionId(), 'cases', caseData.id)` → `/einrichtung/:institutionId/cases/:id` with default-tab redirect to `/overview` (via `CASE_CHILD_ROUTES` `redirectTo: 'overview', pathMatch: 'full'`).
