# Parity: Clients List

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/clients-page/clients-page.ts`](../../../apps/tagea-frontend/src/app/pages/clients-page/clients-page.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2, staff-facing)

## Known Divergences

| Topic                             | Angular                             | Flutter (if ported)                                         |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| Table (desktop) vs cards (mobile) | `@angular/cdk/layout` breakpoint    | `LayoutBuilder` in Flutter                                  |
| Permission-gated actions          | `HasPermissionDirective`            | Conditional rendering in widget tree based on auth provider |
| Row menu                          | Custom `@tagea/ui` menu components  | `PopupMenuButton`                                           |
| Filter sheet                      | `ClientFiltersBottomSheetComponent` | `showModalBottomSheet`                                      |

## Port Log

| Date       | Who      | What                              |
| ---------- | -------- | --------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only) |
