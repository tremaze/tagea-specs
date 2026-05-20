# Parity: Auth Session Refactor

> Replacement for the legacy 18-stop auth-hydration chain. Single backend endpoint, single frontend store, single authz facade.

## Angular

- **Status:** ✅ Implemented (M1–M5 + Cluster 3.1/3.4/3.5). Branch `claude/refactor-auth-hydration-AtRNs` → PR [#78 → develop](https://github.com/tremaze/tagea-next/pull/78).
- **Frontend module:** `apps/tagea-frontend/src/app/auth-session/`
  - `session-store.service.ts` — single state holder (signals)
  - `session-authz.service.ts` — permission + feature lookup facade
  - `session-identity.service.ts` — display reads
  - `navigation-mode.service.ts` — URL-derived mode signal
  - `institution-context.service.ts` — URL-derived institution-id signal (relocated, kept sticky per Phase-D audit)
  - `session-bootstrap.service.ts` — APP_INITIALIZER pipeline + OIDC-flip listener
  - `session-router.service.ts` — pure `Landing.scope` → router commands mapping
  - `session-switcher.service.ts` — `setTenant`/`setInstitution`/`refreshSession`
  - `session-logout.service.ts` — symmetric teardown (push, theme, matrix, OIDC)
  - `session-preferences.service.ts` — `recordVisitedInstitution(id)` writer
  - `post-session-hydration.service.ts` — Sentry/Push/Matrix/Preferences/Theme apply
  - `boot-tracer.service.ts` — structured boot logs
  - `oidc-lifecycle.service.ts` — bridge to `@tagea/auth` events
  - `authz-guards.ts` — factory guards (`requirePermission`, `requireFeature`, …)
  - `session-institution-url.guard.ts` — replaces `institutionUrlGuard`
  - `session-landing-redirect.guard.ts` — replaces `defaultModeRedirectGuard`
- **Shared package:** `packages/session/` — `Session` DTO, `BOOT_ID_HEADER`, `PersonaClassifier`
- **Backend module:** `apps/tagea-backend/src/auth/session/`
  - `session.controller.ts` — `GET /session`
  - `session-preferences.controller.ts` — `PUT /session/preferences/last-visited-institution`
  - `session-assembler.service.ts` — composes the DTO from principal + tenant + features
  - `landing-resolver.service.ts` — computes `Landing.mode` + `scope` + `rationale`
  - `session-preferences.service.ts` — persists `last_visited_institution_id`
  - `boot-id.middleware.ts` — validates + echoes `X-Boot-Id`
- **E2E:** `apps/tagea-frontend-e2e/src/auth-session/`
  - `landing-teamspace-only.spec.ts`
  - `landing-institution-only.spec.ts`
  - `landing-client-portal.spec.ts`
  - `landing-personalverwalter.spec.ts` (added Wave 4)
  - `landing-super-admin.spec.ts` (added Wave 4)
  - One additional persona spec planned

## Test coverage (snapshot 2026-05-12)

| Suite | Tests | Branch delta |
| --- | --- | --- |
| `tagea-frontend` Vitest | 277 / 277 | +33 |
| `@tagea/auth` Vitest | 20 / 20 | +4 |
| `tagea-backend` Jest (full) | 1096 / 1096 | green |
| `tagea-backend` session module Jest | 49 / 49 | +27 |
| `tagea-backend` employees Jest | 38 / 38 | unchanged |
| `tagea-frontend-e2e` auth-session Playwright | 6 specs | +2 |

## Flutter

- **Status:** ⏳ Planned. The Flutter app today bootstraps via a different code path (Keycloak SDK + legacy `/auth/current`) — the consolidation has not been ported.
- **Path:** `lib/features/auth_session/...` (in tagea-flutter repo, when ported)
- **Integration tests:** `integration_test/auth_session_test.dart`
- **Port plan:**
  - Generate `Session` DTO Dart classes from the [shared `@tagea/session` TS types](../../../packages/session/src/lib/session.dto.ts). Use `json_serializable` for the body; write `LandingScope.fromJson` manually because of the discriminated union.
  - Riverpod provider `sessionProvider` wraps the same single-source-of-truth pattern. `SessionBootstrap` becomes a `FutureProvider.autoDispose` chained from the OIDC initialisation.
  - GoRouter `redirect`/`refreshListenable` derives the landing from `Session.landing.scope` via the same router-mapping function. Implement it as a top-level pure function so the unit tests look like Angular's `session-router.service.spec.ts`.
  - Permission/feature lookups become extension methods on `Session` (functional style fits Dart better than the `SessionAuthz` class) — exact same predicates as the Angular service.
  - Boot-ID + push-brand routing the same as Angular. Persistent storage swaps to `shared_preferences`.

## Known Divergences

- **`InstitutionContext` is sticky on the web** (per Phase-D audit `project_institution_context_audit.md`). Flutter port should default to the same sticky semantic; URL-only is achievable on Flutter because the consumer set is smaller, but reproducing parity is cheaper than re-arguing the design.
- **PostHydration push-init differs by platform**: web uses `PushSubscription`, native uses Capacitor FCM, Flutter uses `firebase_messaging`. The trigger (presence of `session.tenant.pushBrandId`) is identical; the registration call is per-platform.
- **Tenant-switch reload** is a `window.location.href = '/'` on web. Flutter must restart its top-level provider scope instead — there is no browser-equivalent reload.
- **Matrix-client init** lives in the Angular `@tagea/chat` package via `ChatService.connect()`. Flutter port uses a different Matrix SDK (matrix_dart_sdk) — the trigger and gate (`feature.chat.enabled` + tenant-permission `CHAT_ACCESS`) match; the call differs.

## Port Log

| Date       | Who | What                                                                                                                  |
| ---------- | --- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-04-29 | sb  | M1 spec + persona classifier draft committed                                                                          |
| 2026-04-30 | sb  | M1 shipped: `@tagea/session` package, `GET /session`, SessionBootstrap, 3-persona E2E                                 |
| 2026-05-01 | sb  | M2 shipped: SessionAuthz lookup service, factory authz guards, last-visited institution persistence                   |
| 2026-05-03 | sb  | M3 shipped: factory guards, 26 legacy guards deleted                                                                  |
| 2026-05-04 | sb  | M4 shipped: component migration to `SessionAuthz`/`SessionIdentity`, NavigationMode introduced, post-session-hydration |
| 2026-05-09 | sb  | M5 hard-cut: `UnifiedAuthService`/`AuthorizationStore`/`UserPermissionsService`/legacy guards/dead endpoints removed; `InstitutionContext` relocated to auth-session (Phase D Option B) |
| 2026-05-11 | sb  | Phase A/B/C: branch-reanimation, 6 production bugs fixed during smoke, test coverage waves 1+2 (SessionBootstrap, SessionAssembler raw-SQL regression, OidcLifecycle) |
| 2026-05-12 | sb  | Cluster 3.1 (raw SQL → TypeORM), 3.4 (PostHydration consolidation), 3.5 (preferences + theme in DTO), Phase-D audit close-out; this spec doc filled in for M2–M5+ |
