# Parity: Custom Field Number Formats

## Angular

- **Status:** ⏳ Spec drafted — implementation not started
- **Path:** `apps/tagea-frontend/src/app/components/custom-fields/number-field/` (input), `apps/tagea-frontend/src/app/utils/custom-field-display.utils.ts` (display utility — new file), admin editors under `apps/tagea-frontend/src/app/admin/...` and `apps/tagea-frontend/src/app/pages/administration/shared/...`
- **E2E:** new coverage to be added under `apps/tagea-frontend-e2e/src/...` — one happy-path per kind (integer, decimal + unit, currency, percentage)

## Flutter

- **Status:** ❌ Not planned for this iteration. Flutter currently does not render admin editors for custom-field definitions, so the admin-facing surface of this feature is out of scope there. The end-user input and display rules become relevant whenever Flutter starts rendering number custom fields (e.g. in client-profile / client-termine / teamspace-submissions); at that point this spec is the source of truth.

## Known Divergences

None today — when Flutter picks up number custom fields, it should follow the same rules. Admin-only screens are expected to remain Angular-only.

## Port Log

| Date       | Who       | What                                          |
| ---------- | --------- | --------------------------------------------- |
| 2026-04-22 | baumgart  | Spec created                                  |
