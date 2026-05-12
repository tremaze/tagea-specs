# Contracts: Case Templates

## Data Model

```ts
// case_templates table — institution_id removed; relation moved to junction
export interface CaseTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;          // Material icon name
  color: string;         // hex / token
  is_active: boolean;
  is_archived: boolean;
  allowed_appointment_template_ids: string[];
  custom_field_group_id: string | null;
  service_record_definition_id: string | null;
  created_by_employee_id: string;
  created_at: string;
  updated_at: string;

  // Loaded via @OneToMany
  institution_assignments?: CaseTemplateInstitution[];
}

// New junction table — composite PK, CASCADE on template delete
export interface CaseTemplateInstitution {
  template_id: string;
  institution_id: string;
  created_at: string;
}
```

```sql
-- New tenant migration
CREATE TABLE case_template_institutions (
  template_id     uuid NOT NULL REFERENCES case_templates(id) ON DELETE CASCADE,
  institution_id  uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, institution_id)
);
CREATE INDEX idx_cti_template_id    ON case_template_institutions (template_id);
CREATE INDEX idx_cti_institution_id ON case_template_institutions (institution_id);

-- Backfill (aggressive — see spec.md "Edge Cases")
INSERT INTO case_template_institutions (template_id, institution_id)
SELECT t.id, t.institution_id
  FROM case_templates t
 WHERE t.institution_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO case_template_institutions (template_id, institution_id)
SELECT t.id, i.id
  FROM case_templates t
 CROSS JOIN institutions i
 WHERE t.institution_id IS NULL
   AND i.is_active = true
ON CONFLICT DO NOTHING;

ALTER TABLE case_templates DROP COLUMN institution_id;
```

## DTOs

### Institution-scope (Inst-Admin)

```ts
// Create — institution comes from URL param, no institution_ids in body
export interface CreateInstitutionCaseTemplateDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  allowed_appointment_template_ids?: string[];
  custom_field_group_id?: string | null;
  service_record_definition_id?: string | null;
}

// Update — same shape as create, all fields optional. NO institution_ids.
export type UpdateInstitutionCaseTemplateDto = Partial<CreateInstitutionCaseTemplateDto>;
```

### Tenant-scope (Tenant-Admin)

```ts
// Create — institution_ids required (≥1), template will be assigned to these
export interface CreateTenantCaseTemplateDto extends CreateInstitutionCaseTemplateDto {
  institution_ids: string[]; // ≥1 element, validated server-side
}

// Update — institution_ids OPTIONAL; if present, applies as full diff (add/remove rows)
export interface UpdateTenantCaseTemplateDto extends Partial<CreateInstitutionCaseTemplateDto> {
  institution_ids?: string[];
}
```

### Read responses (both scopes)

```ts
// Institution-scope responses additionally carry an owner-indicator
export interface InstitutionCaseTemplateResponse extends CaseTemplate {
  is_exclusive_to_current_institution: boolean; // true ⇔ junction-count = 1 AND that 1 is current
  shared_with_count: number;                    // total junction-count incl. current
}

// Tenant-scope responses carry institution-id list
export interface TenantCaseTemplateResponse extends CaseTemplate {
  institution_ids: string[];
}
```

## Backend Endpoints

### Institution-scope

> Base prefix: `INSTITUTION_ROUTE_PREFIX = 'institutions/:institutionId'`
> Guard: `@Auth({ scope: 'institution', permissions: [...] })`

| Method + Path | Permission | Behavior |
|---|---|---|
| `GET    institutions/:institutionId/case-templates/minimal` | `CASE_TEMPLATES_LIST` | Picker — id/name/icon/color/is_active for active templates of this institution |
| `GET    institutions/:institutionId/case-templates/active` | `CASE_TEMPLATES_LIST` | Picker — full list, only is_active=true and is_archived=false |
| `GET    institutions/:institutionId/case-templates` | `CASE_TEMPLATES_VIEW` | Full list of templates assigned to this institution |
| `GET    institutions/:institutionId/case-templates/archived` | `CASE_TEMPLATES_VIEW` | Archived templates of this institution |
| `GET    institutions/:institutionId/case-templates/archived/minimal` | `CASE_TEMPLATES_VIEW` | Archived list, minimal fields |
| `GET    institutions/:institutionId/case-templates/overview` | `CASE_TEMPLATES_VIEW` | List + custom-field-group expansion |
| `GET    institutions/:institutionId/case-templates/:id` | `CASE_TEMPLATES_VIEW` | Single template detail |
| `POST   institutions/:institutionId/case-templates` | `CASE_TEMPLATES_CREATE` | Create + auto-junction to current institution |
| `PATCH  institutions/:institutionId/case-templates/:id` | `CASE_TEMPLATES_EDIT` | Update — 403 if template is shared (junction-count > 1) |
| `PATCH  institutions/:institutionId/case-templates/:id/toggle-active` | `CASE_TEMPLATES_EDIT` | Same shared-guard as Edit |
| `PATCH  institutions/:institutionId/case-templates/:id/archive` | `CASE_TEMPLATES_DELETE` | Same shared-guard as Edit |
| `PATCH  institutions/:institutionId/case-templates/:id/unarchive` | `CASE_TEMPLATES_EDIT` | Same shared-guard as Edit |
| `DELETE institutions/:institutionId/case-templates/:id` | `CASE_TEMPLATES_DELETE` | 400 if template is shared (use decouple); else hard-delete |
| `DELETE institutions/:institutionId/case-templates/:id/decouple` | `CASE_TEMPLATES_DELETE` | Remove junction row only; 400 if last-institution (use delete) |

### Tenant-scope

> Base prefix: `/admin/case-templates`
> Guard: `@Auth({ scope: 'tenant', permissions: [...] })`

| Method + Path | Permission | Behavior |
|---|---|---|
| `GET    /admin/case-templates` | `TENANT_CASE_TEMPLATES_VIEW` | Full tenant-wide list with `institution_ids` per template |
| `GET    /admin/case-templates/:id` | `TENANT_CASE_TEMPLATES_VIEW` | Single template detail incl. `institution_ids` |
| `POST   /admin/case-templates` | `TENANT_CASE_TEMPLATES_CREATE` | Create + N junction rows from `institution_ids` (≥1 required) |
| `PATCH  /admin/case-templates/:id` | `TENANT_CASE_TEMPLATES_EDIT` | Update fields + diff `institution_ids` (add/remove junctions) |
| `DELETE /admin/case-templates/:id` | `TENANT_CASE_TEMPLATES_DELETE` | Hard-delete template (junction CASCADE) |

## Permission Constants

```ts
// packages/permissions/src/lib/permissions.ts (additions)
CASE_TEMPLATES_VIEW:   'institution.case_templates.view',
CASE_TEMPLATES_CREATE: 'institution.case_templates.create',
CASE_TEMPLATES_EDIT:   'institution.case_templates.edit',
CASE_TEMPLATES_DELETE: 'institution.case_templates.delete',
// CASE_TEMPLATES_LIST already exists: 'institution.case_templates.list'

TENANT_CASE_TEMPLATES_VIEW:   'tenant.case_templates.view',
TENANT_CASE_TEMPLATES_CREATE: 'tenant.case_templates.create',
TENANT_CASE_TEMPLATES_EDIT:   'tenant.case_templates.edit',
TENANT_CASE_TEMPLATES_DELETE: 'tenant.case_templates.delete',
```

## Services (Frontend)

| Service | Scope | Purpose |
|---|---|---|
| `CaseTemplateStateServiceV2` | Inst-Admin | List + CRUD for current institution; surfaces `is_exclusive_to_current_institution` per template |
| `AdminCaseTemplatesService` (new) | Tenant-Admin | List + CRUD with multi-institution-assignment; mirrors `AdminAppointmentTemplatesService` structure |
