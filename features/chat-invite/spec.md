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
- [ ] **Given** `InvitePreviewComponent` renders, **When** the invitation is resolved, **Then** preview content (room name, description, inviter) and accept/decline actions are shown (library-owned UI).
- [ ] **Given** the user accepts, **When** the library completes the join, **Then** typical handling transitions to `/chat/room/:roomId` (library-owned navigation — verify).
- [ ] **Given** the user declines, **When** the library completes the reject, **Then** the user is returned to a sensible destination (library-owned — verify, likely `/chat` or `/`).

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
                   /chat/room/:roomId   (library-determined exit)
```

## Non-Goals

- **Group invite UI** (sending invitations to multiple users) — handled inside `ChatContainerComponent`; this page is for receiving/acting on a single invite.
- **Room creation** — separate library flow.

## Edge Cases

- **Invite already accepted elsewhere** — library detects and typically redirects to the room.
- **Invite revoked/expired** — library shows an explanation; verify exact behavior against `InvitePreviewComponent`.
- **User was never invited to the room** — permission/invite check fails; library handles.
- **Deep link while unauthenticated** — `AUTH_GUARD` forces login first, then re-targets the invite URL.

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
