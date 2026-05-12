# Parity: Department Picker

## Angular

- **Status:** ⏳ (spec written 2026-05-05; implementation in progress)
- **Path:**
  - `apps/tagea-frontend/src/app/admin/services/departments-http.service.ts`
  - `apps/tagea-frontend/src/app/components/client-dialog/client-dialog.component.ts`
  - `apps/tagea-frontend/src/app/components/case-management/case-dialog/case-dialog.component.ts`
  - `apps/tagea-frontend/src/app/components/case-management/case-management-list.component.ts`
  - `apps/tagea-frontend/src/app/services/clients-data.service.ts`
  - `apps/tagea-frontend/src/app/services/cases-data.service.ts`
  - `apps/tagea-frontend/src/app/pages/profile-page/components/profile-stammdaten.component.ts`
- **E2E:**
  - `apps/tagea-frontend-e2e/src/tests/clients/access-control-client-dialog-department-picker.spec.ts`
  - `apps/tagea-frontend-e2e/src/tests/cases/access-control-case-dialog-department-picker.spec.ts`
  - `apps/tagea-frontend-e2e/src/tests/clients/access-control-clients-list-department-filter-cross-institution.spec.ts`

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/features/departments/...` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/department_picker/...`

## Known Divergences

- Flutter caches the assignable response per `(userId, institutionId)` for offline use; Angular re-fetches each picker open.
- "(Kein Department)" sentinel is rendered identically on both platforms but is not part of the wire response; backend always returns `Department[]`.

## Port Log

| Date       | Who         | What                                                                          |
| ---------- | ----------- | ----------------------------------------------------------------------------- |
| 2026-05-05 | svenarbeit  | Spec created. Replaces ad-hoc use of `getMyDepartments()` and `getActive()` across six call sites. Drives a new `institution.departments.access_all` permission. |
