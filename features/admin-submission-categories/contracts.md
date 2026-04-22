# Contracts: Admin — Submission Categories

> API endpoints, DTOs, events — everything that flows between frontend and backend.

Base path: `teamspace/admin/submission-categories` (admin-scoped; distinct from the submitter-side teamspace endpoints).

## Endpoints

### `GET /api/teamspace/admin/submission-categories`

List global categories (active only). Optional `teamspace_id` query (repeatable) filters by scope.

**Response:** `CustomFieldGroupResponse[]` → mapped client-side to `SubmissionCategory[]` via `mapToSubmissionCategory`.

### `GET /api/teamspace/admin/submission-categories/all-including-archived`

Same as above but includes archived (soft-deleted) categories.

### `POST /api/teamspace/admin/submission-categories`

Create a new category.

**Request body DTO:** `CreateCustomFieldGroupDto` (backend source of truth — `apps/tagea-backend/src/custom-fields/dto/`).

> Documentation-only shape — conceptual JSON payload sent by `SubmissionCategoriesService.createGlobalCategory`. Refer to the DTO class for the authoritative validation rules.

```ts
// documentation-only
{
  teamspace_id: string | null;                     // legacy single-scope
  name: string;
  description?: string;
  display_order?: number;
  visible_to_institution_supervisors?: boolean;
  require_attachment?: boolean;
  notification_emails?: string[];
  teamspace_ids?: string[];                        // multi-scope list
}
```

### `PATCH /api/teamspace/admin/submission-categories/:id`

Update one or more editable fields. All fields optional; only provided keys are patched.

**Request body DTO:** `UpdateCustomFieldGroupDto`.

> Documentation-only shape — same rationale as the create endpoint.

```ts
// documentation-only
{
  name?: string;
  description?: string;
  is_active?: boolean;
  icon?: string;
  display_order?: number;
  visible_to_institution_supervisors?: boolean;
  requires_supervisor_approval?: boolean;
  require_attachment?: boolean;
  notification_emails?: string[];
  teamspace_ids?: string[];
}
```

### `DELETE /api/teamspace/admin/submission-categories/:id`

Soft-delete (archive) the category.

### `POST /api/teamspace/admin/submission-categories/reorder`

Persist display order after a drag-and-drop.

**Request:** `{ groups: Array<{ id: string; display_order: number }> }`

### `POST /api/teamspace/admin/submission-categories/:id/pdf-template`

Upload a PDF template for the category. `multipart/form-data` with field `file`.

**Response:** Updated `CustomFieldGroupResponse` with populated `pdf_template_filename`, `pdf_template_size`, `pdf_template_uploaded_at`.

**Error codes:** 401, 403, 404 (category not found), 415 (non-PDF upload).

### `GET /api/teamspace/admin/submission-categories/:id/pdf-template`

Download the raw PDF.

**Response:** `application/pdf` blob.

### `DELETE /api/teamspace/admin/submission-categories/:id/pdf-template`

Remove the stored template.

**Response:** Updated `CustomFieldGroupResponse` with the three `pdf_template_*` fields reset to `null`.

## Events (WebSocket / Push)

None. Category management is synchronous REST.

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/models/submission-category.model.ts
export interface SubmissionCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  order: number;
  is_active: boolean;
  teamspace_id?: string | null;
  teamspace_ids: string[];
  visible_to_institution_supervisors?: boolean;
  requires_supervisor_approval?: boolean;
  require_attachment?: boolean;
  notification_emails?: string[] | null;
  pdf_template_filename?: string | null;
  pdf_template_size?: number | null;
  pdf_template_uploaded_at?: Date | null;
  field_definitions?: unknown[];
  created_at: Date;
  updated_at: Date;
}

export interface SubmissionCategoryField {
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
  ui_config?: UiConfig;
  created_at: Date;
  updated_at: Date;
}
```

```ts
// Source: apps/tagea-frontend/src/app/pages/administration/daten/einreichungs-kategorien/admin-submission-category-dialog.component.ts
// Dialog contract — not a wire shape.
export interface AdminSubmissionCategoryDialogData {
  group: AdminGroupModel | null;                   // null = create mode
  extras: SubmissionCategoryExtras;
  teamspaceOptions: TeamspaceOption[];
  pdfTemplate: PdfTemplateState | null;            // null when creating
  rawFields: SubmissionCategoryField[];            // empty when creating
}

export interface PdfTemplateState {
  filename: string | null;
  size: number | null;
  uploaded_at: Date | null;
}
```

> **Flutter port note:** Admin surface is not ported to Flutter. No Dart contract required.

## Backend source of truth

- Controller: `apps/tagea-backend/src/submissions/controllers/admin-submission-categories.controller.ts` (PDF routes at lines 244-353)
- Entity: `apps/tagea-backend/src/custom-fields/entities/custom-field-group.entity.ts` (PDF fields + S3 columns at lines 200-222)
- Service methods (frontend): `apps/tagea-frontend/src/app/services/submission-categories.service.ts`
  - `getGlobalCategories` (line 252)
  - `createGlobalCategory` (line 306)
  - `updateGlobalCategory` (line 354)
  - `deleteGlobalCategory` (line 417)
  - `uploadPdfTemplate` (line 440)
  - `downloadPdfTemplate` (line 461)
  - `deletePdfTemplate` (line 484)
  - `reorderGlobalCategories` (line 553)
