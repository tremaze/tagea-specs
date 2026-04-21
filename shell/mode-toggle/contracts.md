# Contracts: Mode Toggle

> Mode toggle is **pure client state**. It calls no backend endpoint of its own — its job is to flip a signal and navigate. The contract here is the shape of that state and the surface the rest of the app consumes.

## Endpoints

None. The toggle is not wired to any HTTP call. The feature-flag services it depends on (`TenantFeaturesService`, `AuthorizationStore`) are documented in their own specs.

## Events (WebSocket / Push)

None.

## Data Models

### `NavigationMode` — the mode literal

Source: [`apps/tagea-frontend/src/app/services/navigation-mode.service.ts`](../../../apps/tagea-frontend/src/app/services/navigation-mode.service.ts)

```ts
export type NavigationMode = 'einrichtung' | 'teamspace';
```

### `NavigationModeService` — writable signal with URL sync and persistence

> Documentation-only shape. Reflects the public surface of the Angular service; reviewers should check the file above for the implementation.

```ts
// documentation-only
export class NavigationModeService {
  readonly currentMode: Signal<NavigationMode>;
  readonly isEinrichtungMode: Signal<boolean>;
  readonly isTeamspaceMode: Signal<boolean>;

  setMode(mode: NavigationMode): void;
  toggleMode(): void;
  navigateToModeHome(mode: NavigationMode): void;
}
```

**Behavioural contract:**

| Aspect             | Value                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Storage key        | `'navigation-mode'` in `window.localStorage`                                                                                  |
| Default            | `'teamspace'` when no URL match and no stored value                                                                           |
| URL → mode mapping | prefix `/teamspace` → `teamspace`; prefix `/einrichtung/` → `einrichtung`; `/` or anything else → no change                   |
| Auto-sync          | subscribes to `Router.events` (`NavigationEnd`); re-runs the URL → mode mapping on each navigation, using `urlAfterRedirects` |
| Persist-on-write   | an `effect(() => saveToStorage(currentMode()))` mirrors every mode change back into `localStorage`                            |

### LocalStorage contract

```ts
// documentation-only
interface LocalStorageLayout {
  'navigation-mode': 'einrichtung' | 'teamspace';
}
```

Read validation is strict: anything other than the two literal strings is treated as missing and falls back to the default.

### Toggle visibility predicate

> Documentation-only shape. Drawn from `ModeToggleComponent.showToggle`.

```ts
// documentation-only
const showToggle = tenantFeaturesService.isInstitutionsEnabled() && tenantFeaturesService.isTeamspaceEnabled() && authorizationStore.hasAccessibleInstitutions();
```

- `isInstitutionsEnabled()` — tenant-level feature flag `institutions`.
- `isTeamspaceEnabled()` — tenant-level feature flag `teamspace`.
- `hasAccessibleInstitutions()` — user has at least one institution id in their RBAC context.

### Default-mode redirect

> Documentation-only shape. Drawn from `defaultModeRedirectGuard`.

Applied when a user lands on `/` (or any route wired to the guard). Decision table:

| Client? | Institutions feature + user has institution | Teamspace feature | Result                                                                |
| ------- | ------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| yes     | —                                           | —                 | `/client-portal`                                                      |
| no      | yes                                         | yes               | honour persisted mode: `teamspace` → `/teamspace`; else inst.         |
| no      | yes                                         | no                | `/einrichtung/{id}/dashboard`                                         |
| no      | no                                          | yes               | `/teamspace`                                                          |
| no      | yes (admin only, no personal inst.)         | no                | `/einrichtung/{activeId}/dashboard` if active, else `/blocked-access` |
| no      | no                                          | no                | `/blocked-access`                                                     |

> **Flutter port note:** The Flutter shell should expose the same three-method surface (`setMode`, `toggleMode`, `navigateToModeHome`) and apply the same storage key so a user's preference carries across clients. URL inference should be driven by `GoRouter` route names rather than raw path strings — but the mapping (`teamspace` path → `teamspace` mode, `einrichtung` path → `einrichtung` mode, other → no change) stays identical.

```dart
// Flutter port note
enum NavigationMode { einrichtung, teamspace }

class NavigationModeController {
  NavigationMode get currentMode;
  void setMode(NavigationMode mode);
  void toggleMode();
  Future<void> navigateToModeHome(NavigationMode mode);
}
```
