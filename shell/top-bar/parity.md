# Parity: Top Bar

## Angular

- **Status:** ✅ Implemented
- **Path:**
  - `apps/tagea-frontend/src/app/components/top-bar/top-bar.component.ts`
  - `apps/tagea-frontend/src/app/components/top-bar/top-bar.component.html`
  - `apps/tagea-frontend/src/app/components/top-bar/top-bar.component.scss`
- **E2E:** Coverage split across flows that exercise the top bar — login/logout, tenant switching, institution switching, language change. See `apps/tagea-frontend-e2e/src/` (no dedicated `top-bar.spec.ts` file today; add one when porting).

## Flutter

- **Status:** 🚧 In progress (v0.1-alpha subset)
- **Path:** `apps/tagea_frontend/lib/home/widgets/` (top bar + profile menu + tenant-switch sheet) and `apps/tagea_frontend/lib/home/tagea_rail_user_menu.dart`
- **Integration tests:** `integration_test/shell/top_bar_test.dart` _(planned)_
- **v0.1 covers:** logo, title, hamburger, profile menu (display name from JWT, tenant tile + switch sheet, dark-mode toggle, logout), notifications-stub button.
- **v0.1 deliberately omits:** mode toggle, institution switcher, language switcher, patch-notes bell, notification-center panel, update indicator.

## Known Divergences

- **Page reload on tenant switch** — the Angular implementation calls `window.location.reload()` inside `setCurrentTenant()` to guarantee every component reinitializes. Flutter should instead rebuild its provider tree / re-run bootstrap effects without a full process restart.
- **Tenant logo caching** — Angular caches the signed URL for 30 minutes in-memory. Flutter may want disk caching so the logo survives app restarts offline.
- **Sub-menu UX** — Angular uses the `@tagea/ui` `MenuComponent` with nested `tagea-menu` submenus triggered by hover/click. Flutter should use a `PopupMenuButton` + bottom-sheet for wide/narrow form factors respectively; 1:1 nested-menu port is not expected.
- **Search button** — visible only on mobile in Angular via `ResponsiveNavigationService.showBottomNav()`. Flutter likely routes search through a dedicated screen; the top-bar port may omit the icon entirely.
- **Update indicator** — `AppUpdateService` is web-specific (service worker). Flutter uses platform update channels (Play Store / App Store / in-app update API) — the indicator shape differs and lives outside this bundle.
- **`@Public()` endpoints** — `/auth/me/tenants`, `/auth/me/institutions`, `/auth/current-institution` are decorated `@Public()` on the backend (authenticated but no permission check). Flutter auth guards must match.

## Port Log

| Date       | Who      | What                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec created from Angular `TopBarComponent` and backend `AuthController`. |
| 2026-04-27 | sven     | v0.1-alpha subset shipped (logo, title, hamburger, profile menu with tenant switch + dark-mode + logout, notifications-stub). Mode toggle, institution switcher, language switcher, patch-notes, notification-center, update indicator deferred to v0.2+. |
