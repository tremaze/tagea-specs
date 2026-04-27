# Parity: Main Navigation

## Angular

- **Status:** ✅
- **Core:** `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts`
- **Presenters:**
  - `apps/tagea-frontend/src/app/components/nav-rail/nav-rail.component.ts`
  - `apps/tagea-frontend/src/app/components/nav-drawer/nav-drawer.component.ts`
  - `apps/tagea-frontend/src/app/components/bottom-nav/bottom-nav.component.ts`
- **Responsive breakpoints:** `apps/tagea-frontend/src/app/services/responsive-navigation.service.ts`
- **Filter inputs:** `unified-auth.service.ts`, `tenant-features.service.ts`, `institution-features.service.ts`, `navigation-mode.service.ts`, `authorization-store.service.ts`
- **E2E:** No dedicated nav-filter spec; coverage happens transitively via every feature e2e that navigates into its module. Candidate for a future `shell-navigation.spec.ts`.

## Flutter

- **Status:** 🚧 In progress (v0.1-alpha minimal)
- **Path:** `apps/tagea_frontend/lib/home/` — `home_shell.dart` (adaptive bottom-nav vs. rail at 720 dp), `tagea_app_drawer.dart`, `tagea_destination.dart` (single-source-of-truth enum)
- **Integration tests:** `integration_test/shell/navigation/` _(proposed)_
- **v0.1 covers:** four destinations (home, calendar, chat, news), adaptive layout (bottom-nav < 720 dp / rail ≥ 720 dp), drawer for mobile, rail user menu for desktop.
- **v0.1 deliberately omits:** the remaining 29 Angular nav items, badge counts, mode-aware filtering, permission/feature gates, route-prefix templating for `/einrichtung/:id/...`, detail-route bottom-nav hiding.

### Suggested Flutter structure

```
lib/features/shell/navigation/
  data/
    navigation_catalog.dart           // static list mirroring staticNavigationItems
  domain/
    navigation_item.dart              // schema
    navigation_filter.dart            // pure function implementing the 9-step pipeline
  application/
    navigation_controller.dart        // Riverpod provider yielding filtered lists
    badge_providers.dart              // one provider per badge source
  presentation/
    nav_rail.dart
    nav_drawer.dart
    bottom_nav.dart
    detail_route_observer.dart        // hides bottom-nav on detail routes
```

## Known Divergences

- **Route templating:** Angular concatenates `/einrichtung/:id` at filter time. Flutter with GoRouter can use a parent ShellRoute whose path already carries the institution id — the prefix step becomes a no-op. Document whichever choice is picked; both are spec-equivalent.
- **Detail-route regex:** Angular runs regex on `router.url`. Flutter should mirror the same regex set or map them to named routes and use `GoRouterState.matchedLocation`.
- **Hot-reload of features:** Angular computes everything in `computed()`; Flutter's equivalent is a combined Riverpod `Provider` that re-emits on auth / feature / mode changes.
- **Logo loading:** nav-rail and nav-drawer both call `tenantFeaturesService.loadLogoUrl()` on init. Flutter should hoist this into a single provider so both widgets share the cached URL.
- **iOS/Android back gesture:** On detail routes the bottom-nav is hidden; Flutter must rely on the AppBar back button or OS back gesture. Spec doesn't add anything Angular-specific here.

## Port Log

| Date       | Who      | What                                                                  |
| ---------- | -------- | --------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec created — schema, full catalogue, 9-step filter pipeline, badges |
| 2026-04-27 | sven     | v0.1-alpha minimal nav shipped (4 destinations, adaptive bottom-nav/rail at 720 dp, drawer + rail user menu). Filter pipeline, badges, mode-aware items, route prefixing all deferred. |
