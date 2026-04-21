# Feature: I18n And Theming

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Two cross-cutting concerns handled by the app shell: (1) static UI strings are translated via Transloco across 16 languages (German default; Arabic and Persian drive RTL layout); (2) Material M3 colors are re-themed per tenant at runtime by writing CSS custom properties on `<html>` so the same Angular build brands correctly for every tenant.

## User Stories

- As a **staff member or client** I want the UI in my preferred language, so that I can read it comfortably.
- As an **Arabic- or Persian-speaking user** I want the app laid out right-to-left, so that it respects my script direction.
- As a **tenant administrator** I want my brand's primary color applied across the app after my users log in, so that the product feels like our own.
- As a **returning user** I want my last language choice remembered across sessions and devices, so that I do not re-pick it every time.

## Acceptance Criteria

### Language selection and persistence

- [ ] **Given** the app bootstraps with no stored preference, **When** `LanguageService` initializes, **Then** it picks the first two characters of `navigator.language` if that is one of the 16 supported codes; otherwise falls back to `de`.
- [ ] **Given** the app bootstraps with `localStorage['app-language']` set to a supported code, **When** `LanguageService` initializes, **Then** that language is activated (localStorage wins over `navigator.language`).
- [ ] **Given** the user changes language via `setLanguage(lang)`, **When** the call completes, **Then** Transloco's active language updates, `localStorage['app-language']` is written, and `document.documentElement` has `dir` set to `'rtl'` for `ar`/`fa` and `'ltr'` otherwise, plus `lang` set to the chosen code.
- [ ] **Given** the user explicitly persists their choice via `setLanguageAndPersist(lang)` (employee) or `setLanguageAndPersistForClient(lang)` (client), **When** the backend write succeeds, **Then** the page is reloaded via `window.location.reload()` so all server-translated content (articles, events) reloads with the new language.
- [ ] **Given** an invalid language code is passed to `setLanguage`, **When** validation runs, **Then** it is silently replaced by `de` and a warning is logged; Transloco does not crash.

### Post-login language sync from backend

- [ ] **Given** an employee finishes authentication, **When** `UnifiedAuthService` calls `languageService.loadUserPreference()`, **Then** `GET` personal preferences is fetched; if `interface_language` is a supported code, it is applied via `setLanguage`.
- [ ] **Given** a client finishes authentication, **When** `UnifiedAuthService` calls `languageService.loadClientPreference()`, **Then** `GET clients/me` is fetched; if `interface_language` is a supported code, it is applied via `setLanguage`.
- [ ] **Given** the backend call fails (network error, 4xx), **When** the error is caught, **Then** a warning is logged and the current locally-resolved language is kept (no throw).

### Translation loading

- [ ] **Given** Transloco requests translations for an unloaded language, **When** `TranslocoHttpLoader.getTranslation(lang)` runs, **Then** it fetches `/assets/i18n/<lang>.json` (with `lang` validated against the supported list; falls back to `de` if invalid).
- [ ] **Given** the JSON fetch fails, **When** the observable errors, **Then** the loader emits an empty `Translation` `{}` and Transloco falls through to the fallback language (`de`).
- [ ] **Given** a translation key is missing at runtime, **When** rendered, **Then** Transloco returns the German fallback text; in development the missing key is `console.log`-ged (suppressed in production).

### Paginator localization

- [ ] **Given** a `MatPaginator` is rendered, **When** the active language changes, **Then** `TranslocoPaginatorIntl.changes` emits and the paginator refreshes its labels (`itemsPerPage`, `nextPage`, `previousPage`, `firstPage`, `lastPage`, `range`).

### Tenant theming — default

- [ ] **Given** no tenant theme has been loaded yet, **When** the app renders, **Then** the default brand color `#3f287c` (violet) is in effect via the SCSS-compiled M3 theme and the `_brand-colors.scss` defaults.

### Tenant theming — runtime override

- [ ] **Given** the user logs in, **When** `UnifiedAuthService` calls `themeService.loadAndApplyTenantTheme()`, **Then** `GET tenants/current/theme` is fetched; on 200 the returned `TenantTheme` is applied; on 404 the default theme is applied.
- [ ] **Given** a `TenantTheme` is applied, **When** `applyTheme(theme)` runs on browser platforms, **Then** the following CSS custom properties are written to `document.documentElement`:
  - `--brand-primary`, `--brand-primary-rgb`
  - `--brand-primary-dark`, `--brand-primary-dark-rgb`
  - `--brand-light-bg`
  - `--brand-primary-02` … `--brand-primary-70` opacity variants
  - Material component overrides (`--mat-toolbar-…`, `--mat-button-…`, `--mat-form-field-…`, `--mat-checkbox-…`, `--mat-radio-…`, `--mat-slider-…`, `--mat-progress-…`, `--mat-tab-…`, `--mat-slide-toggle-…`)
  - M3 system variables derived from a generated tonal palette (`--mat-sys-primary` through `--mat-sys-on-tertiary-fixed-variant`, `--mat-sys-surface-*`, `--mat-sys-outline-*`, etc.)
- [ ] **Given** `primaryColorDark` is omitted from the server response, **When** the theme is applied, **Then** it is computed by darkening the primary hex by 20 %.
- [ ] **Given** `lightBackgroundColor` is omitted, **When** the theme is applied, **Then** the default `#f5f3f9` is used.
- [ ] **Given** the server returns 404 or any other error, **When** the error is caught, **Then** the default theme is applied and a warning is logged (the app does not block login on theme failure).
- [ ] **Given** the user logs out or switches tenants, **When** `resetTheme()` is called, **Then** the `currentTheme` signal reverts to the default and default CSS custom properties are re-applied.
- [ ] **Given** the app runs in a non-browser environment (SSR), **When** `applyTheme` is called, **Then** the call is a no-op (no `document` access).

## UI States

| State                | When?                                                    | What does the user see?                                    | A11y notes                                                      |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| Initial (pre-login)  | Bootstrap before auth resolves                           | Default German UI, default violet theme                    | `<html dir="ltr" lang="de">`                                    |
| Language resolving   | Between bootstrap and `loadUserPreference` resolving     | UI in stored/browser language; may flip briefly post-login | No flash for same-language users                                |
| LTR language active  | Any non-RTL language                                     | Normal layout                                              | `<html dir="ltr" lang="<code>">`                                |
| RTL language active  | `ar` or `fa`                                             | Mirrored layout (Material respects `dir`)                  | `<html dir="rtl" lang="<code>">`; CSS logical properties matter |
| Default theme        | Before login or on theme load failure                    | Violet (`#3f287c`) primary                                 | Colors meet WCAG AA contrast                                    |
| Tenant-branded theme | After `loadAndApplyTenantTheme` resolves with 200        | Tenant's primary color across toolbar, buttons, accents    | Contrast obligation sits with tenant admin configuring color    |
| Persisting language  | User submits language change; `window.location.reload()` | Full-page reload flash                                     | Loading state is the browser's, not ours                        |

## Flows

### Language resolution at startup

```
App bootstrap
    │
    ▼
LanguageService constructor
    │
    ├── getStoredLanguage()        ── localStorage['app-language']
    │       │
    │       ├── valid → use it
    │       └── absent/invalid
    │                │
    │                ▼
    │       getBrowserLanguage()  ── navigator.language.split('-')[0]
    │                │
    │                ├── valid → use it
    │                └── else  → DEFAULT_LANGUAGE ('de')
    │
    ▼
transloco.setActiveLang(lang)
document.documentElement.dir = isRtlLanguage(lang) ? 'rtl' : 'ltr'
document.documentElement.lang = lang
```

### Post-login language sync

```
Auth success
    │
    ▼
UnifiedAuthService.loadEmployeeProfile (or client equivalent)
    │
    ├── isClient?
    │    ├── yes → languageService.loadClientPreference()
    │    │           GET clients/me → interface_language → setLanguage(...)
    │    └── no  → languageService.loadUserPreference()
    │              GET personal preferences → interface_language → setLanguage(...)
    │
    (fire-and-forget — failure logged, current language kept)
```

### Tenant theme application

```
Auth success (initial login OR tenant switch)
    │
    ▼
themeService.loadAndApplyTenantTheme()
    │
    ▼
GET /api/tenants/current/theme
    │
    ├── 200 → { primaryColor, primaryColorDark?, lightBackgroundColor? }
    │          │
    │          ▼
    │   applyTheme(theme)
    │          │
    │          ▼
    │   document.documentElement.style.setProperty('--brand-primary', ...)
    │   (plus all --brand-*, --mat-*, --mat-sys-* overrides)
    │
    ├── 404 → applyTheme(DEFAULT_THEME)
    └── other errors → warn + applyTheme(DEFAULT_THEME)
```

## Non-Goals

- **Dark mode.** `styles.scss` forces `color-scheme: light` and includes only the light M3 theme. `ThemeService` has no dark-mode branch.
- **Per-user theming.** Themes are tenant-scoped; users do not pick their own colors.
- **Dynamic translation files.** Only JSON bundles shipped in `assets/i18n/` are supported. No over-the-air updates to copy.
- **Pluralization rules.** Current usage is straightforward `{{ count }}` interpolation; no ICU plural/select syntax is leveraged.
- **Language negotiation via `Accept-Language`.** Server-translated content uses the active Transloco language surfaced elsewhere (see API clients); the Transloco loader itself only hits static asset JSON.
- **Per-tenant logo.** Handled by a separate concern — see `specs/cross-cutting/context-resolution/`.

## Edge Cases

- **Tenant theme applied mid-session after tenant switch.** After a successful tenant switch, `loadPermissionsAndFeatures()` re-runs `loadAndApplyTenantTheme()`. The old tenant's CSS vars remain on `:root` until the new vars overwrite them; there is no explicit `resetTheme()` in between, so failure cases may leave the previous tenant's colors partially in place (only overwritten keys change).
- **SSR / non-browser.** `applyTheme` and `updateDocumentDirection` guard on `isPlatformBrowser` / `typeof document`. Reset also guards.
- **localStorage unavailable (private browsing, sandbox).** Read/write are wrapped in `try/catch`; the service still works but persistence is silently disabled.
- **Invalid language code stored.** `isValidLanguage` filters; falls through to `navigator.language` logic, then `de`.
- **Translation JSON missing entirely.** Loader returns `{}`; Transloco falls back to German keys.
- **Missing key in active language.** Falls back to German via `fallbackLang: 'de'`; in dev a `console.log` surfaces the key.
- **Primary color not a valid 6-digit hex.** `hexToRgb` / `hexToHsl` assume 6-digit `#rrggbb`; short-form `#rgb` or invalid input will produce garbage output silently. Backend contract is expected to enforce the format.
- **RTL for Kurdish.** Kurdish (`ku`) uses Latin script (Kurmanji) in this app per `languages.config.ts` — `rtl: false`. Arabic-script Kurdish (Sorani) is not a separate entry.
- **Paginator before Transloco has loaded.** `TranslocoPaginatorIntl` calls `transloco.translate` synchronously; if the active language JSON is not yet in memory the call returns the key as the label. Subsequent `langChanges$` emissions refresh it.

## Permissions & Tenant/Institution

- **Required roles:** none for language selection (public). Tenant theme endpoint is authenticated — only logged-in users trigger it.
- **Institution context:** not used. Themes are tenant-scoped, resolved via the caller's authenticated tenant (`tenants/current/theme`).
- **Backend access checks:** `tenants/current/theme` returns 404 if the tenant has no custom theme — the client treats this as "use defaults", not an error. Other errors are logged and fall through to defaults.

## Notifications (Push / In-App)

- Not applicable — purely presentational concerns.

## i18n Keys

- Paginator labels:
  - `paginator.itemsPerPage`
  - `paginator.nextPage`
  - `paginator.previousPage`
  - `paginator.firstPage`
  - `paginator.lastPage`
  - `paginator.range` — interpolated with `{ start, end, total }`
- All other UI keys live in `apps/tagea-frontend/src/assets/i18n/de.json` (flat, feature-grouped root namespaces: `pageTitle`, `nav`, etc.).

## Offline Behavior

**Flutter-specific:**

- Bundled translation files ship with the app; language changes do not require network.
- Last-applied tenant theme should be cached locally (e.g. `shared_preferences`) so offline launches paint with brand colors instead of defaults.
- Post-login preference fetches are fire-and-forget; on offline they fail silently and the cached/local language is used.

## References

- **Angular implementation:**
  - [`apps/tagea-frontend/src/app/core/i18n/languages.config.ts`](../../../apps/tagea-frontend/src/app/core/i18n/languages.config.ts)
  - [`apps/tagea-frontend/src/app/core/i18n/transloco.config.ts`](../../../apps/tagea-frontend/src/app/core/i18n/transloco.config.ts)
  - [`apps/tagea-frontend/src/app/core/i18n/transloco-loader.ts`](../../../apps/tagea-frontend/src/app/core/i18n/transloco-loader.ts)
  - [`apps/tagea-frontend/src/app/core/i18n/transloco-paginator-intl.ts`](../../../apps/tagea-frontend/src/app/core/i18n/transloco-paginator-intl.ts)
  - [`apps/tagea-frontend/src/app/services/language.service.ts`](../../../apps/tagea-frontend/src/app/services/language.service.ts)
  - [`apps/tagea-frontend/src/app/services/theme.service.ts`](../../../apps/tagea-frontend/src/app/services/theme.service.ts)
  - [`apps/tagea-frontend/src/styles/_brand-colors.scss`](../../../apps/tagea-frontend/src/styles/_brand-colors.scss)
  - [`apps/tagea-frontend/src/tagea-v2-ng-m3-theme.scss`](../../../apps/tagea-frontend/src/tagea-v2-ng-m3-theme.scss)
  - [`apps/tagea-frontend/src/assets/i18n/*.json`](../../../apps/tagea-frontend/src/assets/i18n/)
- **Auth integration:** `UnifiedAuthService` calls `loadAndApplyTenantTheme()` and `loadUserPreference()` / `loadClientPreference()` after successful profile load.
- **E2E tests:** _(to be identified — no dedicated suite for i18n/theme today)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
