# Parity: Submission Templates

## Angular

- **Status:** ⏳ Planned (backend-first; FE changes are minimal consumer rewire + additive admin)
- **Consumer path:** `apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts` (swap `transformToFieldGroups()` → `mapTemplateGroupsToFieldGroups()`)
- **Admin path:** `apps/tagea-frontend/src/app/admin/components/submission-template-admin/` _(to be created — recycled from `clients-custom-fields-admin/`)_
- **E2E:** `apps/tagea-frontend-e2e/src/tests/teamspace/submission-templates-*.spec.ts` _(to be created)_

### Component map

| Component | Path | Status |
| --- | --- | --- |
| Consumer submit page | `pages/teamspace/teamspace-submissions-page.component.ts` (Z.573-603) | 🚧 rewire mapper |
| Generic renderer | `components/tagea-form/components/tagea-custom-fields.component.ts` | ✅ unchanged (already multi-group/visibility-capable) |
| Group→FieldGroup mapper | `utils/custom-field-group.utils.ts` (`mapTemplateGroupsToFieldGroups`, Z.50-92) | ✅ reused |
| Admin shell | `admin/components/submission-template-admin/` _(new, base: `clients-custom-fields-admin.component.ts`)_ | ⏳ |
| Admin state | `submission-template-state.service.ts` _(new, base: `client-fields-state.service.ts`)_ | ⏳ |
| Admin group/field forms | `submission-group-form` / `submission-group-list` / `submission-field-*` _(new, 1:1 from `client-*`)_ | ⏳ |
| Repeating gate | shared group-form `allowRepeating` input | `false` until Phase E |

## Flutter

- **Status:** ⏳ Not planned — template/category management is web-only.
- **Path:** `lib/features/...` _(tagea-flutter repo)_ — picker + submit only.
- **Integration tests:** mirror consumer submit behavior; no authoring tests.

## Backend

| Module | Path | Status |
| --- | --- | --- |
| Template entity | `apps/tagea-backend/src/submissions/entities/submission-template.entity.ts` _(new)_ | ⏳ |
| Teamspace M:N entity | `apps/tagea-backend/src/submissions/entities/submission-template-teamspace.entity.ts` _(new)_ | ⏳ |
| Template service (teamspace-scoped) | `apps/tagea-backend/src/submissions/services/submission-templates.service.ts` _(new)_ | ⏳ |
| Admin controller | `apps/tagea-backend/src/submissions/controllers/admin-submission-templates.controller.ts` _(replaces `admin-submission-categories.controller.ts`)_ | ⏳ |
| Consumer controller | `apps/tagea-backend/src/submissions/submission-categories.controller.ts` _(reads kept, writes→410)_ | 🚧 |
| Read-path repoint | `submissions.service.ts` (~15 sites incl. **Z.1625-1640 SQL literal**), `submission-pdf-fill.service.ts`, `submission-receipt-generation.service.ts`, `submission-scope-query.service.ts`, **`submission-visibility-predicates.ts:249`** | ⏳ |
| TemplateType | `custom-fields/types/custom-fields.types.ts` (Z.36-43, Z.53+) | ⏳ |
| Migrations | `database/tenant-migrations/20260610095000-ExtendTemplateTypeCheckForSubmission.ts` … `20260610120000-RepointSubmissionCategoryFkToTemplates.ts` _(M0–M3)_ | ⏳ |
| Phase E (later) | EAV scalar mirroring in write-path + `…CacheTriggerForSubmissionRepeating.ts` (M4) | ⏳ deferred |

## Known Divergences

- **Repeating groups** are deferred to **Phase E** (JSONB→EAV rebuild) and gated off via `allowRepeating=false`. Core ships multi-group + conditional visibility only.
- **Persistence:** core keeps the JSONB-direct write path (`submissions.service.ts:190-191`); only Phase E moves to EAV.
- **Category management** is web-admin-only; the legacy teamspace write routes return 410.
- **No tenant feature flag** — gated by existing permission + `submissions` teamspace module; the rollout switch is transient.

## Port Log

| Date | Who | What |
| --- | --- | --- |
| 2026-06-10 | baumgart / Claude | Spec created from two adversarially-reviewed analysis workflows; Weg-2 (real `submission_templates` entity) chosen over Weg-1 (group-as-template) |
