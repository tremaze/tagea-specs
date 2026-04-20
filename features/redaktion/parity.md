# Parity: Redaktion

## Angular

- **Status:** ✅ Implemented (three mounts)
- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/redaktion-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/redaktion-page.component.ts)
- **Editor:** [`redaktion-editor.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/redaktion-editor.component.ts)
- **Stats / Categories sub-components:** `RedaktionStatsComponent`, `RedaktionCategoriesComponent`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal for Flutter (editor/admin surface; web-first)
- If ever ported: `lib/features/redaktion/` with three entry routes backed by a `RedaktionScope` enum parameter.

## Known Divergences

| Topic                  | Angular                                | Flutter (if ported)               |
| ---------------------- | -------------------------------------- | --------------------------------- |
| Scope discrimination   | URL inspection + `route.data`          | Enum parameter on a single widget |
| Rich text editor       | Angular Material + custom editor       | `flutter_quill` or similar        |
| Image upload in editor | Browser file input                     | `image_picker`                    |
| Filter sheet (mobile)  | `RedaktionFiltersBottomSheetComponent` | `showModalBottomSheet`            |

## Port Log

| Date       | Who      | What                                                         |
| ---------- | -------- | ------------------------------------------------------------ |
| 2026-04-20 | ltoenjes | Spec created (documentation only — Flutter port is non-goal) |
