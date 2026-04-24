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

## Message Drafts (Flutter-only)

> **Flutter port note:** Drafts are a Flutter-only enhancement — no Angular equivalent exists.

The composer persists unsent work per room so that closing the room, backgrounding the app, or force-quitting does not lose context.

### Behavior

- **What is persisted:** composer text, reply-to target event ID, edit-target event ID. Works the same on iOS, Android, and Web (Hive-on-IndexedDB for web).
- **What is NOT persisted (Phase 1):** staged file attachments. The current file picker loads files as bytes in memory and does not expose a stable on-disk path, so attachments are lost on room close. Persisting attachments is tracked as a follow-up.
- **When saved:** 500 ms after the last composer change (debounced), and immediately on `AppLifecycleState.paused` and when navigating away from the room.
- **When deleted:** when the composer becomes empty (no text, no reply, no edit), and after a successful send.
- **When restored:** on `loadRoom(roomId)` the composer is hydrated from the saved draft, if any.
- **Stale reply/edit targets:** if the referenced event is no longer retrievable (redacted, paginated out, room cleared), the reply/edit state is cleared on restore but other fields survive.

### Per-User Scoping

Drafts are stored in a Hive box keyed by the current Matrix user ID. On login, the repo asserts ownership: if a different user owns the existing box, it is wiped before use. On logout, the draft store is cleared. This prevents any cross-account leakage on shared devices.

### Room List Preview

When a room has a non-empty draft, the room-list tile subtitle renders `<localized "Draft:"> <first line of draft text>` using the primary accent color, overriding the attachment preview / last-message preview. If the draft text is empty but files / reply / edit state exist, the tile falls back to showing the last message.

### Acceptance Criteria

- [ ] **Given** I type text in the composer and leave the room, **When** I re-enter the room, **Then** my text is restored into the composer.
- [ ] **Given** I have unsent text and backgrounded the app, **When** I kill and relaunch the app, **Then** my text is restored into the composer on re-entry.
- [ ] **Given** I have a draft and send the message, **When** the send succeeds, **Then** the draft is cleared.
- [ ] **Given** I log out as user A and a new user B logs in, **When** user B opens any room, **Then** no drafts from user A are visible.
- [ ] **Given** a room has a non-empty draft, **When** I view the room list, **Then** the subtitle shows `Draft: <text>` / `Entwurf: <text>` in accent color, overriding any attachment / last-message preview.

### Edge Cases

- **Multiple devices (same user):** drafts are local to the device; no Matrix-sync. A draft written on device A is not visible on device B.
- **Encryption:** drafts live on-device only; no network transfer, so Matrix encryption does not apply. The Hive box is not separately encrypted — drafts have the same protection as any other app-local data.

## References

- **Route definition:** `apps/tagea-frontend/src/app/app.routes.ts` (`path: 'chat/room/:roomId'`, children: `CHAT_ROOM_ROUTE`)
- **Chat library route constant:** [`packages/chat/src/lib/routes.ts#CHAT_ROOM_ROUTE`](../../../packages/chat/src/lib/routes.ts)
- **Chat library component:** `ChatRoomPageComponent` (at `packages/chat/src/lib/components/conversation/chat-room-page/chat-room-page.component.ts`)
- **Guard:** `activeRoomGuard` (chat library)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol — owned by the chat library
