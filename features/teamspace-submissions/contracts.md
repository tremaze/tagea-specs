# Contracts: Teamspace Submissions

## Services

| Service                       | Methods used (indicative)                            | Purpose                                       |
| ----------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| `SubmissionsService`          | `getForEmployee()`, `getById(id)`, `create(payload)` | Submission CRUD                               |
| `SubmissionCategoriesService` | `getForTeamspace(id)`                                | Fetch active categories + their field configs |
| `TeamspaceService`            | `getMyTeamspaces()`                                  | Chip data + picker options                    |

> Exact signatures in each service file under `apps/tagea-frontend/src/app/services/`. Flutter port reads there.

## Data Models

```ts
// apps/tagea-frontend/src/app/models/submission.model.ts
// Note: Submission uses camelCase field names.
interface Submission {
  id: string;
  employeeId: string;
  employeeName: string;
  teamspaceId: string;
  teamspaceName?: string;
  category: SubmissionCategory;
  customFieldValues: Record<string, unknown>; // dynamic form values
  attachments: SubmissionAttachment[];
  status: SubmissionStatus;
  submittedAt: Date;
  lastModified: Date;
  assignedTo?: string;
  assignedToName?: string;
  response?: string;
  respondedAt?: Date;
  respondedBy?: string;
  respondedByName?: string;
  statusHistory: SubmissionStatusChange[];
  // Generated PDF receipt fields
  generatedReceiptFilename?: string | null;
  generatedReceiptSize?: number | null;
  generatedReceiptGeneratedAt?: Date | null;
}

// apps/tagea-frontend/src/app/models/submission-category.model.ts
// Note: SubmissionCategory uses snake_case.
interface SubmissionCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  order: number;
  is_active: boolean;
  teamspace_id?: string | null;
  visible_to_institution_supervisors?: boolean;
  requires_supervisor_approval?: boolean;
  require_attachment?: boolean;
  notification_emails?: string[] | null;
  pdf_template_filename?: string | null;
  pdf_template_size?: number | null;
  pdf_template_uploaded_at?: Date | null;
  field_definitions?: unknown[]; // typed as SubmissionCategoryField[] when populated
  created_at: Date;
  updated_at: Date;
}

interface SubmissionCategoryField {
  id: string;
  category_group_id: string;
  field_type: FieldType;
  display_name: string;
  field_key: string;
  description?: string;
  order: number;
  is_active: boolean;
  is_required: boolean;
  validation_rules?: Record<string, unknown>;
  ui_config?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}
```

```ts
// UI helper — not a backend type
interface CategoryWithTeamspace {
  category: SubmissionCategory;
  teamspace: Teamspace;
}
```

> **Naming inconsistency within this feature:** `Submission` uses camelCase (`customFieldValues`, `employeeId`), `SubmissionCategory` uses snake_case (`field_definitions`, `teamspace_id`). This reflects the actual backend response shapes. Flutter port must preserve exactly.

## Dynamic form

`SubmissionCategory.field_definitions` holds an array of `SubmissionCategoryField` (typed as `unknown[]` at the type level for flexibility) — the data-driven form primitives used to render the create form via `TageaCustomFieldsComponent`.

> **Flutter port note:** same pattern as [client-profile](../client-profile/contracts.md) — a dynamic widget tree keyed by field type. Consider `reactive_forms` with a per-type builder map.
