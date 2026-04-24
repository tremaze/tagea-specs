# Feature: Chat Invite

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Fullscreen preview of a chat invitation — shown when a user is invited to a Matrix room and arrives at `/chat/invite/:roomId` (typically via a push-notification deep link). Renders `@tagea/chat`'s `InvitePreviewComponent` which handles the accept/decline flow and, on accept, transitions the user into the room.

## User Stories

- As an **invited user** I want to see a preview of the room before joining, so that I can decide whether to accept.
- As a **user tapping a push notification** I want to land directly on the invite preview, so that I don't need extra navigation.
- _(Flutter-only)_ As a **user browsing my chat list** I want to see pending invites at the top of the room list with inline accept/decline controls, so that I can act on them without opening a detail page.

## Acceptance Criteria

- [ ] **Given** the URL is `/chat/invite/:roomId`, **When** the route activates, **Then** the secure-shell layout wraps the page (auth required) but the secure-main navigation is bypassed (fullscreen).
- [ ] **Given** `InvitePreviewComponent` renders, **When** the invitation is resolved, **Then** the room avatar, room name, direct-vs-group info line (with member count for groups), a static description, and accept/decline buttons are shown.
- [ ] **Given** the user accepts, **When** `ConversationsService.acceptInvite(roomId)` resolves, **Then** the active room is set via `ActiveConversationService.selectRoom(roomId)` and the router navigates to `['room', roomId]` relative to the parent route.
- [ ] **Given** the user declines, **When** `ConversationsService.declineInvite(roomId)` resolves, **Then** the active invite highlight is cleared via `ActiveConversationService.clearInvite()` and the router navigates to `[]` relative to the parent route.

### Flutter-only Acceptance Criteria (Room List Integration)

- [ ] **Given** the current user has rooms with `Membership.invite`, **When** the room list renders, **Then** those invites appear as a distinct group above all joined rooms, sorted by invite timestamp descending.
- [ ] **Given** an invite tile in the room list, **When** the user taps the accept icon, **Then** `room.join()` is called and the router navigates to `/chat/:roomId` on success.
- [ ] **Given** an invite tile in the room list, **When** the user taps the decline icon, **Then** `room.leave()` followed by `room.forget()` is called and the tile disappears from the list on success.
- [ ] **Given** an invite tile, **When** the user taps the body (not the action icons), **Then** the router navigates to `/chat/:roomId/invite` where the same accept/decline actions are available in a fullscreen preview.
- [ ] **Given** the detail route `/chat/:roomId/invite`, **When** the user accepts, **Then** the router navigates to `/chat/:roomId`. **When** the user declines, **Then** the router navigates back to the room list (`/chat`).

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
- Decline on the Flutter client performs both `room.leave()` and `room.forget()` so the tile does not reappear on the next sync; Angular has no equivalent list integration.

## References

- **Route definition:** `apps/tagea-frontend/src/app/app.routes.ts` (`path: 'chat/invite/:roomId'`, children: `CHAT_INVITE_ROUTE`)
- **Chat library route constant:** [`packages/chat/src/lib/routes.ts#CHAT_INVITE_ROUTE`](../../../packages/chat/src/lib/routes.ts)
- **Chat library component:** `InvitePreviewComponent` (exported from `@tagea/chat`)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol
