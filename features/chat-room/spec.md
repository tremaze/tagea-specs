# Feature: Chat Room

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-28

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

## Image Caching (Flutter-only)

> **Flutter port note:** Flutter-only behavior. The Angular reference uses the browser's HTTP cache, which is sufficient for its model.

Images displayed in the chat (thumbnails and full-size views) are cached on disk so reopening a room or restarting the app does not re-download or re-decrypt them.

### Behavior

- **Plain (non-E2EE) media:** persisted in the Matrix SDK's shared file cache (sqflite database under the application-support directory), keyed by the `mxc://` URI. Reused across launches on iOS, Android, and Web (IndexedDB-backed).
- **Encrypted (E2EE) media:** *decrypted* bytes are persisted in an app-managed cache at `<applicationCacheDirectory>/encrypted_media/<sha256(mxcUrl, isThumbnail)>`. Stored as plaintext, mobile-only (iOS/Android). Web and desktop fall back to in-memory cache only. The OS-level cache directory (`Library/Caches/` on iOS, `getCacheDir()` on Android) is excluded from iCloud Backup and Android Auto Backup by platform convention, so decrypted bytes do not leak into cloud backups. The OS may evict entries under storage pressure — that is acceptable: an evicted entry is re-downloaded and re-decrypted on next access.
- **In-memory layer:** every successful load also populates a process-lifetime `Map<String, Uint8List>` for instant reuse during scrolling. Cleared when the process exits.

### Acceptance Criteria

- [ ] **Given** a room with E2EE images, **When** the user scrolls through it, **Then** each image is downloaded and decrypted at most once per process — subsequent rebuilds use the in-memory cache.
- [ ] **Given** a room with E2EE images that has been opened once on iOS or Android, **When** the user kills the app and reopens the room, **Then** the images are read from the on-disk encrypted-media cache without a network request and without re-decryption.
- [ ] **Given** the platform is **Web** or a desktop OS, **When** the user reopens a room with E2EE images after a reload, **Then** the images are re-downloaded and re-decrypted (no disk cache for E2EE on these platforms).
- [ ] **Given** any platform, **When** plain (non-E2EE) media is shown, **Then** it is served from the SDK file cache on subsequent loads.

### Threat Model

- The encrypted-media cache stores plaintext on iOS/Android, in the app-sandbox-protected platform cache directory. On unrooted/unjailbroken devices this is inaccessible to other apps. This matches the existing trust assumption made by the Matrix SDK, which already persists decrypted message bodies on-device.
- **Cloud backups:** the cache directory is excluded from iCloud Backup (iOS) and Android Auto Backup by platform convention, so decrypted bytes never leave the device through cloud-backup channels even if the user has those features enabled.
- No at-rest encryption is layered on top in V1. The cache can be wiped via `MxcImage.clearCache()` (which also wipes the on-disk cache) and is not yet wired into logout — see Edge Cases.
- Web is intentionally excluded: IndexedDB is per-origin sandboxed but trivially inspectable via DevTools; the marginal sandbox guarantee is not worth the divergence from the in-memory-only model that has been in production.

### Edge Cases

- **Disk-write failure:** swallowed and logged; the next load falls through to network + decrypt as before.
- **Logout:** cache is *not* cleared automatically in V1. Users wanting to wipe local data must reinstall or use OS-level "clear app data". Wiring `clearCache()` into the logout flow is tracked as a follow-up.
- **Cache size:** unbounded by the app in V1 (matches the SDK's plain-media cache behavior). The OS may evict cache-directory entries under storage pressure on both iOS and Android — semantically aligned with the cache role (a miss falls through to re-download + re-decrypt). An app-level size cap / LRU eviction can be added later without API changes.

## Routing & Layout (Flutter-only)

> **Flutter port note:** Flutter-specific routing behavior. The Angular reference already places `/chat/room/:roomId` outside `secure-main`; the Flutter port closes a parity gap by hoisting the room route above the home shell so the bottom navigation does not constrain it.

### Routes

- **Chat list:** `/chat` — lives inside the home shell's `StatefulShellBranch`, so the bottom-nav (compact) or nav-rail (wide) remains visible.
- **Chat room:** `/chat/:roomId` — declared as a sibling of the home shell's `StatefulShellRoute` under the same outer `ShellRoute`. Activating this route **replaces** the home shell on the outer shell's navigator, so no bottom-nav and no rail are shown while a room is open.
  - Sub-routes `details` and `invite` continue to live under `/chat/:roomId`.
- **URL divergence from Angular:** the Flutter port uses `/chat/:roomId` (Angular uses `/chat/room/:roomId`). Push deep-links and existing in-app links target this Flutter path.

### Adaptive Layout

Single breakpoint at **720 dp** (Material 3 compact / medium boundary).

- **Compact (`< 720 dp`):**
  - `/chat` shows the room list as the body of a scaffold with a hamburger menu and the chat account menu.
  - Tapping a room navigates to `/chat/:roomId` (root navigator). The home shell is hidden behind it; the room view occupies the full screen.
  - Back from `/chat/:roomId` pops to `/chat`. If the user landed via a deep link with no history, back falls back to `context.go('/chat')`.
- **Wide (`≥ 720 dp`):**
  - `/chat` shows a master-detail layout: room list (320 dp) on the left, room detail on the right, separated by a vertical divider.
  - Tapping a room **does not** change the URL — it calls `ChatCubit.loadRoom(roomId)` directly. The detail pane updates in place.
  - Deep-linking directly to `/chat/:roomId` still renders the room fullscreen (same widget as compact). Back returns to `/chat`, where the master-detail view is shown again.

### Acceptance Criteria

- [ ] **Given** the user is on `/chat` on a compact viewport, **When** they tap a room, **Then** the URL becomes `/chat/:roomId` and no bottom-nav / rail is rendered.
- [ ] **Given** the user is on `/chat` on a wide viewport, **When** they tap a room, **Then** the URL stays `/chat` and the right pane shows the selected room.
- [ ] **Given** a cold launch with deep-link `/chat/:roomId` on either viewport, **When** the route activates, **Then** the room renders fullscreen with a back button that returns to `/chat`.
- [ ] **Given** the user is in the fullscreen room on compact and presses back, **When** the route pops, **Then** they land on `/chat` with the chat tab selected in the bottom nav.

### Implementation Notes

- **Shared chat state:** `RoomListCubit`, `ChatCubit`, `TypingCubit`, and `CreateRoomCubit` are mounted **once** above both routes (in an outer `ShellRoute` wrapping the `StatefulShellRoute` and the top-level `/chat/:roomId` route). They subscribe to global Matrix sync streams and cannot be safely instantiated twice.
- **Lazy initialisation:** all four cubits use `BlocProvider(lazy: true, ...)`. They are not instantiated until the user first navigates into chat (or arrives via a deep link). `RoomListCubit`'s `client.onSync.stream` subscription is paid lazily for that reason.
- **Encryption-guard scope:** `MatrixEncryptionSetupGuard` wraps each chat shell individually (not the outer `ShellRoute`). Visiting `/home`, `/calendar`, or `/news` does not trigger crypto setup; only the chat surface does.

## References

- **Route definition:** `apps/tagea-frontend/src/app/app.routes.ts` (`path: 'chat/room/:roomId'`, children: `CHAT_ROOM_ROUTE`)
- **Chat library route constant:** [`packages/chat/src/lib/routes.ts#CHAT_ROOM_ROUTE`](../../../packages/chat/src/lib/routes.ts)
- **Chat library component:** `ChatRoomPageComponent` (at `packages/chat/src/lib/components/conversation/chat-room-page/chat-room-page.component.ts`)
- **Guard:** `activeRoomGuard` (chat library)
- **E2E tests:** chat library tests
- **Backend endpoints:** Matrix protocol — owned by the chat library
