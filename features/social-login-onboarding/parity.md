# Parity: Social Login & Post-Login Onboarding

## Angular

- **Status:** ⏳ Planned (spec drafted, implementation pending)
- **Path:** `apps/tagea-frontend/src/app/pages/onboarding/...` (to be created)
- **Guards:** `apps/tagea-frontend/src/app/guards/onboarding.guard.ts` (to be created)
- **State service:** `apps/tagea-frontend/src/app/services/onboarding-state.service.ts` (to be created)
- **Landing page (social buttons):** `apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts` (existing — to be extended)
- **E2E:** `apps/tagea-frontend-e2e/src/tests/cases/social-login-onboarding.spec.ts` (to be added)

## Flutter

- **Status:** ⏳ Planned (depends on Angular implementation landing first)
- **Path:** `lib/features/onboarding/...` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/social_login_onboarding_test.dart`

## Known Divergences

- **Native social buttons.** The web flow uses Keycloak-brokered redirects for all three providers. The Flutter port may, in a follow-up, swap to the native Sign in with Apple / Google Sign-In SDKs (which then exchange tokens with Keycloak via the `urn:ietf:params:oauth:grant-type:token-exchange` flow) for a more native UX. The spec's behavioral contract is identical either way — the divergence is purely how the IdP redirect surface is rendered.
- **Offline tenant cache.** Flutter caches the public-discovery list with a 24h TTL (see spec → Offline Behavior). Angular does not — it fetches on every visit.
- **Push delivery.** Flutter uses FCM/APNs end-to-end; Angular uses the web push transport. Both subscribe to the same `*_REGISTRATION_PENDING` / `*_APPROVED` / `*_REJECTED` notification types.

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-20 | ltoenjes | Spec created |
