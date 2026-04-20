# Parity: Chat Invite

## Angular

- **Status:** ✅ Implemented (library-backed)
- **Route:** `/chat/invite/:roomId` in `app.routes.ts`
- **Library component:** `InvitePreviewComponent` (exported from `@tagea/chat`)
- **E2E:** chat library tests

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/chat/invite/chat_invite_page.dart` — mounts the Flutter chat widget's invite view with `roomId`.
- **Push-notification deep-link target:** yes — FCM handler for invite notifications routes here.
- **Integration tests:** chat feature tests

## Known Divergences

| Topic                | Angular                                                      | Flutter                                         |
| -------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| Layout               | Library `InvitePreviewComponent` (with or without container) | Shared Flutter chat widget's invite view        |
| Accept/decline flow  | Library-owned RPCs                                           | Same — delegate to the widget                   |
| No `activeRoomGuard` | Intentional (user not yet a member)                          | Mirror — don't add a premature membership check |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
