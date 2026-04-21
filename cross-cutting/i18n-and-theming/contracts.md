# Contracts: I18n And Theming

## Endpoints

Base path is resolved via `ApiConfigService.getApiUrl(path)`.

| Method  | Path                       | Purpose                                                                                                                  |
| ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET`   | `tenants/current/theme`    | Fetch the current tenant's branding colors. Returns 404 when no custom theme exists.                                     |
| `GET`   | `employees/me/preferences` | Personal preferences including `interface_language` (employees). Indirect via `EmployeesService.getPersonalPreferences`. |
| `PATCH` | `employees/me/preferences` | Persist language choice for employees. Indirect via `EmployeesService.updatePersonalPreferences`.                        |
| `GET`   | `clients/me`               | Client profile including `interface_language`.                                                                           |
| `PATCH` | `clients/me`               | Persist `interface_language` for clients.                                                                                |

> **Static translations are served as assets**, not from the API:
> `GET /assets/i18n/<lang>.json` — one JSON bundle per supported language.

## Data Models

### Theme

```ts
// Source: apps/tagea-frontend/src/app/services/theme.service.ts
interface TenantTheme {
  primaryColor: string; // hex, e.g. '#3f287c'
  primaryColorDark?: string; // optional darker shade; computed (-20% lightness) if omitted
  lightBackgroundColor?: string; // optional surface tint, default '#f5f3f9'
}
```

### Language

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/languages.config.ts
type AvailableLanguage = 'de' | 'en' | 'fr' | 'tr' | 'ro' | 'ar' | 'ru' | 'uk' | 'it' | 'pl' | 'hr' | 'fa' | 'ku' | 'bg' | 'sr' | 'sq';

interface LanguageConfig {
  code: AvailableLanguage;
  nativeName: string;
  flag: string;
  rtl: boolean;
}
```

### Personal preferences (employees)

> Documentation-only shape. The frontend only reads/writes `interface_language`; the full DTO lives in the backend.

```ts
interface EmployeePersonalPreferences {
  interface_language?: AvailableLanguage;
  // ...other preference fields omitted
}
```

### Client profile fragment

> Documentation-only shape. Only the language field is relevant here.

```ts
interface ClientLanguageFragment {
  interface_language?: string;
}
```

## Defaults

```ts
// Source: apps/tagea-frontend/src/app/services/theme.service.ts
const DEFAULT_THEME: TenantTheme = {
  primaryColor: '#3f287c',
  primaryColorDark: '#2b1468',
  lightBackgroundColor: '#f5f3f9',
};
```

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/languages.config.ts
const DEFAULT_LANGUAGE: AvailableLanguage = 'de';
const FALLBACK_LANGUAGE: AvailableLanguage = 'de';
const LANGUAGE_STORAGE_KEY = 'app-language';
```

## Supported Languages

| Code | Name      | Native     | RTL |
| ---- | --------- | ---------- | --- |
| de   | German    | Deutsch    | no  |
| en   | English   | English    | no  |
| fr   | French    | Français   | no  |
| tr   | Turkish   | Türkçe     | no  |
| ro   | Romanian  | Română     | no  |
| ar   | Arabic    | العربية    | yes |
| ru   | Russian   | Русский    | no  |
| uk   | Ukrainian | Українська | no  |
| it   | Italian   | Italiano   | no  |
| pl   | Polish    | Polski     | no  |
| hr   | Croatian  | Hrvatski   | no  |
| fa   | Persian   | فارسی      | yes |
| ku   | Kurdish   | Kurdî      | no  |
| bg   | Bulgarian | Български  | no  |
| sr   | Serbian   | Српски     | no  |
| sq   | Albanian  | Shqip      | no  |

> **RTL** languages drive `document.documentElement.dir = 'rtl'` via `isRtlLanguage(code)`.

## Transloco Configuration

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/transloco.config.ts
// Key options passed to provideTransloco:
//   availableLangs: all 16 codes from ALL_LANGUAGE_CODES
//   defaultLang:    'de'
//   fallbackLang:   'de'
//   reRenderOnLangChange: true
//   prodMode:      environment.production
//   missingHandler.useFallbackTranslation: true
//   missingHandler.logMissingKey:          !environment.production
//   loader: TranslocoHttpLoader
```

## Transloco HTTP Loader

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/transloco-loader.ts
class TranslocoHttpLoader {
  // Fetches GET /assets/i18n/<lang>.json; falls back to 'de' on invalid code,
  // returns {} on HTTP error so Transloco can fall through to fallbackLang.
  getTranslation(lang: string): Observable<Translation>;
}
```

## Paginator Intl

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/transloco-paginator-intl.ts
// Keys consumed:
//   paginator.itemsPerPage
//   paginator.nextPage
//   paginator.previousPage
//   paginator.firstPage
//   paginator.lastPage
//   paginator.range         // { start, end, total } interpolation
class TranslocoPaginatorIntl extends MatPaginatorIntl {
  // Subscribes to transloco.langChanges$ and calls changes.next() on each emission.
}
```

## LanguageService API

```ts
// Source: apps/tagea-frontend/src/app/services/language.service.ts
class LanguageService {
  readonly currentLanguage: Signal<AvailableLanguage>;
  readonly isRtl: Signal<boolean>;
  readonly availableLanguages: readonly LanguageConfig[];

  setLanguage(lang: string): void;
  setLanguageAndPersist(lang: string): Promise<void>;
  setLanguageAndPersistForClient(lang: string): Promise<void>;
  loadUserPreference(): Promise<void>;
  loadClientPreference(): Promise<void>;
  getCurrentLanguageConfig(): LanguageConfig | undefined;
}
```

Helpers exported from `languages.config.ts`:

```ts
// Source: apps/tagea-frontend/src/app/core/i18n/languages.config.ts
function getLanguageConfig(code: string): LanguageConfig | undefined;
function isRtlLanguage(code: string): boolean;
function getLanguageNativeName(code: string): string;
function isValidLanguage(code: string): code is AvailableLanguage;
function getLocaleFromLanguage(code: string): string; // 'de' → 'de-DE', etc.
```

## ThemeService API

```ts
// Source: apps/tagea-frontend/src/app/services/theme.service.ts
class ThemeService {
  readonly currentTheme: Signal<TenantTheme>;
  readonly primaryColor: Signal<string>;
  readonly primaryColorDark: Signal<string>;
  readonly lightBackgroundColor: Signal<string>;

  applyTheme(theme: Partial<TenantTheme>): void;
  resetTheme(): void;
  loadAndApplyTenantTheme(): Promise<TenantTheme | null>;
  generateLightBackground(primaryHex: string): string;
}
```

## CSS Custom Properties Written by `applyTheme`

> Documentation-only shape — enumerates the CSS variable keys set on `document.documentElement`. These are not TypeScript fields; they are consumed from SCSS and component styles.

```ts
// documentation-only
// Brand variables
'--brand-primary';
'--brand-primary-rgb';
'--brand-primary-dark';
'--brand-primary-dark-rgb';
'--brand-light-bg';
'--brand-primary-02' | '--brand-primary-04' | '--brand-primary-05';
'--brand-primary-08' | '--brand-primary-12' | '--brand-primary-15';
'--brand-primary-20' | '--brand-primary-30' | '--brand-primary-50';
'--brand-primary-60' | '--brand-primary-70';

// Material component overrides (subset shown; see theme.service.ts for full list)
('--mat-toolbar-container-background-color');
('--mat-button-filled-container-color');
('--mat-fab-background-color');
('--mat-form-field-filled-focus-active-indicator-color');
('--mat-checkbox-selected-icon-color');
('--mat-tab-active-indicator-color');
// ...plus radio, slider, progress bar/spinner, slide-toggle overrides

// M3 system color tokens derived from a generated tonal palette
'--mat-sys-primary' | '--mat-sys-on-primary' | '--mat-sys-primary-container';
'--mat-sys-secondary' | '--mat-sys-on-secondary' | '--mat-sys-secondary-container';
'--mat-sys-tertiary' | '--mat-sys-on-tertiary' | '--mat-sys-tertiary-container';
'--mat-sys-error' | '--mat-sys-on-error' | '--mat-sys-error-container';
'--mat-sys-background' | '--mat-sys-on-background';
'--mat-sys-surface' | '--mat-sys-on-surface' | '--mat-sys-surface-variant';
'--mat-sys-surface-container-lowest' | '--mat-sys-surface-container-low';
'--mat-sys-surface-container' | '--mat-sys-surface-container-high';
('--mat-sys-surface-container-highest');
'--mat-sys-outline' | '--mat-sys-outline-variant';
'--mat-sys-inverse-surface' | '--mat-sys-inverse-on-surface' | '--mat-sys-inverse-primary';
'--mat-sys-scrim' | '--mat-sys-shadow';
```

## Palette Generation

> Documentation-only. ThemeService derives a full M3 tonal palette (tones 0–100) from a single primary hex using HSL conversion (`hexToHsl` → adjust lightness to `tone/100` → `hslToHex`). A neutral palette with 10 % saturation retains a subtle hue tint for surface colors.

```ts
// documentation-only
interface M3TonalPalette {
  // Tones used: 0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
}
```

## Compile-time SCSS Theme

- `apps/tagea-frontend/src/tagea-v2-ng-m3-theme.scss` — generated by `ng generate @angular/material:theme-color`. Produces the baseline M3 palettes keyed on `#3f287c`. These are the styles shipped in the initial stylesheet; runtime `applyTheme` overrides the relevant `--mat-sys-*` variables.
- `apps/tagea-frontend/src/styles/_brand-colors.scss` — single source of truth for default SCSS color variables (`$primary`, `$primary-dark`, `$light-bg`, plus opacity aliases).

## Flutter port notes

> **Flutter port note:** i18n can use `easy_localization` (asset-based JSON, mirrors the current setup) or `intl` with ARB files. Keep the 16-code set and RTL table identical. Persistence key `app-language` can map to `shared_preferences`.

```dart
// Sketch
final supportedLocales = <Locale>[
  Locale('de'), Locale('en'), Locale('fr'), Locale('tr'),
  Locale('ro'), Locale('ar'), Locale('ru'), Locale('uk'),
  Locale('it'), Locale('pl'), Locale('hr'), Locale('fa'),
  Locale('ku'), Locale('bg'), Locale('sr'), Locale('sq'),
];
```

> **Flutter port note:** theming uses `ThemeData` with a `ColorScheme` derived from the tenant's primary color (Material 3's `ColorScheme.fromSeed(seedColor: ...)` produces an equivalent tonal palette to the HSL-hacked one in `theme.service.ts`). Rebuild the `MaterialApp` via a Riverpod/Bloc provider holding the current theme; no CSS-variable plumbing needed.

```dart
final theme = ThemeData(
  colorScheme: ColorScheme.fromSeed(
    seedColor: Color(0xFF3F287C),
    brightness: Brightness.light,
  ),
);
```
