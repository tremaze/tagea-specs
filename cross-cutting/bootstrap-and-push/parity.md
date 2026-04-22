# Parity: Bootstrap And Push

## Angular

- **Status:** ✅ Implemented
- **Bootstrap entry:** `apps/tagea-frontend/src/main.ts`
- **Module:** `apps/tagea-frontend/src/app/app.module.ts`
- **Initializers:** `apps/tagea-frontend/src/app/core/app-initializer.ts`
- **Profile loader:** `apps/tagea-frontend/src/app/services/unified-auth.service.ts`
- **Push shell:** `apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts`
- **Push library:** `packages/push/src/lib/`
  - `services/push-notification.service.ts` — platform-agnostic service
  - `services/platform.service.ts` — platform detection
  - `tokens/push-config.token.ts` — config DI token
  - `models/push.types.ts` — types
- **Admin brand service:** `apps/tagea-frontend/src/app/services/push-gateway-brand.service.ts`
- **Backend controllers:** `apps/tagea-backend/src/push-notifications/`
  - `push-notifications.controller.ts` — device CRUD + VAPID key
  - `push-gateway-brands.controller.ts` — brand CRUD (super-admin)
- **E2E:** not covered — push requires real FCM / service-worker fixtures.

## Flutter

- **Status:** 🟡 Push transport done — bootstrap chain and cold-start deeplink still to do
- **Push stack:** `apps/tagea_frontend/lib/push/`
  - `firebase_bootstrap.dart` — `Firebase.initializeApp` + background handler wiring
  - `fcm_service.dart` — `FcmService` abstraction over `FirebaseMessaging`
  - `push_cubit.dart` — subscribe / revalidate / unsubscribe state machine
  - `push_gateway_client.dart` — REST client for `/api/fcm/subscriptions`
  - `matrix_pusher_service.dart` — homeserver pusher registration (sygnal)
  - `deeplink_router.dart` — safe route resolution from notification data
  - `permission_prompt.dart` — one-time bottom-sheet asking for OS permission
  - `notification_channels.dart` — Android channel constants + setup
- **Lifecycle wiring:** `apps/tagea_frontend/lib/app.dart` (`_PushLifecycleHost`) — `init()` on auth, `revalidate()` on resume, `unsubscribe()` via `AuthCubit.onBeforeLogout`
- **Config:** `apps/tagea_frontend/lib/config.dart` — `pushGatewayBaseUrl`, `pushBrandId`, per-platform pusher app IDs
- **Unit tests:** `apps/tagea_frontend/test/push/` (cubit, gateway client, deeplink router, matrix pusher)
- **Integration tests:** ⏳ not yet added (`integration_test/push/...`)

## Known Divergences

Bootstrap and push are the bundle with the **most** platform-specific differences. Flutter divergences should be documented here as they are implemented:

- **Bootstrap order:** Flutter does not have `APP_INITIALIZER`. Use `main()` with `await` on each phase (brand → auth bootstrap → tenant → features → runApp). The spec's sequential ordering must still hold.
- **Cold-start deeplink transport:** Web/Angular uses `sessionStorage['__pendingPushRoute']`. Flutter uses `FirebaseMessaging.getInitialMessage()` or `flutter_local_notifications.getNotificationAppLaunchDetails()`. The route-extraction rules are the same contract; the transport differs.
- **Service Worker:** Web-only. No equivalent in Flutter (Flutter caches assets via its bundle by default).
- **iOS push provider:** Angular relies on FCM backend (tokens are FCM tokens, even for iOS). Flutter may choose native APNs direct integration — the gateway's `/api/fcm/subscriptions` endpoint accepts FCM-bridged tokens but `/api/apns/subscriptions` would need to be added if Flutter registers raw APNs tokens.
- **Android notification channels:** Must be created with identical IDs and importance levels (see contracts.md) to match what the backend/gateway sends in FCM payloads.
- **Capgo OTA:** Angular-only concept (Capacitor bundle hot-swap). Flutter uses Shorebird or its App Store/Play Store releases — out of scope for this spec.
- **Matrix keystore bootstrap:** Angular runs `configurePickleKeyStore(nativePickleKeyStore)` in `main.ts`. Flutter will need equivalent secure-storage setup before Matrix client initializes — covered by the chat spec, not here.

## Port Log

| Date       | Who      | What                                                                                                                                                                             |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec drafted — bootstrap chain, push subscribe flow, cold-start deeplink, foreground revalidation documented.                                                                    |
| 2026-04-22 | ltoenjes | Flutter push transport completed — FCM subscribe/revalidate/unsubscribe, gateway handshake, Matrix pusher registration, deeplink routing, permission prompt and lifecycle wired. |
