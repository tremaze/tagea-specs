# Contracts: Cases List

## Services

| Service                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `CaseManagementService` | Primary case CRUD                              |
| `CaseEditService`       | Creation / edit flow orchestration             |
| `CasesDataService`      | List composition (filters, search, pagination) |

## Data Models

```ts
// apps/tagea-frontend/src/app/models/case.model.ts
interface Case {
  id: string;
  title: string;
  status: CaseStatus;
  category?: string;
  client_id: string;
  assigned_employee_id?: string;
  institution_id: string;
  created_at: string;
  updated_at: string;
  // + extended fields
}

// Exact enum values in case.model.ts
type CaseStatus =
  | 'open'
  | 'in_progress'
  | 'closed'
  | /* … verify full enum */;

// Utility helpers exported alongside the model
function getCaseStatusLabel(status: CaseStatus): string;
function getCaseStatusColor(status: CaseStatus): string;

// Record<string, string> — category name → Material icon
const CATEGORY_ICONS: Record<string, string>;
```

## Constants

```ts
// Component-level
const MAX_AUTO_LOAD = 300;
// When the fetched count reaches MAX_AUTO_LOAD, further pagination requires
// explicit user action (a "Load more" button) to prevent runaway fetches.
```

## Navigation target

Row tap → `institutionRoute(institutionId, 'cases', caseId)` → `/einrichtung/:id/cases/:caseId/overview` (default tab via `CASE_CHILD_ROUTES`).
