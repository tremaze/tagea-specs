# Contracts: Teamspace Submissions

## Services

| Service                       | Methods used (indicative)                                                                                                                            | Purpose                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `SubmissionsService`          | `getSubmissions(teamspaceId, filter?)`, `getSubmissionById(teamspaceId, id)`, `createSubmission(teamspaceId, categoryId, customFieldValues, files?)` | Submission CRUD                               |
| `SubmissionCategoriesService` | `getCategories(teamspaceId)`, `getCategoryById(teamspaceId, id)`                                                                                     | Fetch active categories + their field configs |
| `TeamspaceService`            | `getAccessibleTeamspaces()`, `loadUserRolesSummary()`                                                                                                | Chip data + picker options                    |

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

## Entity-Permissions Vocabulary (Pilot)

> Implements the cross-cutting [entity-permissions](../../cross-cutting/entity-permissions/spec.md) pattern. Submissions is the first pilot.

### Visibility Origin

`_visibility` is a single-value discriminator naming **why** the authenticated principal can see this submission. Per-entity vocabulary:

| Value | Meaning |
|---|---|
| `own` | Principal is the submitter (`submission.employee_id === principal.employee.id`). |
| `teamspace_member` | Principal is a member of the submission's teamspace with at least one of `submissions.view_all` / `submissions.view_scoped` / `submissions.view_own` (the service-tier filter has already narrowed by scope for `view_scoped`). |
| `institution_supervisor` | Principal holds `institution.submissions.view_institution_members` in an institution shared with the submitter, AND the submission's category opts in via `visible_to_institution_supervisors = true`. |
| `tenant_admin` | Principal is tenant-admin (`isTenantAdmin`) or super-admin (`isSuperAdmin`) without any of the more specific origins. |

**Precedence** (most specific wins, per Server Invariant 6): `own` > `teamspace_member` > `institution_supervisor` > `tenant_admin`. Example: a user who is BOTH submitter AND tenant-admin sees `_visibility: 'own'`.

### Actions

| Action | True when |
|---|---|
| `read` | User has read access to the submission (already enforced by `applyAccessControl` — when this map is serialized, `read` is always `true`). |
| `update` | User has `submissions.process` in the submission's teamspace OR `isTenantAdmin`. |
| `delete` | User has `submissions.delete` in the submission's teamspace OR `isTenantAdmin`. |
| `changeStatus` | Same as `update`; UI gates the status-change button by this action. |
| `assign` | Same as `update`; UI gates the assignment dialog by this action. |
| `respond` | Same as `update`; UI gates the response form by this action. |
| `acknowledge` | `_visibility === 'institution_supervisor'` AND not yet acknowledged by this user (frontend reads `getAcknowledgedSubmissionIds()`). False for all other visibility origins (they don't have an "acknowledge" workflow). |
| `downloadAttachments` | Same as `read` — anyone who can see the submission can download its attachments. Listed explicitly to keep the UI gate greppable. |

### Fields

The Submissions pilot does NOT serialize `_fieldPermissions`. Per-action gating is sufficient for the existing workflows: if a user lacks `submissions.process` in the relevant teamspace, all mutation endpoints (status, assignment, response, custom-field updates) return `403` via `_permissions` symmetry. There is currently no "you can edit some fields but not others" requirement for submissions; if one appears later (e.g. terminal-state freezing of `custom_field_values`), it is a small extension to the Ability's forbidden-fields computation and a new acceptance criterion — not a pattern change.

### Endpoints affected

**Detail endpoints — serialize `_permissions` + `_visibility`:**

- `GET /teamspaces/:tsId/submissions/:id` (existing)
- `GET /submissions/:id` (global controller; added in this change so the scoped lists have a tenant-wide detail companion)

**Scoped-list endpoints — items contain NO `_permissions` / `_visibility` (URL is scope authority):**

| Endpoint | Inclusion | Items returned | Detail-`_visibility` on click |
|---|---|---|---|
| `GET /submissions/managed` | **inclusive** of `own` + `tenant_admin` | items in TSes where the principal has `submissions.view_all` / `view_scoped` (scoped by inst-list), plus everything for tenant-admins | `'own'`, `'teamspace_member'`, or `'tenant_admin'` |
| `GET /submissions/supervised` | **exclusive** | items where the principal sees them ONLY via institution-supervisor visibility (category opts in + shared institution + permission); excludes items also qualifying as own/managed | `'institution_supervisor'` |
| `GET /submissions/own` | inclusive | items where `submission.employee_id === principal.id` | `'own'` |
| `GET /teamspaces/:tsId/submissions` (existing) | scoped by route param | items in that one TS visible to the principal (own + tier-filtered) | `'own'`, `'teamspace_member'`, or `'tenant_admin'` |

**Deleted in the same change:**

- `GET /submissions` (legacy default-OR over all visibility paths) — replaced by the three scoped URLs above.
- `?visibility=institution_supervisor` query-param shortcut on the legacy endpoint — replaced by `GET /submissions/supervised`.

**Mutation endpoints — enforce action / field permissions with `403` / `422`:**

- `PATCH /teamspaces/:tsId/submissions/:id/status` (and global `PATCH /submissions/:id/status`) — `403` if `_permissions.changeStatus === false`
- `PATCH /teamspaces/:tsId/submissions/:id/assignment` (and global `PATCH /submissions/:id/assignment`) — `403` if `_permissions.assign === false`
- `POST /teamspaces/:tsId/submissions/:id/response` (and global `POST /submissions/:id/response`) — `403` if `_permissions.respond === false`
- `PATCH /teamspaces/:tsId/submissions/:id/custom-fields/v2/:k` — gated by `_permissions.update` (403); no per-field rule in this pilot.
- `DELETE /teamspaces/:tsId/submissions/:id` (and global `DELETE /submissions/:id`) — `403` if `_permissions.delete === false`

### Example Responses (Documentation-Only)

**Submitter fetches their own pending submission:**

```json
{
  "id": "sub-123",
  "teamspaceId": "ts-personalabteilung",
  "category": { "id": "cat-urlaub", "name": "Urlaubsantrag", "visible_to_institution_supervisors": false },
  "status": "pending",
  "employeeId": "emp-self",
  "_visibility": "own",
  "_permissions": {
    "read": true,
    "update": false,
    "delete": false,
    "changeStatus": false,
    "assign": false,
    "respond": false,
    "acknowledge": false,
    "downloadAttachments": true
  }
}
```

**Teamspace-admin in `ts-personalabteilung` fetches a submission they can verwalten:**

```json
{
  "id": "sub-456",
  "teamspaceId": "ts-personalabteilung",
  "status": "in_review",
  "employeeId": "emp-someone-else",
  "_visibility": "teamspace_member",
  "_permissions": {
    "read": true,
    "update": true,
    "delete": true,
    "changeStatus": true,
    "assign": true,
    "respond": true,
    "acknowledge": false,
    "downloadAttachments": true
  }
}
```

**Einrichtungsleiter sees a submission from a teamspace they are NOT in (institution-supervisor visibility):**

```json
{
  "id": "sub-789",
  "teamspaceId": "ts-personalabteilung",
  "status": "pending",
  "employeeId": "emp-subordinate",
  "_visibility": "institution_supervisor",
  "_permissions": {
    "read": true,
    "update": false,
    "delete": false,
    "changeStatus": false,
    "assign": false,
    "respond": false,
    "acknowledge": true,
    "downloadAttachments": true
  }
}
```

**Same submission as above, but the viewer has already acknowledged it:**

```json
{
  "id": "sub-789",
  "_visibility": "institution_supervisor",
  "_permissions": {
    "read": true,
    "update": false,
    "delete": false,
    "changeStatus": false,
    "assign": false,
    "respond": false,
    "acknowledge": false,
    "downloadAttachments": true
  }
}
```

**Tenant-admin (no other origin) fetches any submission in the tenant:**

```json
{
  "id": "sub-999",
  "teamspaceId": "ts-some-other",
  "status": "pending",
  "_visibility": "tenant_admin",
  "_permissions": {
    "read": true,
    "update": true,
    "delete": true,
    "changeStatus": true,
    "assign": true,
    "respond": true,
    "acknowledge": false,
    "downloadAttachments": true
  }
}
```

**Scoped-list responses — no meta-fields on items (URL is scope authority):**

`GET /submissions/managed` (called by `/teamspace/submissions/verwaltung`):

```json
{
  "items": [
    { "id": "sub-456", "teamspaceId": "ts-personalabteilung", "status": "in_review" },
    { "id": "sub-321", "teamspaceId": "ts-it",                "status": "closed"    }
  ]
}
```

Items are exactly what the user can verwalten — institution-supervisor-only items are NOT in this response. The Verwaltungsseite renders all items unconditionally; no client-side filter, no `_visibility` per item, no `mode=admin` heuristic.

`GET /submissions/supervised` (called by the supervisor-section in `/teamspace/:slug/submissions` and by the sidebar badge):

```json
{
  "items": [
    { "id": "sub-789", "teamspaceId": "ts-personalabteilung", "status": "pending" }
  ]
}
```

`GET /submissions/own`:

```json
{
  "items": [
    { "id": "sub-123", "teamspaceId": "ts-personalabteilung", "status": "pending" },
    { "id": "sub-321", "teamspaceId": "ts-it",                "status": "closed"  }
  ]
}
```

`GET /teamspaces/:tsId/submissions` (existing, kept; per-teamspace scope is encoded by the route param):

```json
{
  "items": [
    { "id": "sub-456", "status": "in_review" },
    { "id": "sub-123", "status": "pending"   }
  ]
}
```
