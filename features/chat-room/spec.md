# Feature: Chat Room

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Fullscreen view of a single chat conversation — used when the user arrives from a push-notification deep link or opens chat outside the normal secure-main navigation. Renders `@tagea/chat`'s `ChatRoomPageComponent` (a room-level UI that provides its own app bar, back navigation, and room rendering).

## User Stories

- As a **user tapping a chat push notification** I want to land directly in the conversation, so that I don't have to navigate through a list to find it.
- As a **user on a low-end device** I want a fullscreen view that isn't weighed down by the surrounding shell, so that chat stays responsive.

## Acceptance Criteria

- [ ] **Given** the URL is `/chat/room/:roomId`, **When** the route activates, **Then** the secure-shell layout wraps the page (auth is required) but the secure-main navigation does not (direct fullscreen).
- [ ] **Given** the `activeRoomGuard` (from `@tagea/chat`) runs, **When** the route has a `roomId` parameter, **Then** the guard calls `ActiveConversationService.selectRoom(roomId)` (and additionally resolves the full room object from `ConversationsService.findRoomById` if available) so that `ChatRoomPageComponent` can render against the active room. The guard always returns `true` — access control for missing/forbidden rooms is handled downstream inside the page/component.
- [ ] **Given** the guard runs, **When** the page renders, **Then** `ChatRoomPageComponent` handles the full room UI (app bar, back navigation, messages, composer).

## UI States

Owned entirely by `@tagea/chat`'s `ChatRoomPageComponent`. From the router's perspective this page is a single mount point.

## Flows

```
push notification tap ──▶ /chat/room/:roomId
                             │
                             ▼
                         AUTH_GUARD
                             │
                             ▼
                         SecureShellComponent (layout)
                             │
                             ▼
                         permissionGuard + chatFeatureGuard
                             │
                             ▼
                         CHAT_ROOM_ROUTE
                             │
                             ▼
                         activeRoomGuard (library — syncs roomId into ActiveConversationService)
                             │
                             ▼
                         ChatRoomPageComponent renders
```

## Non-Goals

- **Room list** — accessed via `/chat` (see [chat](../chat/spec.md)) or the chat FAB.
- **Invite handling** — `/chat/invite/:roomId` has its own page ([chat-invite](../chat-invite/spec.md)).

## Edge Cases

- **Invalid `roomId`** — `activeRoomGuard` still activates the route (it always returns `true`). `ChatRoomPageComponent` / `ActiveConversationService` resolve the room lazily; if the room cannot be found the page renders its empty/unresolved state until the Matrix sync produces the room or the user navigates away.
- **User doesn't have permission for the room** — not enforced by `activeRoomGuard`. Access is gated by `permissionGuard` (`chat.access`) + `chatFeatureGuard` at the route level; room-level authorization is ultimately enforced by the Matrix homeserver.
- **Deep link while unauthenticated** — `AUTH_GUARD` forces login first, and the router preserves the target URL.

## Permissions & Tenant/Institution

- **Required roles:** `permissionGuard` with `requiredPermission: 'chat.access'` + `chatFeatureGuard` at the route level (see `app.routes.ts`).
- **Route-level guard from the chat library:** `activeRoomGuard` — syncs the route `roomId` into `ActiveConversationService`. Always returns `true`; does not enforce access control.
- **Tenant feature flag:** `chat` — blocks activation if the tenant has chat disabled.

## Notifications (Push / In-App)

- **Primary deep-link target** for chat-related push notifications — messages, mentions, new-room invitations.
- The Flutter port's FCM handler should map a chat notification to this route (or its Flutter equivalent).

## i18n Keys

- Owned by `@tagea/chat`.

## Offline Behavior

**Flutter-specific:**

- Owned by the Flutter port of `@tagea/chat`. Typically: cached messages show, composer disabled offline.

## References

- **Route definition:** `apps/tagea-frontend/src/app/app.routes.ts` (`path: 'chat/room/:roomId'`, children: `CHAT_ROOM_ROUTE`)
- **Chat library route constant:** [`packages/chat/src/lib/routes.ts#CHAT_ROOM_ROUTE`](../../../packages/chat/src/lib/routes.ts)
- **Chat library component:** `ChatRoomPageComponent` (at `packages/chat/src/lib/components/conversation/chat-room-page/chat-room-page.component.ts`)
- **Guard:** `activeRoomGuard` (chat library)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol — owned by the chat library
