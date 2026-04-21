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

> Documentation-only shape. The service methods listed below live in `@tagea/chat` (`packages/chat/src/lib/services/conversation/`), not in the Angular app, so they are not verified against `apps/tagea-frontend/src/` by `verify-contracts.js`.

```ts
// documentation-only
// Resolved from packages/chat/src/lib/components/invite-preview/invite-preview.component.ts
class InvitePreviewComponent {
  // Reads roomId from ActivatedRoute.paramMap or from a `roomId` input.
  // Mirrors the active invite via activeConversationService.selectInvite(roomId) on mount.
  // Resolves preview data from conversationsService.pendingInvites() and renders:
  //   - room avatar, room name
  //   - direct-vs-group info line (isRoomDirect helper)
  //   - member count via room.getMembers().length
  //
  // Accept flow:
  //   conversationsService.acceptInvite(roomId)
  //   → activeConversationService.selectRoom(roomId)
  //   → router.navigate(['room', roomId], { relativeTo: parentRoute })
  //
  // Decline flow:
  //   activeConversationService.clearInvite()
  //   → conversationsService.declineInvite(roomId)
  //   → router.navigate([], { relativeTo: parentRoute })
  //
  // Errors: logged via console.error; no navigation occurs on failure.
}
```

> **Navigation note:** navigation is relative to the parent route. Mounted under `app.routes.ts` at `/chat/invite/:roomId`, accepting resolves to `/chat/invite/room/:roomId` (not `/chat/room/:roomId`). When mounted inside `CHAT_ROUTES` under `ChatContainerComponent`, the parent is `/chat`, so it resolves to `/chat/room/:roomId`.

> **Flutter port note:** delegate to the Flutter chat widget's invite view. The router wrapper's job is just to mount the widget with the `roomId` argument.
