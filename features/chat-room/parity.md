# Parity: Chat Room

## Angular

- **Status:** ✅ Implemented (library-backed)
- **Route:** `/chat/room/:roomId` in `app.routes.ts`
- **Library component:** `ChatRoomPageComponent` at `packages/chat/src/lib/components/conversation/chat-room-page/chat-room-page.component.ts`
- **Guard:** `activeRoomGuard` at `packages/chat/src/lib/guards/active-room.guard.ts`
- **E2E:** chat library tests

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/chat/room/chat_room_page.dart` — calls into the shared Flutter chat widget with the `roomId` argument.
- **Push-notification deep-link target:** yes — FCM handlers should route chat notifications here.
- **Integration tests:** chat feature tests

## Known Divergences

| Topic             | Angular                                                                                | Flutter                                                      |
| ----------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Layout            | Page component owned by chat lib                                                       | Same — shared widget; Flutter port of `@tagea/chat` owns it  |
| Back navigation   | Library `ChatRoomPageComponent` owns its app bar + back button                         | Same; delegate to the widget                                 |
| `activeRoomGuard` | Angular guard — syncs `roomId` into `ActiveConversationService`; always returns `true` | Stream-driven check inside the widget; router just navigates |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
