# Contracts: Teamspace Submissions

## Services

| Service                       | Methods used (indicative)                                                                                                                            | Purpose                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `SubmissionsService`          | `getOwnSubmissions()`, `getSupervisedSubmissions(opts?)`, `getSubmissionByIdGlobal(id)`, `getSubmissions(teamspaceId, filter?)`, `getSubmissionById(teamspaceId, id)`, `createSubmission(teamspaceId, categoryId, customFieldValues, files?, repeatingChanges?)` | Submission CRUD                               |
| `SubmissionCategoriesService` | `getCategories(teamspaceId)`, `getCategoryById(teamspaceId, id)`, `getCategoryForSubmission(submissionId)`                                            | Fetch active categories + their field configs |
| `TeamspaceService`            | `getAccessibleTeamspaces()`, `loadUserRolesSummary()`                                                                                                | Chip data + picker options                    |

> Exact signatures in each service file under `apps/tagea-frontend/src/app/services/`. Flutter port reads there.

## Endpoints used by the list and the read-only detail

| Method + path | Response | Used for |
| --- | --- | --- |
| `GET /submissions/own` | `Submission[]` (snake_case columns, camelCase relations `employee`, `category`, `attachments`) | „Meine Meldungen“ |
| `GET /submissions/supervised?limit&offset` | `{ items: Submission[], total, unacknowledged }` | „Mitarbeiter“ tab |
| `GET /submissions/:id` | `Submission` + `status_history[]`, `respondedByEmployee`, `assignedToEmployee`, `_permissions`, `_visibility` | detail |
| `GET /submissions/:id/category` | category + `field_groups[]` (`is_repeating`, `key`, `aggregation_config`, `field_definitions[]`) + flat `field_definitions[]` | detail fields |
| `GET /submissions/:id/attachments/:aid/download?presigned=true` | `{ url }` (without `presigned`: file stream) | attachments |
| `GET /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url?expiresIn=900` | `{ url, expiresIn }` | PDF receipt |

> **Flutter port note:** `custom_fields_summary` values per field type — select: `{selected_id, selected_key, selected_label}` or id/key string; multiselect: `{selected: [{id, key, label}]}` or id list; employee/institution select: `{id, name}` (or list); file: `{filename}`; enriched values: `{display}`; repeating group: `summary[group.key] = {rows: [{row_id, <field_key>: …}], row_count}`.

## Create submission

`POST /teamspaces/:teamspaceId/submissions` — `multipart/form-data`. Backend: `SubmissionsController.create` (`apps/tagea-backend/src/submissions/submissions.controller.ts`).

**Guards:** class-level `FeatureGuard` (`submissions` feature), `TeamspaceAccessGuard` (`@RequireTeamspaceAccess()`), `TeamspaceModuleGuard`; method-level `@Auth({ scope: 'tenant', permissions: ['tenant.submissions.submit'] })` + `@RequireTeamspaceModule('submissions')`.

| Part | Type | Required | Notes |
|---|---|---|---|
| `category_id` | string (UUID) | yes | Template id (a legacy group id is still resolved to its template). Unknown → 400 `Unknown submission category`. |
| `custom_field_values` | string (JSON object) | no (default `{}`) | Flat values keyed by `field_key`, resolved against this category's definitions only. Invalid JSON → 400 `Invalid JSON in custom_field_values`. Keys of repeating-section fields here → 400 (`Fields of repeating sections must be sent via custom_field_repeating …`). Unknown keys / values of deactivated fields are dropped silently. Rule violations → 400 `{ message: 'Custom field validation failed', failed_fields }` and nothing is persisted. |
| `custom_field_repeating` | string (JSON object) | no | `Record<groupId, { created: [{ tempId, fields }], updated: [], deleted: [] }>` — only `created` rows allowed at create time (non-empty `updated`/`deleted` → 400). The Angular client always sends it (`{}` when empty) as capability marker. Unknown/non-repeating group → 400. Rejected with 400 when the server kill switch `FEATURE_SUBMISSION_REPEATING_SECTIONS=false` is set and rows are present. |
| `files` | binary, repeated | no | `FilesInterceptor('files', 5)`: max **5** files (a 6th → 400 from multer), max **10 MB** each (`SubmissionAttachmentsService.MAX_FILE_SIZE`; larger → 413 from multer's limit), MIME allow-list: `application/pdf`, `application/msword`, `…wordprocessingml.document`, `application/vnd.ms-excel`, `…spreadsheetml.sheet`, `image/jpeg`, `image/png`, `image/gif`, `text/plain`, `text/csv` (aliases `image/jpg`, `image/pjpeg`, `application/x-pdf`, `text/x-csv` accepted). Other types → 400 `Invalid file type …`. Filenames are UTF-8-repaired and sanitized. Required when the category has `require_attachment` (else 400 `This category requires a file attachment`). |

The Angular client (`createSubmissionFormData` in `models/submission-mappers.ts`) also appends `teamspace_id`; the backend ignores it (the teamspace comes from the path). The body parameter is typed as an intersection (`CreateSubmissionDto & {…}`), so the global `ValidationPipe` does not run the DTO's class-validator rules — validation happens in the controller/service as listed above.

**Response 201:** the created submission reloaded with relations (same snake_case shape as `GET /teamspaces/:tsId/submissions/:id`), initial `status` `pending` or `awaiting_approval` (category needs supervisor approval, is visible to institution supervisors, and the submitter has a supervisor). A PDF receipt is generated best-effort (a failure does not fail the request).

**Errors:** 400 (see table), 403 (missing `tenant.submissions.submit`, no teamspace access, feature or teamspace module disabled), 413 (file too large).

> **Flutter port note:** send exactly these part names; encode `custom_field_values` and `custom_field_repeating` as JSON strings; pre-validate count/size/type client-side with the same limits.

## Endpoints used by the create wizard

| Method + path | Permission | Response | Used for |
| --- | --- | --- | --- |
| `GET /teamspaces/accessible` (via `TeamspaceService.getAccessibleTeamspaces()`) | — | teamspaces incl. `active_modules` | teamspace step (only active teamspaces with `active_modules.submissions`) |
| `GET /teamspaces/:tsId/submission-categories` | `tenant.submissions.submit` | `SubmissionCategory[]` | category step |
| `GET /teamspaces/:tsId/submission-categories/:id` | `tenant.submissions.submit` | `SubmissionCategory` with `field_definitions` | form step / deep link |
| `POST /teamspaces/:tsId/submissions` | `tenant.submissions.submit` | see above | submit |

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
