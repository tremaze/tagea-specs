# Contracts: Chat Room

This wrapper has no direct backend contracts. The Matrix protocol, room API, and message endpoints are owned by `@tagea/chat`.

## Route Contract

```ts
// From apps/tagea-frontend/src/app/app.routes.ts
{
  path: 'chat/room/:roomId',
  children: CHAT_ROOM_ROUTE,
  canActivate: [permissionGuard, chatFeatureGuard],
  data: { requiredPermission: 'chat.access' },
}
```

```ts
// From packages/chat/src/lib/routes.ts
export const CHAT_ROOM_ROUTE: Routes = [
  {
    path: '',
    component: ChatRoomPageComponent,
    canActivate: [activeRoomGuard],
  },
];
```

## Path Parameters

- `roomId` — the Matrix room identifier. Passed through to `ChatRoomPageComponent` and consumed by `activeRoomGuard`.

## Guards

| Guard              | Source                    | Blocks                                                                                                                             |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_GUARD`       | parent route              | unauthenticated users                                                                                                              |
| `permissionGuard`  | `chat/room/:roomId` route | users without `chat.access` permission                                                                                             |
| `chatFeatureGuard` | `chat/room/:roomId` route | tenants with chat feature disabled                                                                                                 |
| `activeRoomGuard`  | `CHAT_ROOM_ROUTE`         | does not block — calls `selectRoom` on the library's `ActiveConversationService` with the route `roomId` and always returns `true` |

> **Flutter port note:** Flutter's router equivalent receives the `roomId` as a path parameter. The four guards map to a combination of router redirects + stream-driven guards exposed by the chat widget. Do not reimplement `activeRoomGuard` logic — delegate to the Flutter chat widget.
