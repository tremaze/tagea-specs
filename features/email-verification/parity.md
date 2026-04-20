# Parity: Email Verification

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/email-verification/email-verification.component.ts`](../../../apps/tagea-frontend/src/app/pages/email-verification/email-verification.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/email_verification_page.dart`
- **Integration tests:** `integration_test/email_verification_test.dart`

## Known Divergences

| Topic               | Angular                         | Flutter                                                          |
| ------------------- | ------------------------------- | ---------------------------------------------------------------- |
| Source of `success` | `ActivatedRoute.queryParamMap`  | GoRouter deep-link query param                                   |
| Login action        | `UnifiedAuthService.login()`    | `ref.read(authRepoProvider).login()`                             |
| Error navigation    | `Router.navigate(['/welcome'])` | `context.go('/welcome')`                                         |
| Layout              | Material card + CSS gradient    | `Card` widget inside `Scaffold` with `LinearGradient` background |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
