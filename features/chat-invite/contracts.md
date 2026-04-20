# Contracts: Chat Invite

This wrapper has no direct backend contracts. The Matrix invite protocol is owned by `@tagea/chat`.

## Route Contract

```ts
// From apps/tagea-frontend/src/app/app.routes.ts
{
  path: 'chat/invite/:roomId',
  children: CHAT_INVITE_ROUTE,
  canActivate: [permissionGuard, chatFeatureGuard],
  data: { requiredPermission: 'chat.access' },
}
```

```ts
// From packages/chat/src/lib/routes.ts
export const CHAT_INVITE_ROUTE: Routes = [
  {
    path: '',
    component: InvitePreviewComponent,
  },
];
```

## Path Parameters

- `roomId` — the Matrix room the invite points to.

## Guards

| Guard              | Source       | Blocks                                 |
| ------------------ | ------------ | -------------------------------------- |
| `AUTH_GUARD`       | parent route | unauthenticated users                  |
| `permissionGuard`  | invite route | users without `chat.access` permission |
| `chatFeatureGuard` | invite route | tenants with chat feature disabled     |

> Notably **no** `activeRoomGuard` — the user's not yet a room member at invite time.

## Library-Owned Behavior

`InvitePreviewComponent` internally handles:

- Fetching invite metadata (room name, avatar, inviter, etc.)
- Accept → Matrix join RPC → navigation into the room
- Decline → Matrix leave/reject RPC → navigation out

> **Flutter port note:** delegate to the Flutter chat widget's invite view. The router wrapper's job is just to mount the widget with the `roomId` argument.
