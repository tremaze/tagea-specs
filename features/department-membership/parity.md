# Parity: Department Membership Management

## Angular

- **Status:** ✅ Implemented (with this spec's POST/PUT split)
- **Path:** `apps/tagea-frontend/src/app/components/employee-dialog/employee-dialog.component.ts`, `apps/tagea-frontend/src/app/admin/components/departments-admin/components/assign-users-dialog/`, `apps/tagea-frontend/src/app/admin/services/departments-{http,admin-http,state}.service.ts`
- **E2E:** _(to add)_ — see backend integration tests in `apps/tagea-backend/src/departments/user-department-assignments.service.spec.ts`

## Flutter

- **Status:** ⏳ Not ported (the Capacitor-wrapped Angular UI runs on iOS/Android today)
- **Path:** _n/a — admin operations are not part of the Flutter scope yet_
- **Integration tests:** _n/a_

## Known Divergences

None. The Capacitor mobile app uses the same Angular implementation, including the same HTTP services.

## Port Log

| Date       | Who         | What                                                                |
| ---------- | ----------- | ------------------------------------------------------------------- |
| 2026-04-26 | svenarbeit  | Spec created — POST=add / PUT=replace split, 50% safeguard          |
