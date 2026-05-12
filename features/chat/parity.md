# Parity: Chat (Staff)

## Angular

- **Status:** ✅ Implemented (thin wrapper)
- **Path:** [`apps/tagea-frontend/src/app/pages/chat/chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/chat/chat-page.component.ts)
- **E2E:** via chat library tests

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/chat/chat_page.dart` — wraps the Flutter chat widget (shared with [client-chat](../client-chat/parity.md)).
- **Integration tests:** owned by the shared chat feature tests

## Known Divergences

| Topic                   | Angular                        | Flutter                                                                                                                                            |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrapper shape           | Thin `<router-outlet>` wrapper | Thin widget embedding the shared chat widget                                                                                                       |
| Feature-flag redirect   | Angular `effect()`             | `BlocListener`                                                                                                                                     |
| Safe-area preset        | `CHAT_CONTAINER_CONFIG` via DI | Widget parameter / provider                                                                                                                        |
| Manual `connect()` call | Commented out; not invoked     | Don't add it on the Flutter side either — defer to the widget lifecycle                                                                            |
| Wide-viewport layout    | `<router-outlet>` only         | Master-detail at `≥ 720 dp`: room list (320 dp) + room detail in the same `/chat` route. Tapping a room calls `ChatCubit.loadRoom` without URL nav |

## Port Log

| Date       | Who      | What                                                              |
| ---------- | -------- | ----------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                                      |
| 2026-04-28 | ltoenjes | Documented Flutter wide-viewport master-detail layout for `/chat` |
