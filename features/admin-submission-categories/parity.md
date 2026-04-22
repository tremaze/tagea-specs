# Parity: Admin — Submission Categories

## Angular

- **Status:** 🚧 Implemented with known gap (PDF upload/placeholder dialog now wired into sidecard; shipped alongside the `effect()` form-hydration fix)
- **Path:** `apps/tagea-frontend/src/app/pages/administration/daten/einreichungs-kategorien/`
- **Shared primitives:** `apps/tagea-frontend/src/app/pages/administration/shared/custom-fields/`
- **E2E:** _(not yet — Flutter-first project, admin desktop surface has no E2E coverage yet)_

## Flutter

- **Status:** ❌ Not planned
- **Rationale:** Desktop-only administration. Submitter-side feature (`teamspace-submissions`) is separately tracked for port.

## Known Divergences

None — admin surface is Angular-only by design.

## Port Log

| Date       | Who       | What                                                                    |
| ---------- | --------- | ----------------------------------------------------------------------- |
| 2026-04-22 | baumgart  | Spec created after implementing PDF sidecard section + form-hydration fix |
