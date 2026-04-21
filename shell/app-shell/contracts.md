# Contracts: App Shell

> The app-shell has no dedicated HTTP endpoints. Its "contract" is the component
> signatures, the routing outlet structure, and the services it orchestrates on
> mount. Backend contracts for chat / push / presence live in their respective
> bundles (`cross-cutting/bootstrap-and-push`, chat bundle, etc.).

## Component signatures

### `SecureShellComponent`

> Documentation-only shape.

```ts
// Source: apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts
// selector: 'tagea-secure-shell'
// template: <tagea-crypto-bootstrap-orchestrator /><router-outlet></router-outlet>
// host:     { style: 'display: block; height: 100dvh; overflow: hidden;' }
interface SecureShellComponentPublicShape {
  // No @Input / @Output — the shell has no public API surface.
  // Lifecycle-only component: ngOnInit / ngOnDestroy / constructor effects.
}
```

Orchestrated services (injected, triggered by `effect()` on auth state):

| Service                                    | Trigger condition                                                                    | What it does                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `ChatService`                              | `isAuthenticated && tenantId && isChatEnabled && hasTenantPermission('chat.access')` | Opens Matrix connection via `connect(idToken)`.                        |
| `PresenceReporterService`                  | After `ChatService.loginResponse$` fires and access token exists                     | `startReporting(user_id)` — periodic presence pings.                   |
| `PushNotificationService`                  | `isAuthenticated && pushBrandId`                                                     | `init(accessToken, pushBrandId)` — registers FCM/APNs token + gateway. |
| `MatrixPusherService`                      | After push revalidation recreated the subscription                                   | `resetState()` so the pusher effect re-registers.                      |
| `MatrixClientService`                      | On app resume from background                                                        | `retrySync()` to bypass exponential backoff.                           |
| `NotificationCenterService`                | On app resume                                                                        | `loadUnreadCount()` — refreshes badge count.                           |
| `AppBadgeService`                          | On app resume                                                                        | `updateBadge()` — writes platform app-icon badge.                      |
| `EmployeesService` / `ClientPortalService` | After Matrix login, if current `mxid` differs from stored value                      | `updateOwnMatrixId(user_id)` so backend knows this user's Matrix ID.   |

Push-notification action handling:

> Documentation-only shape.

```ts
// Observable: pushNotificationService.notificationAction$: Observable<NotificationActionEvent>
interface NotificationActionPayload {
  // Recognized keys inside NotificationActionEvent.data
  route?: string; // explicit deep link
  deeplink?: string; // alias for route
  room_id?: string; // -> /chat/room/:id (client prefix applied)
  articleId?: string; // -> {prefix}/news/:id
  submissionId?: string; // -> /teamspace/submissions/:id
  appointmentId?: string; // -> /teamspace/buchung/:id
}
```

Route transformation (client vs employee context):

> Documentation-only shape.

```ts
// transformRouteForUserContext(route: string): string
// Behavior:
//   /chat/room/:id      -> /client-portal/chat/room/:id   (if client)
//   /news/:id           -> /teamspace/news/:id            (or /client-portal/...)
//   /appointments/:id   -> {prefix}/termine/:id
//   /messages/:id       -> {prefix}/nachrichten/:id
//   otherwise           -> unchanged
```

Cold-start pending route (set by native launch handler before Angular boots):

```ts
// Read by SecureShellComponent.ngOnInit via
//   sessionStorage.getItem('__pendingPushRoute')
// Written by the native push notification handler in the Capacitor layer.
```

App-state listener:

- On native (`PlatformService.isNative === true`): `Capacitor.App.addListener('appStateChange', ...)`.
- On web: `document.addEventListener('visibilitychange', ...)`.

Both fire `handleAppResume()` when the app becomes active/visible.

### `SecureMainComponent`

> Documentation-only shape. Full contract lives in `shell/main-navigation` / `shell/top-bar`.

```ts
// Source: apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts
// selector: 'tagea-secure-main'
// Imports: MatSidenavModule, TopBarComponent, NavRailComponent, NavDrawerComponent,
//          BottomNavComponent, HelpPanelComponent, ChatFab, AiChatFabComponent,
//          TimeTrackingFabComponent
interface SecureMainComponentShellShape {
  // Hosts the user-visible chrome:
  //   - Nav rail (desktop)
  //   - Nav drawer (mobile)
  //   - Top bar
  //   - Bottom nav (mobile)
  //   - Floating action buttons (Chat, AI, TimeTracking)
  //   - <router-outlet> for the main content area
  // Does NOT orchestrate chat / push / presence — that's SecureShell's job.
}
```

### `PublicMainComponent`

> Documentation-only shape.

```ts
// Source: apps/tagea-frontend/src/app/layouts/public-main/public-main.component.ts
// selector: 'tagea-public-main'
interface PublicMainComponentShellShape {
  // Shows a minimal MatToolbar when the active child route sets data.showHeader === true.
  // Language switcher: de / ua / en — currently local-state only (signal).
  // No chat / push / presence init.
}
```

### `CryptoBootstrapOrchestratorComponent`

> Documentation-only shape. Full contract belongs to a chat-crypto bundle.

```ts
// Source: packages/chat/src/lib/components/crypto/crypto-bootstrap-orchestrator.ts
// selector: 'tagea-crypto-bootstrap-orchestrator'
// template: ''   (invisible — opens MatDialogs on demand)
interface CryptoBootstrapOrchestratorShellShape {
  // Reacts to CryptoBootstrapService.bootstrapState() signal:
  //   'needs-setup'      -> RecoveryKeySetupDialogComponent
  //   'needs-passphrase' -> SecretStorageUnlockDialogComponent or DeviceVerificationBlockingDialogComponent
  //   'complete'         -> initializes verification listener, reloads client
  // Also handles: incoming device-verification requests, session-invalidated dialog.
}
```

## Outlet structure (route nesting)

```
routes: Routes = [
  ...PUBLIC_ROUTES,                        // wraps children in PublicMainComponent
  {
    path: '',
    canActivate: [AUTH_GUARD],
    component: SecureShellComponent,       // <router-outlet> + <crypto-bootstrap>
    children: [
      { path: 'awaiting-approval',  ... }, // inside SecureShell, OUTSIDE SecureMain
      { path: 'chat/room/:roomId',  ... }, // inside SecureShell, OUTSIDE SecureMain
      { path: 'chat/invite/:roomId',... }, // inside SecureShell, OUTSIDE SecureMain
      {
        path: '',
        component: SecureMainComponent,    // the full nav chrome
        canActivate: [activeEmployeeGuard],
        children: [
          { path: 'ai-chat',         ... },
          { path: 'chat',            ... }, // (chat list page; room is one level up)
          { path: 'super-admin',     ... },
          { path: 'teamspace',       ... },
          { path: 'dateien',         ... },
          { path: 'client-portal',   ... },
          { path: 'institution/...', ... },
          { path: 'employee-profile',... },
          { path: 'einstellungen',   ... },
          { path: '**',              ... }, // defaultModeRedirectGuard
        ],
      },
    ],
  },
];
```

> **Flutter port note:** Map to `go_router`:
>
> - `PUBLIC_ROUTES` → top-level `GoRoute`s wrapped in a `ShellRoute` with `PublicShellScaffold` builder
> - `SecureShellComponent` → outer `ShellRoute` whose builder mounts chat/push/presence providers and a `CryptoBootstrapListener` widget
> - `SecureMainComponent` → inner `StatefulShellRoute.indexedStack` or plain `ShellRoute` for the nav chrome
> - `awaiting-approval` and chat-room routes → direct children of the outer `ShellRoute`, siblings of the inner shell — so they inherit chat/push/presence but not the nav chrome

## Init orchestration (effects, side effects, lifecycle)

`SecureShellComponent` uses three Angular `effect()` blocks and two lifecycle hooks:

1. **Chat-init effect** (reads `isAuthenticated`, `tenantId`, `isChatEnabled`, `hasTenantPermission('chat.access')`). Runs once per shell mount. Subscribes to `chatService.loginResponse$` to kick off presence reporting and to reconcile the stored `mxid`.
2. **Push-init effect** (reads `isAuthenticated`, `pushBrandId`). Runs once per shell mount.
3. **Crypto-bootstrap-orchestrator effects** (inside the orchestrator component): see its own module docs.
4. **`ngOnInit`**: (a) reads `sessionStorage['__pendingPushRoute']` for cold-start deep links, (b) subscribes to `pushNotificationService.notificationAction$` for live deep-link navigation, (c) sets up the app-state listener.
5. **`ngOnDestroy`**: stops presence reporting, completes the `destroy$` subject.

> **Flutter port note:** The three `effect()` blocks become `ref.listen(authStateProvider, ...)` (Riverpod) or `BlocListener` (Bloc) at the app root. The orchestration is one-shot-per-session, so guard flags (`chatInitialized`, `pushInitialized`) translate to `bool` fields on a long-lived controller. App-state listening uses `AppLifecycleListener` (Flutter >= 3.13).

## Data Models

No DTOs flow through the shell. Matrix login responses, push subscription payloads, and presence pings are owned by their respective services — see those bundles' `contracts.md`.
