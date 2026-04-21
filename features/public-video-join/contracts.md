# Contracts: Public Video Join

## Services

| Service               | Purpose                            |
| --------------------- | ---------------------------------- |
| `GuestBookingService` | Token validation + metadata lookup |
| `JitsiService`        | Jitsi Meet integration             |
| `LivekitService`      | LiveKit integration                |

The component picks between Jitsi / LiveKit by checking the `provider` field of the token-validation response. It defaults to Jitsi and swaps to LiveKit when `response.provider === 'LIVEKIT'`.

## Backend endpoint

```ts
// apps/tagea-backend/src/public-api/guest-booking.controller.ts
// Guard: @Public() decorator — no JWT / role checks.
// Validation: token must match /^[0-9a-f-]{36}$/; tenantId must be a valid UUID.
@Controller('public/booking')
class GuestBookingController {
  @Public()
  @Get('video-token/:token')
  getVideoToken(
    token: string,              // path param
    req: Request,               // tenantId read from req.query
  ): Promise<GuestVideoTokenResponse>;
}
```

HTTP call from the frontend:

```
GET /public/booking/video-token/:token?tenantId=<uuid>
```

There is **no** POST variant and the endpoint does **not** live under `/video-calls/...`. The response body matches `GuestVideoTokenResponse` below; the component then maps it into a `VideoCallToken`.

## Data Models

```ts
// apps/tagea-frontend/src/app/services/guest-booking.service.ts
interface GuestVideoTokenResponse {
  provider: 'JITSI' | 'LIVEKIT';
  token: string;
  roomName: string;
  serverUrl?: string;
  wsUrl?: string;
  isModerator: boolean;
  displayName: string;
}
```

```ts
// apps/tagea-frontend/src/app/models/jitsi.model.ts
type VideoProvider = 'JITSI' | 'LIVEKIT';

interface VideoCallToken {
  provider: VideoProvider;
  token: string;
  roomName: string;
  serverUrl?: string;
  wsUrl?: string;
  isModerator: boolean;
  displayName: string;
}

interface VideoPreJoinPrefs {
  audioEnabled: boolean;
  videoEnabled: boolean;
  blurEnabled: boolean;
}
```

```ts
// apps/tagea-frontend/src/app/components/video-pre-join/video-pre-join.component.ts
// Emitted by the VideoPreJoinComponent `join` output; shape-compatible with VideoPreJoinPrefs.
interface VideoPreJoinPreferences {
  audioEnabled: boolean;
  videoEnabled: boolean;
  blurEnabled: boolean;
}
```

> **Casing note:** this model uses camelCase (`audioEnabled`, `videoEnabled`, `roomName`, `displayName`) — different from the snake_case used elsewhere. Mirror exactly when porting.

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/public.routes.ts
{
  path: 'public/video/:token',
  loadComponent: () =>
    import('../pages/public-video-join/public-video-join.component')
      .then((m) => m.PublicVideoJoinComponent),
}
```

Note: this route is **not** wrapped with `data: { showHeader: true }` (unlike `public/register`) — the video UI takes the full viewport. The `tenantId` is expected as a query-string parameter (`?tenantId=<uuid>`); the component reads it from `ActivatedRoute.snapshot.queryParamMap` and surfaces an error if it is missing.
