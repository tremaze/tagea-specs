# Parity: Cases List

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/cases-page/cases-page.ts`](../../../apps/tagea-frontend/src/app/pages/cases-page/cases-page.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2, staff-facing)

## Known Divergences

| Topic             | Angular                                         | Flutter (if ported)                          |
| ----------------- | ----------------------------------------------- | -------------------------------------------- |
| Auto-load ceiling | `MAX_AUTO_LOAD = 300`                           | Same constant; mirror exactly                |
| Status colors     | `getCaseStatusColor()` returning Material color | Dart enum → `Color` map in a theme extension |
| Category icons    | `CATEGORY_ICONS` Record                         | Dart `Map<String, IconData>`                 |

## Port Log

| Date       | Who      | What                              |
| ---------- | -------- | --------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only) |
