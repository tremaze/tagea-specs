# Contracts: Public Video Join

## Services

| Service               | Purpose                            |
| --------------------- | ---------------------------------- |
| `GuestBookingService` | Token validation + metadata lookup |
| `JitsiService`        | Jitsi Meet integration             |
| `LivekitService`      | LiveKit integration                |

The component picks between Jitsi / LiveKit based on a platform indicator returned by the backend during token validation.

## Data Models

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

> **Casing note:** this model uses camelCase (`audioEnabled`, `videoEnabled`, `roomName`, `displayName`) — different from the snake_case used elsewhere. Mirror exactly when porting.

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/public.routes.ts (lines 99-104)
{
  path: 'public/video/:token',
  loadComponent: () => import('../pages/public-video-join/public-video-join.component').then(m => m.PublicVideoJoinComponent),
}
```

Note: this route is **not** wrapped with `showHeader: true` (unlike booking / public-register) — the video UI takes the full viewport.
