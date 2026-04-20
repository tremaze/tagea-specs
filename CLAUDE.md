# Instructions for Claude when working with specs

## When creating a new spec

1. Copy `_templates/feature/` to `features/<feature-name>/`
2. Populate **spec.md** based on:
   - Angular code under `apps/tagea-frontend/src/app/...`
   - E2E tests under `apps/tagea-frontend-e2e/src/...` (they describe observable behavior — gold for spec extraction)
   - Backend contracts (DTOs, endpoints)
3. Add the feature to the parity matrix in `specs/README.md`
4. Link Angular paths from `parity.md`

## When reading a spec for a Flutter port

You are likely in the **tagea-flutter** repo reading this spec via the `reference/` submodule.

- **spec.md** is the authoritative source for behavior
- Angular code under `reference/apps/tagea-frontend/...` is **reference**, not a translation target — idiomatic Flutter code beats a 1:1 port
- E2E tests under `reference/apps/tagea-frontend-e2e/...` should be mirrored as Flutter `integration_test/` cases (same behavior, different syntax)
- If spec and Angular code disagree: the spec wins. Report the inconsistency.

## When Angular behavior changes

**The spec is source of truth.** When Angular code changes:

1. Ask: does observable behavior change?
2. If yes: update the spec in the same PR
3. Reset the Flutter status in `parity.md` to ⏳ (port must catch up)

## Language

Write all specs, templates, and this file in **English**. User-facing strings (i18n keys, error messages shown to end users) stay in German — those are product content, not technical docs.
