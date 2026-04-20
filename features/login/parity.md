# Parity: Login

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/login/`](../../../apps/tagea-frontend/src/app/pages/login/)
- **Auth service:** [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
- **E2E:** _(not yet identified — add link)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/`
- **Recommended packages:**
  - `flutter_appauth` (OIDC flow with PKCE)
  - `flutter_secure_storage` (token persistence)
- **Integration tests:** `integration_test/auth_test.dart`

## Known Divergences

| Topic              | Angular                                     | Flutter                                  |
| ------------------ | ------------------------------------------- | ---------------------------------------- |
| Token storage      | Browser localStorage (via Keycloak adapter) | Secure storage (Keychain / Keystore)     |
| Redirect mechanism | Full-page redirect to Keycloak              | In-app browser tab (`flutter_appauth`)   |
| Deep-link handling | URL parameters visible in the browser       | Custom URL scheme or app links           |
| Biometric unlock   | not present                                 | phase 2 — no Angular counterpart planned |

## Port Log

| Date       | Who      | What                                          |
| ---------- | -------- | --------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (pilot for workflow calibration) |
