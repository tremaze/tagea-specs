# Cross-Cutting: Bootstrap And Push

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Two concerns that live outside of any single feature: **how the app starts** (the ordered chain of initializers that must complete before the Router begins routing) and **how push notifications are wired** (Capacitor FCM on iOS/Android, Angular Service Worker + VAPID on web). Together they answer: "what happens between the user tapping the app icon and the first route rendering?" and "what happens when the user taps a notification on the lock screen before the app is even open?"

## User Stories

- As an **employee tapping the Tagea app icon** I want the splash screen to cover initialization until my profile, tenant, permissions, features, and language are loaded, so that the first screen I see is already populated and correct.
- As an **employee tapping a push notification while the app is closed (cold start)** I want to land directly on the chat/news/appointment the notification references after login, so that I do not have to navigate there manually.
- As an **employee tapping a push notification while the app is open (warm start)** I want the app to navigate to the referenced content immediately without reloading.
- As a **user on a device that denied notification permission** I want the app to work normally without errors, so that push is an enhancement, not a blocker.
- As a **tenant admin configuring white-labelled apps** I want each brand to use its own FCM project (sender ID, service account), so that notifications from different brands are routed through separate Firebase pipelines.

## Acceptance Criteria

### Bootstrap chain

- [ ] **Given** the user opens the app, **When** `main.ts` runs, **Then** the Capacitor push-action listener is registered on native platforms **before** `platformBrowserDynamic().bootstrapModule()` is called.
- [ ] **Given** `main.ts` is running on a native platform, **When** a push notification was tapped from the lock screen, **Then** the route is extracted from `notification.data` and written to `sessionStorage['__pendingPushRoute']` before Angular bootstraps.
- [ ] **Given** `main.ts` is running, **When** Sentry is enabled via environment, **Then** `Sentry.init()` is called before Angular bootstraps so that errors during bootstrap are reported.
- [ ] **Given** Angular starts bootstrapping, **When** the `APP_INITIALIZER` chain executes, **Then** the initializers run sequentially in this order: `initAppVersion` → `NativeUpdateService` (eager inject) → `NativeTextZoomService` (eager inject) → `initializeTenant` → `initializeApp` → `LanguageService` → Transloco translation load → Sentry trace service (if enabled).
- [ ] **Given** `initializeTenant` detects a custom domain or native tenant synchronously, **When** the current path is not `/welcome`, **Then** `window.location.href = '/welcome'` is set and the returned Promise never resolves (blocking execution).
- [ ] **Given** `initializeApp` runs on a public route (`/welcome`, `/booking`, `/auth/callback`, `/login`, `/no-tenant`, `/blocked-access`, `/auth-error`, `/session-expired`, `/public/password-reset/`), **When** profile loading would normally happen, **Then** profile loading is skipped and the splash screen is hidden immediately on web.
- [ ] **Given** `initializeApp` runs on a protected route, **When** `UnifiedAuthService.ensureProfileLoaded()` is called, **Then** it waits (up to 10 s) for the employee signal to be populated before resolving.
- [ ] **Given** `ensureProfileLoaded` detects the access token expired but a refresh token exists, **When** bootstrap runs (e.g. native app cold start after days), **Then** `authService.checkAndRefreshSession()` is called to restore the session before loading the profile.
- [ ] **Given** bootstrap completes, **When** on a native platform, **Then** `CapacitorUpdater.notifyAppReady()` is called so Capgo does not roll back the current bundle.

### Push notifications

- [ ] **Given** the user is authenticated and `pushBrandId()` is non-null, **When** `SecureShellComponent` detects both conditions, **Then** `PushNotificationService.init(accessToken, brandId)` is called exactly once per session.
- [ ] **Given** push init runs on Android, **When** notification channels are created, **Then** the eight defined channels (`messages`, `calls`, `invitations`, `mentions`, `missed_calls`, `room_updates`, `general`, `default`) exist with their configured importance, sound, and vibration settings.
- [ ] **Given** push init runs, **When** permission is already `granted` on a native platform, **Then** the existing device token is fetched via `PushNotifications.register()` and checked against the gateway; a new subscription is created only if no matching one exists.
- [ ] **Given** push init runs in a desktop browser, **When** permission state is `default`, **Then** `needsPermissionPrompt()` becomes `true` so that a UI prompt can request permission from a user gesture.
- [ ] **Given** push init runs in a mobile browser (non-native), **When** permission state is `default`, **Then** `needsPermissionPrompt()` stays `false` — mobile browsers do not show the prompt.
- [ ] **Given** the user grants permission on web, **When** `subscribeWeb()` runs, **Then** the browser `PushSubscription` is sent as JSON to `POST {gatewayUrl}/api/webpush/subscriptions` with `brand_id` in the body.
- [ ] **Given** the user grants permission on native, **When** `subscribeNative()` runs, **Then** the FCM device token is sent to `POST {gatewayUrl}/api/fcm/subscriptions` with `brand_id` in the body.
- [ ] **Given** the app comes back to foreground, **When** `SecureShellComponent.handleAppResume()` runs, **Then** delivered notifications are cleared and `PushNotificationService.revalidateSubscription()` is called to re-sync with the gateway.
- [ ] **Given** revalidation finds no subscription for the current pushkey on the gateway, **When** the subscription was previously active, **Then** the app re-subscribes and `MatrixPusherService.resetState()` is called so the Matrix pusher re-registers.
- [ ] **Given** `UnifiedAuthService.logout()` runs, **When** it still holds a valid access token, **Then** `PushNotificationService.unsubscribe(accessToken)` is awaited so the gateway removes the device subscription before the token is revoked.

### Cold-start push tap

- [ ] **Given** the app is closed and a push notification is tapped, **When** `main.ts` receives the `pushNotificationActionPerformed` event, **Then** the route is extracted from `notification.data` in this priority order: `data.route` → `data.deeplink` → `/chat/room/${data.room_id}` → `/news/${data.articleId}`, and stored in `sessionStorage['__pendingPushRoute']`.
- [ ] **Given** a pending push route is in `sessionStorage`, **When** `SecureShellComponent.ngOnInit()` runs post-bootstrap, **Then** `processPendingPushRoute()` reads it, removes it, transforms it for the current user context (client vs. employee), and calls `router.navigate()`.
- [ ] **Given** a pending push route was written before login, **When** the user completes login and `SecureShellComponent` initializes, **Then** the route is still consumed (sessionStorage survives OAuth redirects within the same tab).

### Service Worker (web only)

- [ ] **Given** the app runs in a production web build, **When** `ServiceWorkerModule.register('ngsw-worker.js')` is called with `enabled: environment.enableServiceWorker && !Capacitor.isNativePlatform()`, **Then** the worker registers with `registerWhenStable:30000` strategy and caches static assets.
- [ ] **Given** the app runs on a native platform, **When** `ServiceWorkerModule.register()` is evaluated, **Then** it is disabled (native apps use Capacitor, not SW).

## UI States

Bootstrap and push are mostly non-visual, but they gate visible states handled elsewhere:

| State                       | When?                                                                        | What does the user see?                                                                                    | A11y notes                         |
| --------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Splash (native)             | `main.ts` running and APP_INITIALIZER chain not yet complete                 | Native splash image; hidden by `initializeApp` on web, by `App` component on native after first navigation | System-managed                     |
| Splash (web)                | Index.html static skeleton while Angular bundle loads + APP_INITIALIZER runs | Centered `MatProgressSpinner` + app logo                                                                   | `aria-busy=true` on shell          |
| Permission prompt (web)     | `needsPermissionPrompt()` is `true` and user is on desktop browser           | `NotificationPromptComponent` with "Benachrichtigungen aktivieren" CTA                                     | Focus-trap standard                |
| Permission denied           | OS or browser returned `denied`                                              | No prompt; push features silently disabled                                                                 | —                                  |
| Cold-start deeplink landing | `sessionStorage['__pendingPushRoute']` consumed post-bootstrap               | Target screen (chat room / news article / appointment)                                                     | Target screen's own focus handling |

## Flows

### 1. Bootstrap chain

```
main.ts
  │
  ├─ [Native only] Configure Matrix keystores (Keychain / Android Keystore)
  │
  ├─ [Native only] Register PushNotifications.addListener('pushNotificationActionPerformed')
  │       Extracts route from notification.data → sessionStorage['__pendingPushRoute']
  │
  ├─ Sentry.init()  (if environment.sentry.enabled)
  │
  └─ loadBrandConfigAsync()            // Brand config must resolve before AppModule imports
        │
        ▼
    dynamic import('./app/app.module')
        │
        ▼
    platformBrowserDynamic().bootstrapModule(AppModule)
        │
        ▼
    APP_INITIALIZER chain (multi: true — run in provider order):
        1. initAppVersion()                            // Resolves live-updated bundle version
        2. inject(NativeUpdateService)                 // Registers Capgo listeners
        3. inject(NativeTextZoomService)               // Applies OS font scale
        4. initializeTenant(TenantResolutionService)   // Redirects custom-domain → /welcome SYNCHRONOUSLY
        5. initializeApp(UnifiedAuthService)           // Waits for profile (loadEmployeeProfile)
                                                       //   - GET /auth/current
                                                       //   - AuthorizationStore.loadContext()
                                                       //   - GET /tenants/current/features
                                                       //   - GET /tenants/current/push-brand
                                                       //   - ThemeService.loadAndApplyTenantTheme() (non-blocking)
                                                       //   - LanguageService.loadUserPreference()   (non-blocking)
        6. LanguageService initialize                  // Restores saved language
        7. firstValueFrom(Transloco.selectTranslation) // Blocks until translations loaded
        8. Sentry.TraceService (if enabled)            // Eagerly instantiated
        │
        ▼
    Router navigation begins
        │
        └─ SecureShellComponent.ngOnInit()
               ├─ processPendingPushRoute() → consumes sessionStorage['__pendingPushRoute']
               ├─ subscribe to pushNotificationService.notificationAction$ (warm-start taps)
               └─ setupAppStateListener() (for foreground revalidation)
        │
        ▼
    [Native only] CapacitorUpdater.notifyAppReady()   // Confirms bundle is healthy for Capgo
```

### 2. Push subscribe flow (post-login)

```
UnifiedAuthService.loadEmployeeProfile() succeeds
   │
   ├── _employee signal populated
   └── _pushBrandId signal populated (from GET /tenants/current/push-brand)
          │
          ▼
SecureShellComponent.effect() — isAuthenticated && pushBrandId && !pushInitialized
   │
   ▼
PushNotificationService.init(accessToken, brandId)
   │
   ├── checkPermissionState()                  (Capacitor on native, Notification.permission on web)
   ├── createAndroidNotificationChannels()     (8 channels, Android only)
   ├── setupNotificationClickHandlers()        (pushNotificationActionPerformed | swPush.notificationClicks)
   │
   ├── permission === 'granted'?
   │     │
   │     ├── YES → checkIfSubscriptionNeeded()
   │     │          │
   │     │          ├── native: PushNotifications.register() → device_token
   │     │          │   web:    swPush.subscription → endpoint
   │     │          │
   │     │          ├── GET {gatewayUrl}/api/subscriptions/status?provider={fcm|webpush}&pushkey=…
   │     │          │
   │     │          ├── exists && belongs_to_current_user → state='subscribed', done
   │     │          └── else → subscribe()
   │     │                      │
   │     │                      ├── native: POST {gatewayUrl}/api/fcm/subscriptions
   │     │                      │          body: { device_token, brand_id? }
   │     │                      │
   │     │                      └── web: swPush.requestSubscription({ serverPublicKey: vapidPublicKey })
   │     │                               POST {gatewayUrl}/api/webpush/subscriptions
   │     │                               body: { endpoint, expirationTime, keys: {p256dh, auth}, brand_id? }
   │     │
   │     ├── 'default' && isMobileBrowser → needsPermissionPrompt=false (skip)
   │     ├── 'default' && desktop/native  → needsPermissionPrompt=true  (UI shows prompt)
   │     └── 'denied'                     → needsPermissionPrompt=false, silent
```

### 3. Cold-start push tap (native only)

```
App closed. User taps notification on lock screen.
   │
   ▼
OS launches app → main.ts runs
   │
   ├── PushNotifications.addListener('pushNotificationActionPerformed', …) registered
   │        (Registered BEFORE Angular so Capacitor does not lose the event)
   │        Handler extracts route:
   │            data.route        → route
   │            data.deeplink     → route
   │            data.room_id      → /chat/room/{room_id}
   │            data.articleId    → /news/{articleId}
   │        sessionStorage['__pendingPushRoute'] = route
   │
   └── Angular bootstraps → login completes → SecureShellComponent.ngOnInit()
            │
            ▼
       processPendingPushRoute()
            │
            ├── read sessionStorage['__pendingPushRoute']
            ├── sessionStorage.removeItem('__pendingPushRoute')
            ├── transformRouteForUserContext()   (prefix with /client-portal or /teamspace where appropriate)
            └── router.navigate([path], { queryParams })
```

### 4. Warm-start push tap (app already running)

```
PushNotifications.addListener('pushNotificationActionPerformed', …)
   │  (set up by PushNotificationService.setupNotificationClickHandlers during init)
   │
   ▼
notificationAction$ ReplaySubject emits { data, actionId }
   │
   ▼
SecureShellComponent subscription
   │
   ├── extractRouteFromNotification(data)   — same priority order as cold-start,
   │                                         plus submissionId, appointmentId
   ├── transformRouteForUserContext()
   └── router.navigate()
```

### 5. Foreground resume revalidation

```
Capacitor App 'appStateChange' (native) | document visibilitychange (web)
   │
   ▼
SecureShellComponent.handleAppResume()
   │
   ├── PushNotificationService.clearDeliveredNotifications()   (native only)
   ├── matrixClientService.retrySync()                         (if chat initialized)
   ├── notificationCenterService.loadUnreadCount()
   ├── appBadgeService.updateBadge()
   │
   └── if pushInitialized:
          │
          └── PushNotificationService.revalidateSubscription()
                  │
                  ├── GET /api/subscriptions/status?provider=…&pushkey=…
                  ├── exists && belongs_to_current_user → no-op
                  └── else → re-subscribe, then MatrixPusherService.resetState()
```

## Non-Goals

- In-app notification center / toast display (→ `specs/shell/notification-center/` if created).
- Detailed session-expiry navigation (→ `specs/features/session-expired/`).
- `AuthorizationStore` internals and permission-computation rules (→ `specs/cross-cutting/context-resolution/`).
- Matrix pusher registration details (handled by `@tagea/chat`, called from `SecureShellComponent`).
- Capgo OTA update flow (→ `specs/cross-cutting/native-updates/` if created).
- Backend implementation of the Matrix push gateway (separate service — we only document the HTTP contract we call).

## Edge Cases

- **Permission denied at OS level:** App works without errors. `subscriptionState` becomes `'permission-denied'`; no push calls made. User can re-enable later via settings and trigger `enableNotifications()` from a UI gesture.
- **Native cold start with expired access token:** `ensureProfileLoaded` detects `hasRefreshToken()` and calls `checkAndRefreshSession()` before proceeding. Refresh tokens are valid 30 days (offline scope).
- **Pending push route + user logs out before consuming it:** The route persists in `sessionStorage` until the tab is closed or `SecureShellComponent` consumes it. If the next login is for a different user, `transformRouteForUserContext` still prefixes correctly based on the new user type.
- **Multiple devices per user:** Gateway deduplicates by `(provider, pushkey)`. The frontend does not track device IDs explicitly; it always checks subscription status by its own pushkey before registering.
- **Brand ID changes for a tenant at runtime:** Requires logout/login. `_pushBrandId` is only loaded on profile fetch.
- **VAPID public key missing (web):** `subscribeWeb()` throws early with a clear message. Service Worker push disabled without server config.
- **Firefox permission timing:** Browser requires `requestPermission()` to be called in direct response to a user gesture. `enableNotifications()` must be called from a click/tap handler, not programmatically.
- **iOS token-race on register:** Capacitor listeners must be registered via `await addListener(...)` before `PushNotifications.register()` because iOS can fire the `registration` event synchronously when a device token is cached.
- **Service Worker disabled in dev:** `environment.enableServiceWorker` is `false` in non-prod builds; push on web only works in prod builds or with a manual override.

## Permissions & Tenant/Institution

- **Bootstrap:**
  - All protected routes require an authenticated OIDC session. Public routes (see list in §`initializeApp`) skip profile loading entirely.
  - `initializeTenant` runs before any guard and can short-circuit to `/welcome` for custom-domain or native-tenant setups without an HTTP request (synchronous check prevents an `AUTH_GUARD` race against Keycloak redirect).
- **Push registration:**
  - Requires a valid access token (passed to gateway as `Bearer`).
  - Gateway uses the token's `sub` to register/dedupe per user.
  - `brand_id` is optional in the payload — if present, the gateway associates the subscription with a specific brand (white-label). If absent, the gateway uses its default brand.
- **Push-brand management endpoints** (`/push-gateway/brands`): `super-admin` scope only. Tenant admins cannot reconfigure FCM credentials through the app.

## Notifications (Push / In-App)

- **Triggers:** All backend events that fan out to registered devices — chat messages, calls, invitations, mentions, appointment reminders, news articles, teamspace submissions. This bundle only handles **transport** (Capacitor FCM / Web Push) and **cold-start deeplinks**, not trigger semantics (those live in each feature's spec).
- **Notification data shape** (as received by the frontend; emitted by the Matrix push gateway / backend):
  - `data.route?: string` — explicit app route (preferred)
  - `data.deeplink?: string` — URL
  - `data.room_id?: string` — chat room → `/chat/room/{id}`
  - `data.articleId?: string` — news → `/news/{id}`
  - `data.submissionId?: string` — teamspace submission (warm-start only)
  - `data.appointmentId?: string` — teamspace appointment (warm-start only)
- **Deep link:** See `extractRouteFromNotification` in `SecureShellComponent` for the authoritative priority order; `main.ts` handles a subset (the cold-start variants).
- **Dismiss behavior:** On app resume, `PushNotificationService.clearDeliveredNotifications()` clears the notification center on native. On web, browsers auto-expire notifications.

## i18n Keys

Bootstrap itself has no visible strings (splash is a static image). The notification prompt uses:

- `notifications.prompt.title`
- `notifications.prompt.body`
- `notifications.prompt.enable`
- `notifications.prompt.dismiss`

Android notification channel names (German, user-visible in system settings):

- `messages` → "Nachrichten"
- `calls` → "Anrufe"
- `invitations` → "Einladungen"
- `mentions` → "Erwähnungen"
- `missed_calls` → "Verpasste Anrufe"
- `room_updates` → "Raum-Updates"
- `general` → "Allgemeine Push-Nachrichten"
- `default` → "Sonstige"

These are currently hard-coded in `PushNotificationService` as part of the `ANDROID_NOTIFICATION_CHANNELS` constant. If localization is required, the channel registration must be re-run on language change.

## Offline Behavior

> **Flutter port note.**
> On web, the Angular Service Worker (`ngsw-worker.js`) caches static assets (JS bundles, CSS, fonts, images) with `registerWhenStable:30000`. No API caching is configured — every backend call goes to the network. On native, Capacitor packages assets into the bundle; no runtime cache is needed. In Flutter, static asset caching is implicit via the Flutter asset bundle; the spec-relevant behavior is only the push transport.

## References

- **Angular implementation:**
  - `apps/tagea-frontend/src/main.ts` — pre-Angular init (Sentry, cold-start push listener, brand config, Capgo)
  - `apps/tagea-frontend/src/app/app.module.ts` — `APP_INITIALIZER` chain, `ServiceWorkerModule.register`, `PUSH_CONFIG` provider
  - `apps/tagea-frontend/src/app/core/app-initializer.ts` — `initializeTenant`, `initializeApp`
  - `apps/tagea-frontend/src/app/services/unified-auth.service.ts` — `ensureProfileLoaded`, `loadEmployeeProfile`, `_pushBrandId`
  - `apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts` — push init effect, `processPendingPushRoute`, `handleAppResume`, `extractRouteFromNotification`
  - `packages/push/src/lib/services/push-notification.service.ts` — platform-agnostic push service
  - `packages/push/src/lib/services/platform.service.ts` — platform detection
  - `packages/push/src/lib/tokens/push-config.token.ts` — `PUSH_CONFIG` interface
  - `apps/tagea-frontend/src/app/services/push-gateway-brand.service.ts` — super-admin brand CRUD
- **E2E tests:** Not covered by current E2E suite (push requires real FCM/service-worker fixtures).
- **Backend endpoints:** see [contracts.md](./contracts.md)
