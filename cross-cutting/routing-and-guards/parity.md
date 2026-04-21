# Parity: Routing and Guards

## Angular

- **Status:** ✅ Implemented (stable)
- **Top-level tree:** `apps/tagea-frontend/src/app/app.routes.ts`
- **Branch route tables:**
  - `apps/tagea-frontend/src/app/routes/public.routes.ts`
  - `apps/tagea-frontend/src/app/routes/institution.routes.ts`
  - `apps/tagea-frontend/src/app/routes/teamspace.routes.ts`
  - `apps/tagea-frontend/src/app/routes/client-portal.routes.ts`
  - `apps/tagea-frontend/src/app/routes/case.routes.ts`
  - `apps/tagea-frontend/src/app/routes/profile.routes.ts`
- **Sub-trees with inline guards:**
  - `apps/tagea-frontend/src/app/pages/einstellungen/einstellungen.routes.ts`
  - `apps/tagea-frontend/src/app/pages/files/files.routes.ts`
  - `apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`
- **Guards:** `apps/tagea-frontend/src/app/guards/*.ts` (34 files, ~25 distinct guards — see contracts.md)
- **Layouts reached by guards:**
  - `apps/tagea-frontend/src/app/layouts/public-main/public-main.component.ts`
  - `apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts`
  - `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts`
- **E2E:** Every file under `apps/tagea-frontend-e2e/src/` implicitly exercises routing — login flow (`login.spec.ts`), user-type routing (tests that hit `/client-portal`, `/teamspace`, `/einrichtung/:id`), and `global-setup.ts`'s URL navigation confirm `rootRedirectGuard` / `defaultModeRedirectGuard` behavior.

## Flutter

- **Status:** ⏳ Planned
- **Router:** GoRouter (recommended). Reasons:
  - Declarative route tree matches Angular's nested config naturally.
  - `redirect:` callbacks map 1:1 to `CanActivateFn`.
  - `refreshListenable:` wires re-evaluation to auth state changes (same role as Angular's subscription-free guard model).
- **Suggested structure:**
  - `lib/app/router/app_router.dart` — composes the tree, maps to `GoRouter`.
  - `lib/app/router/guards/*.dart` — one file per guard, each exposing a `GoRouterRedirect` function.
  - `lib/app/layouts/` — `PublicMainShell`, `SecureShell`, `SecureMainShell` as `ShellRoute` builders.
- **Integration tests:** `integration_test/routing/` — mirror the key E2E flows: unauthenticated landing, pending-employee block, deep-link to institution, client lands on client portal, mode switching persistence.

## Known Divergences

- **`canDeactivate`**: GoRouter has no built-in equivalent. The Flutter port will implement unsaved-changes via `PopScope` widgets (Flutter 3.12+) on each editable form, showing the same dialog shape (`UnsavedChangesDialogComponent`) as a Material dialog. The guard abstraction collapses into a reusable `UnsavedChangesScope` widget.
- **Auth callback**: OAuth return in Flutter uses `flutter_appauth` with a custom scheme; the `/auth/callback` URL has no Flutter counterpart. The redirect target after token exchange should route to `/` (then `rootRedirect` takes over, same as Angular).
- **Silent SSO**: Browser-only. `rootRedirectGuard.trySilentLogin()` has no Flutter analog — the Flutter app will skip that branch and rely on the refresh-token branch.
- **Legacy redirects** under `einstellungen/*` (`legacyFlatEinrichtungRedirectGuard`, `legacyEinrichtungRedirectGuard`, `legacyMitarbeitendeRedirectGuard`) exist to preserve Angular bookmarks and have no reason to ship in Flutter's first release. Skip them unless a user flow actually deep-links through those paths.
- **Console logging**: All Angular guards emit verbose `console.log` traces for debugging. Flutter port should route these through the shared logger instead of `print`.

## Port Log

| Date       | Who      | What                                                                                        |
| ---------- | -------- | ------------------------------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec created — full route tree, all 25+ guards catalogued, entry-decision flows diagrammed. |
