# Parity: Tasks

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts`](../../../apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts)
- **E2E:** none under `apps/tagea-frontend-e2e/src/` as of 2026-04-21

## Flutter

- **Status:** ❌ Non-goal (P2, staff-facing)

## Known Divergences

| Topic                             | Angular                        | Flutter (if ported)                             |
| --------------------------------- | ------------------------------ | ----------------------------------------------- |
| Filter persistence                | Uses service + component state | `TaskFilterCubit` (single cubit holding `{ filter, searchText }` in state) |
| Table (desktop) vs cards (mobile) | `MatTable` + sort / card list  | `DataTable` vs `ListView.builder` by breakpoint |

## Port Log

| Date       | Who      | What                              |
| ---------- | -------- | --------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only) |
