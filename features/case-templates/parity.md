# Parity: Case Templates

## Angular implementation

| Component | Path | Scope |
|---|---|---|
| Inst-Admin tab | `apps/tagea-frontend/src/app/pages/case-management-admin/case-management-admin.component.ts` | Institution |
| Inst-Admin state | `apps/tagea-frontend/src/app/pages/case-management-admin/case-template-state.service.ts` (or v2 equivalent) | Institution |
| Tenant-Admin page | `apps/tagea-frontend/src/app/pages/admin-case-templates/` _(to be created)_ | Tenant |
| Tenant-Admin service | `apps/tagea-frontend/src/app/services/admin-case-templates.service.ts` _(to be created)_ | Tenant |
| Generic template form | `apps/tagea-frontend/src/app/components/generic-template-form/` (reused) | Both |

## Flutter port

**Status:** ⏳ Not planned — template management is web-only. Mobile clients consume the picker (`institution.case_templates.list`) which is already covered by existing case-create flows.

## Backend implementation

| Module | Path |
|---|---|
| Inst-scope service | `apps/tagea-backend/src/cases/services/case-templates.service.ts` |
| Inst-scope controller | `apps/tagea-backend/src/cases/controllers/case-templates.controller.ts` |
| Tenant-scope service | `apps/tagea-backend/src/cases/services/admin-case-templates.service.ts` _(to be created)_ |
| Tenant-scope controller | `apps/tagea-backend/src/cases/controllers/admin-case-templates.controller.ts` _(to be created)_ |
| Junction entity | `apps/tagea-backend/src/cases/entities/case-template-institution.entity.ts` _(to be created)_ |
| Migration | `apps/tagea-backend/src/database/tenant-migrations/<timestamp>-AddCaseTemplateInstitutions.ts` _(to be created)_ |

## E2E tests

| Spec | Purpose |
|---|---|
| `templates-berater-permission-tripwire.spec.ts` | After refactor: assert 403 on Berater POST (regression guard) |
| `templates-admin-creates-archives-restores.spec.ts` | Existing — Inst-Admin lifecycle on owned templates |
| `templates-allowed-appointment-templates-restriction.spec.ts` | Existing — `allowed_appointment_template_ids` array filtering |
| `templates-inst-admin-decouples-shared.spec.ts` _(new)_ | Inst-Admin can decouple but not edit shared templates |
| `templates-tenant-admin-multi-institution.spec.ts` _(new)_ | Tenant-Admin POST with multi-institution_ids creates one template + N junctions |
