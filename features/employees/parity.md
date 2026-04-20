# Parity: Employees List

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employees-page/employees-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/employees-page/employees-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2 staff admin)

## Known Divergences

| Topic             | Angular                                           | Flutter (if ported)                     |
| ----------------- | ------------------------------------------------- | --------------------------------------- |
| Role/status chips | `EMPLOYEE_ROLES` / `EMPLOYEE_STATUS` const arrays | Dart enums with `Color` theme extension |
| Table vs cards    | `@angular/cdk/layout` breakpoint                  | `LayoutBuilder`                         |
| Auto-load ceiling | `MAX_AUTO_LOAD = 300`                             | Mirror verbatim                         |

## Port Log

| Date       | Who      | What                              |
| ---------- | -------- | --------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only) |
