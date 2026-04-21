# Parity: Mode Toggle

## Angular

- **Status:** ✅ Implemented
- **Path:**
  - `apps/tagea-frontend/src/app/services/navigation-mode.service.ts` — state + URL sync + persistence
  - `apps/tagea-frontend/src/app/components/mode-toggle/mode-toggle.component.ts` — toggle UI (icon button / institution menu)
  - `apps/tagea-frontend/src/app/guards/default-mode-redirect.guard.ts` — initial-landing redirect using the persisted mode
  - `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts` — filters `staticNavigationItems` by mode
- **E2E:** _(to be identified — search `apps/tagea-frontend-e2e` for "Teamspace wechseln" / "Einrichtung wechseln")_

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/features/shell/mode_toggle/…` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/shell/mode_toggle_test.dart` _(to be created)_

## Known Divergences

- **Storage backend:** Angular uses `localStorage`; Flutter should use `SharedPreferences` (or `FlutterSecureStorage` if the tenant's policy requires it). The **key name and value strings must match** so that a hypothetical shared-profile future can read both.
- **URL inference:** Angular inspects raw path prefixes (`/teamspace`, `/einrichtung/`). Flutter should branch on `GoRouter` route names instead of path strings, but the mapping must yield the same mode for the same logical route.
- **Default-mode redirect:** in Angular this is a `CanActivateFn` guard on `/`. In Flutter, equivalent logic belongs in the `redirect` of the root route in `GoRouter`.
- **Institution-picker menu:** Angular uses the shared `@tagea/ui` menu. Flutter should use `showModalBottomSheet` on mobile and a `PopupMenuButton` on tablet/desktop, but the item order (A-Z by institution name) and single-click behaviour must match.

## Port Log

| Date       | Who      | What                                                                                                       |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec drafted: state model, initialization order, URL auto-sync, persistence, toggle visibility, edge cases |
