# Parity: AI Chat

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.ts)
- **Template:** [`ai-chat-page.component.html`](../../../apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.html)
- **State service:** [`AiChatStateService`](../../../apps/tagea-frontend/src/app/services/ai-chat-state.service.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/ai_chat/ai_chat_page.dart`
- **Sub-widgets:**
  - `conversation_list_drawer.dart`
  - `message_bubble.dart` (markdown + source chips)
  - `composer.dart` (text + image + document picker)
- **Key packages:**
  - `flutter_markdown` or `markdown_widget` for assistant rendering
  - `dio` with streamed response for SSE (or `flutter_client_sse`)
  - `image_picker` + `file_picker` for attachments
- **State management:** `flutter_bloc` `AiChatBloc` mirroring `AiChatStateService` — event-driven (`MessageSent`, `StreamChunkReceived`, `AttachmentAdded`, `ConversationSwitched`) with a sealed `AiChatState`; injected via `BlocProvider`, consumed via `BlocBuilder`/`BlocListener`
- **Integration tests:** `integration_test/ai_chat_test.dart`

## Known Divergences

| Topic                               | Angular                                     | Flutter                                         |
| ----------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| SSE transport                       | Angular `SseService` (likely `EventSource`) | `dio` streamed response or `flutter_client_sse` |
| State persistence across breakpoint | `AiChatStateService` singleton              | App-scoped `AiChatBloc` via `BlocProvider`      |
| Attachment data transport           | Base64 in JSON body                         | Same — base64 over HTTP                         |
| Markdown rendering                  | `ngx-markdown`                              | `flutter_markdown` / `markdown_widget`          |
| Drawer                              | `MatSidenav`                                | `Drawer` widget in `Scaffold`                   |
| Auto-scroll                         | `AfterViewChecked` + flag                   | `ScrollController.animateTo` in listener        |
| Feature-flag redirect               | Angular router navigation                   | GoRouter redirect in the route                  |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
