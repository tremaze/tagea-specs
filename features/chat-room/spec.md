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
- [ ] **Given** the `activeRoomGuard` (from `@tagea/chat`) runs, **When** the room is not accessible or does not exist, **Then** access is blocked per the guard's logic (library-owned; inspect for exact behavior).
- [ ] **Given** the guard passes, **When** the page renders, **Then** `ChatRoomPageComponent` handles the full room UI (app bar, back navigation, messages, composer).

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
                         CHAT_ROOM_ROUTE → ChatRoomPageComponent
                             │
                             ▼
                         activeRoomGuard (library)
                             │
                             ▼
                         Room renders
```

## Non-Goals

- **Room list** — accessed via `/chat` (see [chat](../chat/spec.md)) or the chat FAB.
- **Invite handling** — `/chat/invite/:roomId` has its own page ([chat-invite](../chat-invite/spec.md)).

## Edge Cases

- **Invalid `roomId`** — `activeRoomGuard` rejects; library determines fallback behavior (typically redirect to `/chat`).
- **User doesn't have permission for the room** — same `activeRoomGuard` outcome.
- **Deep link while unauthenticated** — `AUTH_GUARD` forces login first, and the router preserves the target URL.

## Permissions & Tenant/Institution

- **Required roles:** `permissionGuard` with `requiredPermission: 'chat.access'` + `chatFeatureGuard` at the route level (see `app.routes.ts`).
- **Route-level guard from the chat library:** `activeRoomGuard` — protects against missing/forbidden rooms.
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
- **Chat library component:** `ChatRoomPageComponent` (at `packages/chat/src/lib/components/conversation/chat-room-page.ts`)
- **Guard:** `activeRoomGuard` (chat library)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol — owned by the chat library
