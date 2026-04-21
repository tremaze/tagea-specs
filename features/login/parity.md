# Parity: Login

## Angular

- **Status:** ✅ Implemented
- **Entry guard:** [`apps/tagea-frontend/src/app/guards/root-redirect.guard.ts`](../../../apps/tagea-frontend/src/app/guards/root-redirect.guard.ts)
- **Public routes (`/login` redirect, `/welcome`, `/auth/callback`):** [`apps/tagea-frontend/src/app/routes/public.routes.ts`](../../../apps/tagea-frontend/src/app/routes/public.routes.ts)
- **Landing page (IdP redirect entry):** [`apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts)
- **Auth service (OIDC primitives):** [`packages/auth/src/lib/services/auth.service.ts`](../../../packages/auth/src/lib/services/auth.service.ts) (`@tagea/auth`)
- **App-level auth orchestration:** [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
- **Vestigial (not mounted by any route):** `apps/tagea-frontend/src/app/pages/login/` and `apps/tagea-frontend/src/app/components/login/`
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
