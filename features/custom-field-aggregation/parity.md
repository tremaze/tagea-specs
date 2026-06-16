# Parity: Custom Field Aggregation (Positionslisten, Stufe 1)

## Angular

- **Status:** ⏳ Spec drafted (Stufe 1) — not implemented
- **Path:** `apps/tagea-frontend/src/app/components/tagea-form/components/` (renderer total slot), `apps/tagea-frontend/src/app/pages/administration/shared/custom-fields/` + the three group-form stacks (authoring)
- **E2E:** `apps/tagea-frontend-e2e/src/...` (to be added — admin round-trip + fill-form live total + detail total)

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/features/...` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/...`
- **Note:** Stufe 1 is display-only on the client — render the server-delivered aggregate from the `<group_key>__<source_field_key>__sum` summary key. No client-side summing needed for parity.

## Known Divergences

- The **client-local live total** (decision D-C) is a fill-form affordance on web (Angular); other clients may show only the server-delivered total without the live-while-typing recompute. Both are correct — the persisted/authoritative value is always the server value.

## Port Log

| Date       | Who      | What                                   |
| ---------- | -------- | -------------------------------------- |
| 2026-06-16 | baumgart | Spec created (Stufe 1), recon-grounded |
