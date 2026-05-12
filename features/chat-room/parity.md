# Parity: Chat Room

## Angular

- **Status:** ✅ Implemented (library-backed)
- **Route:** `/chat/room/:roomId` in `app.routes.ts`
- **Library component:** `ChatRoomPageComponent` at `packages/chat/src/lib/components/conversation/chat-room-page/chat-room-page.component.ts`
- **Guard:** `activeRoomGuard` at `packages/chat/src/lib/guards/active-room.guard.ts`
- **E2E:** chat library tests

## Flutter

- **Status:** 🚧 In progress — fullscreen-routing parity fix planned
- **Route:** `/chat/:roomId` — declared as a sibling of the home shell's `StatefulShellRoute`, so activating it replaces the home shell. Diverges from Angular's `/chat/room/:roomId` URL shape.
- **Implementation:** `apps/tagea_frontend/lib/home/tabs/room_fullscreen_shell.dart` (planned) wraps `MatrixChatView` from `packages/matrix_chat`
- **Push-notification deep-link target:** yes — FCM handlers route chat notifications to `/chat/:roomId`
- **Integration tests:** chat feature tests

## Known Divergences

| Topic             | Angular                                                                                | Flutter                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| URL shape         | `/chat/room/:roomId`                                                                   | `/chat/:roomId` — flatter; no `room/` segment                                                                                    |
| Layout            | Page component owned by chat lib; always fullscreen                                    | Compact: fullscreen above home shell. Wide: same fullscreen for deep-links; in-app room selection stays in `/chat` master-detail |
| Back navigation   | Library `ChatRoomPageComponent` owns its app bar + back button                         | App-side `RoomFullscreenShell` owns the app bar + back button; pops to `/chat`                                                   |
| `activeRoomGuard` | Angular guard — syncs `roomId` into `ActiveConversationService`; always returns `true` | URL `roomId` synced into `ChatCubit.loadRoom` / `TypingCubit.loadRoom` from the route widget; no router-level guard              |

## Port Log

| Date       | Who      | What                                                                                                            |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                                                                                    |
| 2026-04-28 | ltoenjes | Documented Flutter routing/layout: room hoisted to root navigator for compact fullscreen; wide stays master-detail |
