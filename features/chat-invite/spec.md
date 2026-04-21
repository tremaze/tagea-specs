# Feature: Chat Invite

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Fullscreen preview of a chat invitation — shown when a user is invited to a Matrix room and arrives at `/chat/invite/:roomId` (typically via a push-notification deep link). Renders `@tagea/chat`'s `InvitePreviewComponent` which handles the accept/decline flow and, on accept, transitions the user into the room.

## User Stories

- As an **invited user** I want to see a preview of the room before joining, so that I can decide whether to accept.
- As a **user tapping a push notification** I want to land directly on the invite preview, so that I don't need extra navigation.

## Acceptance Criteria

- [ ] **Given** the URL is `/chat/invite/:roomId`, **When** the route activates, **Then** the secure-shell layout wraps the page (auth required) but the secure-main navigation is bypassed (fullscreen).
- [ ] **Given** `InvitePreviewComponent` renders, **When** the invitation is resolved, **Then** the room avatar, room name, direct-vs-group info line (with member count for groups), a static description, and accept/decline buttons are shown.
- [ ] **Given** the user accepts, **When** `ConversationsService.acceptInvite(roomId)` resolves, **Then** the active room is set via `ActiveConversationService.selectRoom(roomId)` and the router navigates to `['room', roomId]` relative to the parent route.
- [ ] **Given** the user declines, **When** `ConversationsService.declineInvite(roomId)` resolves, **Then** the active invite highlight is cleared via `ActiveConversationService.clearInvite()` and the router navigates to `[]` relative to the parent route.

## UI States

Owned entirely by `@tagea/chat`'s `InvitePreviewComponent`.

## Flows

```
Push notification tap ──▶ /chat/invite/:roomId
                             │
                             ▼
                         AUTH_GUARD
                             │
                             ▼
                         SecureShellComponent
                             │
                             ▼
                         permissionGuard + chatFeatureGuard
                             │
                             ▼
                         CHAT_INVITE_ROUTE → InvitePreviewComponent
                             │
                       ┌─────┴─────┐
                       ▼           ▼
                    accept       decline
                       │           │
                       ▼           ▼
           router.navigate(['room', roomId],   router.navigate([],
             {relativeTo: parent})              {relativeTo: parent})
```

## Non-Goals

- **Group invite UI** (sending invitations to multiple users) — separate library flow; this page is for receiving/acting on a single invite.
- **Room creation** — separate library flow.

## Edge Cases

- **`roomId` is missing from the URL** — `currentRoomId()` is undefined and the template renders nothing (`@if (currentRoomId()`).
- **Room not present in `pendingInvites`** — `memberCount` falls back to `0` and `isDirect` to `false`; the static description still renders.
- **Accept/decline RPC fails** — error is logged to console via `console.error` and the user stays on the invite route (no navigation occurs).
- **Deep link while unauthenticated** — `AUTH_GUARD` on the parent secure-shell forces login first, then re-targets the invite URL.

## Permissions & Tenant/Institution

- **Required roles:** `permissionGuard` with `requiredPermission: 'chat.access'` + `chatFeatureGuard` at route level.
- **No `activeRoomGuard`** on this route (unlike chat-room) — the invite is the entry that may not yet have room access.

## Notifications (Push / In-App)

- **Primary deep-link target** for invite push notifications.

## i18n Keys

- Owned by `@tagea/chat`.

## Offline Behavior

**Flutter-specific:**

- Owned by the Flutter port of `@tagea/chat`. Accepting an invite requires online; show offline hint if attempted.

## References

- **Route definition:** `apps/tagea-frontend/src/app/app.routes.ts` (`path: 'chat/invite/:roomId'`, children: `CHAT_INVITE_ROUTE`)
- **Chat library route constant:** [`packages/chat/src/lib/routes.ts#CHAT_INVITE_ROUTE`](../../../packages/chat/src/lib/routes.ts)
- **Chat library component:** `InvitePreviewComponent` (exported from `@tagea/chat`)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol
