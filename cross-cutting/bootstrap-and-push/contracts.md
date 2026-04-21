# Contracts: Bootstrap And Push

> API endpoints, DTOs, events — everything that flows between frontend and backend during bootstrap and push-notification registration.

## Endpoints — Tagea Backend (`/api`)

Bootstrap consumes several tenant/auth endpoints from `UnifiedAuthService.loadEmployeeProfile`. These are cross-referenced here for completeness; full shapes live in `specs/cross-cutting/context-resolution/contracts.md`.

### `GET /auth/current`

Loads employee + tenant + availableTenants. Called from `UnifiedAuthService.loadEmployeeProfile`. See context-resolution spec.

### `GET /tenants/current/features`

Loads tenant feature flags. Called during bootstrap. See i18n-and-theming / tenant-features spec.

### `GET /tenants/current/push-brand`

Loads the brand ID used for push-gateway user registration.

> Documentation-only shape. The frontend consumes this inline as `{ brandId: string | null }`; no named interface exists in the Angular source.

```ts
// Response
interface PushBrandResponse {
  brandId: string | null;
}
```

**Source:** frontend call in `UnifiedAuthService.loadEmployeeProfile`:

```ts
const { brandId } = await firstValueFrom(this.http.get<{ brandId: string | null }>(pushBrandUrl));
this._pushBrandId.set(brandId);
```

### `GET /push-notifications/vapid-public-key`

Returns the VAPID public key for Web Push subscription. Not called directly by the frontend code path documented here — the key is provided via `PUSH_CONFIG.vapidPublicKey` (environment / brand config) — but the backend exposes it for dynamic configuration.

> Documentation-only shape. Backend response, no corresponding interface in frontend source.

```ts
// Response
interface VapidPublicKeyResponse {
  publicKey: string; // Base64url-encoded VAPID public key
}
```

**Auth:** `authenticated` scope.

### `POST /push-notifications/devices`

Registers a push device with the Tagea backend. This endpoint is maintained alongside the Matrix push gateway registration (see below); the backend path mirrors the gateway shape so either side can serve as source of truth per environment.

> Documentation-only shape. `RegisterDeviceDto` and `DeviceInfo` are defined in `apps/tagea-backend/`, not in the frontend source.

```ts
// Request (apps/tagea-backend/src/push-notifications/dto/register-device.dto.ts)
interface RegisterDeviceDto {
  provider: 'webpush' | 'fcm';
  webpush?: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  deviceToken?: string; // required for fcm
  deviceName?: string;
}

// Response
interface DeviceInfo {
  id: string; // uuid
  provider: 'webpush' | 'fcm';
  deviceName: string | null;
  isActive: boolean;
  createdAt: string; // ISO 8601
  lastUsedAt: string | null;
}
```

**Auth:** `authenticated` scope.
**Error codes:** 400 (invalid request / push not configured), 401.

### `GET /push-notifications/devices`

Lists the current user's registered devices.

```ts
// Response: DeviceInfo[] (same shape as POST response)
```

**Auth:** `authenticated` scope.

### `DELETE /push-notifications/devices/:id`

Unregisters a device.

**Auth:** `authenticated` scope.
**Status:** 204 on success, 400 if device not found or not owned.

### `/push-gateway/brands` (super-admin only)

Brand CRUD is used by `PushGatewayBrandService` in the admin UI. Path prefix: `/api/push-gateway/brands`.

> Documentation-only shape. `CreateBrandDto`, `UpdateBrandDto`, `DeleteWithCascadeResponse` are defined in `apps/tagea-backend/`; `Brand`, `BrandDetails`, `FCMConfig` also exist in `PushGatewayBrandService` (frontend service).

```ts
// apps/tagea-backend/src/push-notifications/dto/brand.dto.ts
interface CreateBrandDto {
  brand_id: string;
  fcm?: FCMConfig;
}

interface UpdateBrandDto {
  fcm?: FCMConfig;
}

interface FCMConfig {
  project_id: string;
  client_email: string;
  private_key: string;
}

// Response shapes (from PushGatewayBrandsController)
interface Brand {
  brand_id: string;
  has_fcm: boolean;
  registered_at: string; // ISO 8601
}

interface BrandDetails extends Brand {
  user_count?: number;
  tenants?: string[];
}

interface DeleteWithCascadeResponse {
  success: boolean;
  users_deleted: number;
  subscriptions_deleted: number;
}
```

| Method | Path                            | Purpose                | Status        |
| ------ | ------------------------------- | ---------------------- | ------------- |
| POST   | `/push-gateway/brands`          | Create brand           | 201, 400, 409 |
| GET    | `/push-gateway/brands`          | List brands            | 200           |
| GET    | `/push-gateway/brands/:brandId` | Brand details          | 200, 404      |
| PATCH  | `/push-gateway/brands/:brandId` | Update FCM config      | 204, 404      |
| DELETE | `/push-gateway/brands/:brandId` | Delete brand + cascade | 200, 404      |

**Auth:** `super-admin` scope.

## Endpoints — Matrix Push Gateway (`{PUSH_CONFIG.gatewayUrl}`)

These calls do NOT go to the Tagea backend; they go directly to the Matrix Push Gateway service (URL injected via `PUSH_CONFIG.gatewayUrl`). Authorized with the same Keycloak `Bearer` token (the gateway validates against the same issuer).

### `GET /api/subscriptions/status`

Check whether the gateway already has a subscription for this pushkey.

> Documentation-only shape. `SubscriptionStatusResponse` is an internal interface in `packages/push/` — the frontend consumes it inline from the service.

```ts
// Query parameters
//   provider: 'webpush' | 'fcm' | 'apns'
//   pushkey:  string (URL-encoded endpoint or device_token)

// Response
interface SubscriptionStatusResponse {
  exists: boolean;
  belongs_to_current_user: boolean;
}
```

### `POST /api/webpush/subscriptions`

Register a web push subscription.

> Documentation-only shape. The frontend passes `PushSubscription.toJSON()` plus optional `brand_id`; no named `WebPushSubscriptionPayload` interface exists in source.

```ts
// Request body (sent by PushNotificationService.sendWebPushSubscriptionToGateway)
interface WebPushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  brand_id?: string;
}
```

### `POST /api/fcm/subscriptions`

Register a native (Android FCM or iOS via APNs/FCM bridge) subscription.

> Documentation-only shape. Sent inline as `{ device_token, brand_id? }`; no named `FcmSubscriptionPayload` interface in source.

```ts
// Request body (sent by PushNotificationService.sendNativeSubscriptionToGateway)
interface FcmSubscriptionPayload {
  device_token: string;
  brand_id?: string;
}
```

### `DELETE /api/subscriptions/:provider/:pushkey`

Remove a subscription (called during logout).

- `provider`: `webpush` | `fcm` | `apns`
- `pushkey`: URL-encoded endpoint or device_token

## Frontend Data Models

### Push subscription union

> Documentation-only shape. These types live in `packages/push/src/lib/models/push.types.ts`, outside the frontend app source the verifier scans.

```ts
// packages/push/src/lib/models/push.types.ts
type WebPushSubscription = PushSubscription; // browser PushSubscription
interface FCMSubscription {
  device_token: string;
}
interface APNsSubscription {
  device_token: string;
}
type PushSubscriptionData = WebPushSubscription | FCMSubscription | APNsSubscription;

type PushSubscriptionState = 'unsubscribed' | 'subscribing' | 'subscribed' | 'error' | 'permission-denied';

interface PushNotificationPayload {
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: {
      deeplink?: string;
      room_id?: string;
      event_id?: string;
    };
  };
}

interface PushError {
  type: 'permission' | 'subscription' | 'network' | 'unknown';
  message: string;
  originalError?: unknown;
}

interface NotificationActionEvent {
  data: Record<string, unknown>;
  actionId?: string;
}
```

### `PUSH_CONFIG` injection token

> Documentation-only shape. Defined in `packages/push/src/lib/tokens/push-config.token.ts`.

```ts
// packages/push/src/lib/tokens/push-config.token.ts
interface PushConfig {
  gatewayUrl: string;
  pusherUrl?: string; // URL sent to Matrix homeserver (may differ inside Docker)
  vapidPublicKey?: string;
  appIds?: {
    web: string;
    android: string;
    ios: string;
  };
  appId?: string; // deprecated, legacy web-only
  appDisplayName?: string;
  autoRequestPermission?: boolean; // default false
}
```

Provided in `app.module.ts`:

```ts
{
  provide: PUSH_CONFIG,
  useValue: {
    gatewayUrl: environment.push.gatewayUrl,
    pusherUrl: environment.push.pusherUrl,
    vapidPublicKey: environment.push.vapidPublicKey,
    appId: brandConfig?.appId ?? 'de.tagea.v2',
    appDisplayName: brandConfig?.displayName ?? 'Tagea',
  },
}
```

### Cold-start notification payload contract

What `main.ts` reads off the Capacitor `pushNotificationActionPerformed` event. Field names must stay consistent with what the push gateway / backend sends:

> Documentation-only shape — not a compiled interface; this is the contract the backend/gateway must respect.

```ts
interface NotificationDataPayload {
  route?: string; // preferred: explicit app route
  deeplink?: string; // alternative: URL
  room_id?: string; // → /chat/room/{id}
  articleId?: string; // → /news/{id}
  submissionId?: string; // warm-start only: → /teamspace/submissions/{id}
  appointmentId?: string; // warm-start only: → /teamspace/buchung/{id}
}
```

### Android notification channels

Hard-coded in `PushNotificationService` as `ANDROID_NOTIFICATION_CHANNELS: Channel[]` (where `Channel` comes from `@capacitor/push-notifications`). Each channel:

> Documentation-only shape — mirrors `@capacitor/push-notifications` `Channel` interface (external library, not local source).

```ts
interface Channel {
  id: string; // must match the channelId the gateway sets in FCM payload
  name: string; // German user-facing label
  description: string;
  importance: 1 | 2 | 3 | 4 | 5; // 1=min, 2=low, 3=default, 4=high, 5=max
  sound: string; // 'default' or custom sound filename
  vibration: boolean;
}
```

## Events

### Capacitor push events (native)

From `@capacitor/push-notifications`:

- `registration` — `(token: { value: string }) => void` — fired after `PushNotifications.register()` succeeds. Listener must be registered via `await PushNotifications.addListener('registration', …)` **before** calling `register()` to avoid iOS token-race.
- `registrationError` — `(err: { error: string }) => void`
- `pushNotificationReceived` — `(notification: PushNotificationSchema) => void` — fired while app is in foreground.
- `pushNotificationActionPerformed` — `(action: ActionPerformed) => void` — fired when user taps a notification. Handled in **two places**:
  1. `main.ts` (cold start, pre-Angular) — writes route to `sessionStorage['__pendingPushRoute']`.
  2. `PushNotificationService.setupNotificationClickHandlers` (warm start, defined in `packages/push/`) — emits to `notificationAction$` ReplaySubject.

### Web SwPush events

From `@angular/service-worker`:

- `swPush.subscription` — `Observable<PushSubscription | null>`
- `swPush.notificationClicks` — `Observable<{ action: string; notification: NotificationOptions & { data: unknown } }>` — web equivalent of `pushNotificationActionPerformed`.

### Capacitor App lifecycle

- `App.addListener('appStateChange', (state: AppState) => void)` — `state.isActive` true when foreground.

## Session storage key

| Key                  | Writer                                                         | Reader                                           | Scope           |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------ | --------------- |
| `__pendingPushRoute` | `main.ts` cold-start `pushNotificationActionPerformed` handler | `SecureShellComponent.processPendingPushRoute()` | Per browser tab |

## Error codes (push)

| Source                 | Code / Condition                                   | Frontend behavior                                                                         |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| OS permission          | `denied`                                           | `subscriptionState = 'permission-denied'`, `needsPermissionPrompt = false`, silent error. |
| `requestPermission`    | Throws                                             | `error` signal set with type `'permission'`. App continues.                               |
| Gateway POST subscribe | Non-2xx                                            | `error` signal with type `'subscription'`; throw wrapped Error.                           |
| Gateway status 5xx     | Any                                                | Fall through to re-subscribe path (treat as "needs subscription").                        |
| iOS register timeout   | 15 s without `registration` event                  | Reject with `'Push registration timeout after 15 seconds'`.                               |
| VAPID key missing      | `config.vapidPublicKey` undefined on web subscribe | Throw `'VAPID public key is required for web push notifications.'`.                       |

## Flutter port notes

> **Flutter port note.**
> The `sessionStorage['__pendingPushRoute']` mechanism does not port directly — Flutter has no sessionStorage. Use Flutter Local Notifications' `getNotificationAppLaunchDetails()` (or `FirebaseMessaging.instance.getInitialMessage()`) at app start to pick up the notification that launched the app. The route-extraction priority order (`data.route` → `data.deeplink` → `room_id` → `articleId`) must stay identical to match the backend payload contract.
>
> The Android notification channel IDs (`messages`, `calls`, `invitations`, `mentions`, `missed_calls`, `room_updates`, `general`, `default`) are a shared contract — the backend sends `channel_id` in the FCM payload, and the Flutter app must create channels with the same IDs or notifications fall back to the default channel.
