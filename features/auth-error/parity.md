# Parity: Auth Error

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/auth-error/auth-error.component.ts`](../../../apps/tagea-frontend/src/app/pages/auth-error/auth-error.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/auth_error_page.dart`
- **Integration tests:** `integration_test/auth_error_test.dart`

## Known Divergences

| Topic          | Angular                       | Flutter                                      |
| -------------- | ----------------------------- | -------------------------------------------- |
| Background     | CSS gradient                  | `Container` with `LinearGradient` decoration |
| Retry handler  | `UnifiedAuthService.logout()` | `context.read<AuthRepository>().logout()` (or `context.read<AuthCubit>().logout()`) |
| Support footer | Static text block             | Same — static; or omit if not essential      |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
