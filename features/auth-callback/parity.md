# Parity: Auth Callback

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/components/auth-callback/auth-callback.component.ts`](../../../apps/tagea-frontend/src/app/components/auth-callback/auth-callback.component.ts)
- **E2E:** _(to be identified — transitively covered by any authenticated e2e test)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/auth_bootstrap_page.dart` (or inline into the post-`flutter_appauth` redirect)
- **Approach:** replicate the two-phase wait (token exchange → profile load) with a `FutureBuilder` or a dedicated route that shows a spinner until either navigation target resolves.
- **Integration tests:** `integration_test/auth_bootstrap_test.dart`

## Known Divergences

| Topic             | Angular                                    | Flutter                                                                       |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Callback trigger  | Browser redirect to `/auth/callback` route | Deep-link back into the app from an external browser tab (`flutter_appauth`)  |
| Route presence    | Dedicated route `/auth/callback`           | May not need a distinct route; bootstrap can be inlined in the app-start flow |
| Timeout tolerance | 120s (accommodates E2E auto-provisioning)  | Likely shorter in production; test-env can extend via build flag              |
| Log output        | `console.log` / `console.error`            | Use `debugPrint` or a logging package; strip in release builds                |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
