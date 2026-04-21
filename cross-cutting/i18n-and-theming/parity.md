# Parity: I18n And Theming

## Angular

- **Status:** ✅ Implemented
- **i18n path:** [`apps/tagea-frontend/src/app/core/i18n/`](../../../apps/tagea-frontend/src/app/core/i18n/)
- **Language service:** [`apps/tagea-frontend/src/app/services/language.service.ts`](../../../apps/tagea-frontend/src/app/services/language.service.ts)
- **Theme service:** [`apps/tagea-frontend/src/app/services/theme.service.ts`](../../../apps/tagea-frontend/src/app/services/theme.service.ts)
- **SCSS theme base:** [`apps/tagea-frontend/src/tagea-v2-ng-m3-theme.scss`](../../../apps/tagea-frontend/src/tagea-v2-ng-m3-theme.scss), [`apps/tagea-frontend/src/styles/_brand-colors.scss`](../../../apps/tagea-frontend/src/styles/_brand-colors.scss)
- **Translation bundles:** [`apps/tagea-frontend/src/assets/i18n/`](../../../apps/tagea-frontend/src/assets/i18n/) (16 JSON files)
- **Auth wiring:** `UnifiedAuthService.loadEmployeeProfile` calls `loadAndApplyTenantTheme()` and `loadUserPreference()` / `loadClientPreference()`.
- **E2E:** no dedicated suite.

## Flutter

- **Status:** ⏳ Planned
- **Suggested i18n package:** `easy_localization` (JSON-asset-based; mirrors `/assets/i18n/<lang>.json` with minimal translation of config)
  - Alternative: `intl` + ARB if the team prefers the official Flutter toolchain.
- **Suggested theming approach:** `ColorScheme.fromSeed(seedColor: Color(0xFFRRGGBB), brightness: Brightness.light)` fed into `ThemeData`; expose the current theme from a Riverpod/Bloc provider so `MaterialApp` rebuilds when the tenant theme loads or the user logs out.
- **RTL handling:** Flutter's `MaterialApp` derives direction from the active `Locale`; `locale: Locale('ar')` produces RTL automatically (no separate `dir` plumbing required).
- **Persistence:** `shared_preferences` with the same key `app-language` (or a new, Dart-idiomatic key — document the change).
- **Tenant theme fetch:** mirror `GET /api/tenants/current/theme`; cache the last applied theme locally for offline launches.
- **Integration tests:** `integration_test/i18n_test.dart`, `integration_test/theme_test.dart`.

## Known Divergences

| Topic                       | Angular                                                | Flutter                                                         |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------- |
| Theming mechanism           | CSS custom properties on `document.documentElement`    | `ThemeData` rebuild via provider                                |
| Tonal palette generation    | Hand-rolled HSL lightness-adjust in `theme.service.ts` | Material 3's `ColorScheme.fromSeed` (HCT-based, more accurate)  |
| RTL                         | `document.documentElement.dir` toggled manually        | Automatic from `Locale`                                         |
| Dark mode                   | Disabled (`color-scheme: light`, light-only M3 theme)  | Same — light only (non-goal)                                    |
| Missing key handling        | Logs to console in dev, falls back to German           | Same — easy_localization's fallback locale                      |
| Language change side effect | `window.location.reload()` after backend persist       | Rebuild root `MaterialApp` via provider — no full process reset |
| Persistence failure         | Silent (localStorage try/catch)                        | Silent (try/catch around `shared_preferences`)                  |
| Paginator                   | `TranslocoPaginatorIntl` overrides `MatPaginatorIntl`  | Flutter pagination is bespoke per screen; no shared override    |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-21 | ltoenjes | Spec created |
