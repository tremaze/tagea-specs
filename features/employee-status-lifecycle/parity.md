# Parity: Employee Status Lifecycle

## Angular

- **Status:** ⏳ Spec drafted — implementation pending
- **Path:** `apps/tagea-frontend/src/app/components/employee-dialog/` (status section + timeline renderer)
- **Service:** `apps/tagea-frontend/src/app/services/employees.service.ts`
- **E2E:** `apps/tagea-frontend-e2e/src/tests/employees/admin-status-lifecycle.spec.ts` (new)

## Flutter

- **Status:** ⏳ Not planned for v1
- **Path:** `lib/features/employees/...` _(in tagea-flutter repo, when picked up)_
- **Integration tests:** `integration_test/employees/...`

## Known Divergences

- **Admin-facing only.** This feature lives in the admin dialog, which the Flutter app does not currently expose. Self-suspend (`DELETE /employees/me`) is the only flow that matters for the employee app — the existing endpoint already works and the Flutter port can adopt it without waiting for the rest of this feature.
- **Confirmation dialogs** rely on Angular Material dialog patterns; Flutter would use its native `showDialog` equivalent.

## Port Log

| Date       | Who      | What                                                                                          |
| ---------- | -------- | --------------------------------------------------------------------------------------------- |
| 2026-04-27 | baumgart | Spec created. Open decisions D1–D5 documented; implementation blocked on those.                |
