# Instructions for Claude when working with specs

## When creating a new spec

1. Copy `_templates/feature/` to `features/<feature-name>/` (or use `specs/_scripts/new-spec.sh <slug>`)
2. Populate **spec.md** based on:
   - Angular code under `apps/tagea-frontend/src/app/...`
   - E2E tests under `apps/tagea-frontend-e2e/src/...` (they describe observable behavior — gold for spec extraction)
   - **Backend DTOs and entities under `apps/tagea-backend/src/**/dto/_.dto.ts`+`_.entity.ts`\*\* — these are the authoritative wire contracts and database shapes. Always prefer them over inferred types from the frontend service. Especially important when:
     - A field looks enum-like in the UI (it may actually be tenant-configurable from a database table — check for an entity by that name)
     - The frontend type definition is sparse / inferred (e.g. `relationship_type: string`) — the backend DTO often has Swagger comments with example values
     - The endpoint path is not obvious from the frontend service (frontend often uses `apiConfig.getApiUrl(...)` indirection; the backend controller decorator gives you the real route)
3. Add the feature to the parity matrix in `specs/README.md`
4. Link Angular paths from `parity.md`
5. **Run `node specs/_scripts/verify-contracts.js <slug>`** before considering the spec ready. Any DRIFT lines indicate that a field / method / interface named in `contracts.md` does not exist in the Angular source — either a typo, a stale name, or a hallucination. Fix the spec or, if the shape is intentionally documentation-only, prefix the code block with a blockquote containing "Documentation-only shape." (or add `// documentation-only` inside the block). Flutter port notes can live in `dart` fenced blocks or under a "Flutter port note:" blockquote — those are skipped automatically.

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
