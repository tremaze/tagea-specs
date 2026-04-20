# Parity: Client Chat

## Angular

- **Status:** ✅ Implemented (thin wrapper over `@tagea/chat`)
- **Path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-chat-page.component.ts)
- **E2E:** via chat library tests

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/client_portal/chat/client_chat_page.dart` — wraps whatever shared Flutter chat widget is built (likely `lib/features/chat/` or a dedicated package).
- **Integration tests:** owned by the shared chat feature's tests

## Known Divergences

| Topic                 | Angular                                                  | Flutter                                           |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Chat engine           | `@tagea/chat` TS library (possibly Matrix-based)         | Dart port of the same protocol; separate effort   |
| Safe-area handling    | `CHAT_CONTAINER_CONFIG.defaultSafeArea = 'conversation'` | `SafeArea` widget or context-aware inset handling |
| Feature-flag redirect | Angular `effect()` watching a signal                     | Riverpod `ref.listen` or `BlocListener`           |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
