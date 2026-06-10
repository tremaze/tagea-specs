# Contracts: Submission Templates

> Backend entities, endpoints, DTOs, and migrations for elevating submission categories to real templates.
> All TypeScript/SQL blocks below are **Documentation-only shape.** — they describe target code that does not exist yet, so they are excluded from `verify-contracts.js` drift checks.

## Data Model

### `submission_templates` (NEW)

Lifecycle base mirrored from `case_templates`; submission-specific config lifted off `custom_field_groups`. **No** `tenant_id` (per-tenant DB connection), **no** `display_order` (alphabetical sort), **no** `color`/`allowed_appointment_template_ids` (case-specific).

> Documentation-only shape.
```ts
// apps/tagea-backend/src/submissions/entities/submission-template.entity.ts
@Entity('submission_templates')
class SubmissionTemplate {
  id: string;                                  // @PrimaryColumn({ type: 'uuid' }) + @BeforeInsert generateId()
  name: string;                                // varchar(255), NOT NULL
  description: string | null;                  // text
  icon: string;                                // varchar(50), default 'folder'  (user-visible)
  key: string | null;                          // varchar(100), indexed (CariData)
  is_active: boolean;                          // default true
  is_archived: boolean;                        // default false
  visible_to_institution_supervisors: boolean; // default false
  requires_supervisor_approval: boolean;       // default false
  require_attachment: boolean;                 // default false
  notification_emails: string[] | null;        // jsonb
  csv_export_config: CsvExportConfig | null;   // jsonb
  pdf_template_filename: string | null;        // varchar(255)
  pdf_template_path: string | null;            // varchar(500) (deprecated, legacy)
  pdf_template_size: number | null;            // int
  pdf_template_uploaded_at: string | null;     // TEXT (ISO) + isoDateColumnTransformer — NOT timestamptz
  pdf_template_s3_key: string | null;          // varchar(500)
  pdf_template_s3_bucket: string | null;       // varchar(255)
  pdf_template_s3_version_id: string | null;   // varchar(255)
  source_group_id: string | null;             // uuid, PERMANENT — audit + repoint join + down-guard
  created_by_employee_id: string | null;       // varchar(36), FK→employees SET NULL
  created_at: Date;
  updated_at: Date;
  teamspace_assignments: SubmissionTemplateTeamspace[]; // OneToMany
}
```

### `submission_template_teamspaces` (NEW M:N)

New junction (not a reuse of `custom_field_group_teamspaces`, whose `group_id` CASCADE-references `custom_field_groups`).

> Documentation-only shape.
```ts
// apps/tagea-backend/src/submissions/entities/submission-template-teamspace.entity.ts
@Entity('submission_template_teamspaces')
class SubmissionTemplateTeamspace {
  template_id: string;   // uuid, PK part, FK→submission_templates(id) ON DELETE CASCADE
  teamspace_id: string;  // uuid, PK part, FK→teamspaces(id)         ON DELETE CASCADE
  created_at: Date;
}
```

### Reused, unchanged

- `template_custom_field_groups` — the polymorphic junction; gains `template_type='submission'` rows (CHECK widened in M0).
- `custom_field_groups` — submission groups become **child groups** (`entity_type='submission'`). Their config columns become dead ballast (cleanup later); their `field_definitions` stay put (no `field_key` churn).
- `submissions.category_id` — stays `uuid NOT NULL`; FK target switches `custom_field_groups` → `submission_templates`.

### `TemplateType` extension

> Documentation-only shape.
```ts
// apps/tagea-backend/src/custom-fields/types/custom-fields.types.ts
type TemplateType = 'appointment' | 'case' | 'financial_support' | 'client_report' | 'submission';
TEMPLATE_TYPE_CONFIGS.submission = {
  tableName: 'submission_templates', entityType: 'submission',
  // NB: template_id references submission_templates(id) — a real table now.
};
```

## Endpoints

### Admin (tenant scope) — `admin-submission-templates.controller.ts` (replaces `admin-submission-categories.controller.ts`)

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/admin/submission-templates` | `TENANT_SUBMISSION_CATEGORIES_*` (read) | List templates (alphabetical), with teamspace badges + counts |
| `GET` | `/admin/submission-templates/:id` | read | Template detail incl. groups + fields |
| `POST` | `/admin/submission-templates` | manage | Create template + auto first child group + teamspace junction |
| `PUT` | `/admin/submission-templates/:id` | manage | Update template config + teamspace assignments |
| `DELETE` | `/admin/submission-templates/:id` | manage | Delete (RESTRICT-guarded: blocked if submissions reference it) |
| `POST` | `/admin/submission-templates/:id/groups` | manage | Attach/create a child group (field_key collision rejected) |
| `DELETE` | `/admin/submission-templates/:id/groups/:groupId` | manage | Detach a child group |
| `PATCH` | `/admin/submission-templates/:id/groups/reorder` | manage | Reorder child groups |
| `POST/GET/DELETE` | `/admin/submission-templates/:id/pdf-template` | manage | PDF template upload/download/delete (now on template) |
| `PUT` | `/admin/submission-templates/:id/csv-config` | manage | CSV export config (now on template) |

**Error codes:** 401, 403, 404, 409 (field_key collision), 400 (RESTRICT delete with referencing submissions).

### Consumer (teamspace) — `submission-categories.controller.ts` (reads kept, writes removed)

| Method | Path | Status | Purpose |
| --- | --- | --- | --- |
| `GET` | `/teamspaces/:teamspaceId/submission-categories` | **kept** | Picker list, `canTeamspaceSeeTemplate` |
| `GET` | `/teamspaces/:teamspaceId/submission-categories/:id` | **kept** | Template + child groups for the submit form |
| `GET` | `…/:id/csv-config` | **kept** | Read CSV config |
| `POST` / `PUT :id` / `DELETE :id` / `PUT :id/csv-config` | same paths | **410 Gone** | Centralized to admin (see spec §Centralization) |

### Read response shape (consumer)

> Documentation-only shape.
```ts
interface SubmissionTemplateForSubmit {
  id: string;
  name: string;
  icon: string;
  requires_supervisor_approval: boolean;
  require_attachment: boolean;
  // groups: 1 for migrated categories, N when admin attached more
  groups: Array<{
    id: string;
    name: string;
    display_order: number;
    is_repeating: boolean;          // always false in core rollout
    visibility_condition: VisibilityCondition | null;
    field_definitions: CustomFieldDefinition[];
  }>;
}
```

## Backend read-path repoint (the blast radius)

After M3, `submission.category` is a `SubmissionTemplate`. Most are pure `@ManyToOne` target swaps; the **two raw-SQL table literals** are mandatory and break silently otherwise:

- `submissions.service.ts:1625-1640` `getInstitutionSupervisorVisibilityCondition()` — `FROM custom_field_groups` → `FROM submission_templates`.
- `submission-visibility-predicates.ts:249` — subquery table `custom_field_groups` → `submission_templates`.

Multi-group field loading uses a new helper (NOT `findAllForTemplate`, which filters `g.is_active=true` and would empty archived categories):

> Documentation-only shape.
```ts
loadTemplateFieldDefinitions(templateId, { includeInactiveGroups: true }): Promise<CustomFieldDefinition[]>
// Junction-gated by tcfg.is_active; g.is_active gated ONLY when !includeInactiveGroups.
// PDF/CSV/receipt/render call with includeInactiveGroups:true → identical to today's find({group_id}).
```

## Migrations (`apps/tagea-backend/src/database/tenant-migrations/`, from `20260610095000`)

### M0 — extend junction CHECK (mandatory before any insert)

```sql
ALTER TABLE template_custom_field_groups
  DROP CONSTRAINT IF EXISTS template_custom_field_groups_template_type_check;
ALTER TABLE template_custom_field_groups
  ADD CONSTRAINT template_custom_field_groups_template_type_check
  CHECK (template_type IN ('appointment','case','financial_support','client_report','submission'));
```

### M2 — backfill (idempotent via NOT EXISTS), key steps

```sql
-- 1 template per submission group (incl. archived → is_archived := NOT is_active)
INSERT INTO submission_templates (id, name, ..., source_group_id, created_at, updated_at)
SELECT gen_random_uuid(), g.name, ..., g.id, now(), now()
FROM custom_field_groups g
WHERE g.entity_type='submission'
  AND NOT EXISTS (SELECT 1 FROM submission_templates st WHERE st.source_group_id=g.id);

-- old group = first child group; is_active faithful
INSERT INTO template_custom_field_groups (id, template_type, template_id, group_id, display_order, is_active, ...)
SELECT gen_random_uuid(), 'submission', st.id, st.source_group_id, 0, COALESCE(g.is_active,true), ...
FROM submission_templates st JOIN custom_field_groups g ON g.id=st.source_group_id
WHERE NOT EXISTS (SELECT 1 FROM template_custom_field_groups t
  WHERE t.template_type='submission' AND t.template_id=st.id AND t.group_id=st.source_group_id);

-- teamspace M:N migrated
INSERT INTO submission_template_teamspaces (template_id, teamspace_id, created_at)
SELECT st.id, cgt.teamspace_id, now()
FROM submission_templates st JOIN custom_field_group_teamspaces cgt ON cgt.group_id=st.source_group_id
ON CONFLICT DO NOTHING;
```

### M3 — FK repoint (forward-only)

```sql
-- precondition: abort on any unmapped category_id (data-loss guard)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM submissions s
             WHERE NOT EXISTS (SELECT 1 FROM submission_templates st WHERE st.source_group_id=s.category_id))
  THEN RAISE EXCEPTION 'submissions.category_id without template mapping — abort'; END IF;
END $$;

-- drop FK by dynamic name (real name: hr_submissions_category_id_fkey)
DO $$ DECLARE fk text; BEGIN
  SELECT con.conname INTO fk FROM pg_constraint con
    JOIN pg_class rel ON rel.oid=con.conrelid
    JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ANY(con.conkey)
    WHERE rel.relname='submissions' AND con.contype='f' AND att.attname='category_id';
  IF fk IS NOT NULL THEN EXECUTE format('ALTER TABLE submissions DROP CONSTRAINT %I', fk); END IF;
END $$;

UPDATE submissions s SET category_id = st.id
  FROM submission_templates st WHERE st.source_group_id = s.category_id;

ALTER TABLE submissions ADD CONSTRAINT fk_submissions_template
  FOREIGN KEY (category_id) REFERENCES submission_templates(id) ON DELETE RESTRICT;
-- NB: category_id is already uuid — NO ::uuid cast.
```

## Events (WebSocket / Push)

No new events. Submission notifications (supervisor visibility, configured email recipients, approval requests) keep firing from `submissions.service.ts` — they now read flags off the template instead of the group.

> **Flutter port note:** Mobile is a read/submit consumer only; no template-management contract is exposed to the app.
