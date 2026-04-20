# Feature: AI Chat (Tagea AI)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff-facing AI chat interface with conversation history, SSE-streamed responses, optional knowledge-base search (RAG), and attachment support (images + documents). A sidebar lists prior conversations; the main pane renders markdown messages with inline source references; inputs accept images ≤ 5 MB and documents (PDF/DOCX) ≤ 20 MB that are indexed asynchronously.

## User Stories

- As a **staff member** I want to chat with Tagea AI, so that I can get quick answers grounded in institution knowledge.
- As a **staff member** I want to upload documents into a conversation, so that the assistant can reason over their content.
- As a **staff member** I want to revisit prior conversations, so that I can continue work without re-sending context.
- As a **staff member using the Knowledge Mode** I want RAG to be forced on, so that replies are always backed by references.

## Acceptance Criteria

### Activation + mode

- [ ] **Given** `TenantFeaturesService.isAiChatEnabled() === false`, **When** the page mounts, **Then** the router navigates to `/`.
- [ ] **Given** `TenantFeaturesService.isKnowledgeModeOnly() === true`, **When** the page mounts, **Then** `useKnowledgeSearch` is forced to `true` and the toggle is hidden.
- [ ] **Given** `isKnowledgeModeOnly() === false`, **When** the page renders, **Then** the knowledge toggle is visible and starts defaulted to `false`.

### Conversation list

- [ ] **Given** the user opens the page, **When** `GET /ai-chat/conversations` resolves, **Then** the sidebar lists conversations with `message_count > 0`, sorted by `updated_at` descending.
- [ ] **Given** the user clicks "Neue Konversation", **When** the action fires, **Then** the UI resets to "new chat" mode — no `conversationId` yet; a conversation is created lazily on first send or first document upload.
- [ ] **Given** the user selects a conversation from the sidebar, **When** `GET /ai-chat/conversations/:id` resolves, **Then** `conversationId`, `messages`, streaming state reset, image/document state clears, and the drawer closes.
- [ ] **Given** the user deletes a conversation, **When** `DELETE /ai-chat/conversations/:id` resolves, **Then** the entry is removed from the sidebar; if the deleted conversation was active, the UI resets to "new chat" state.

### Sending a message

> **Two-step send flow.** The app first uploads the payload to a `prepare` endpoint and receives a `messageId`, then opens an SSE stream keyed by that `messageId`. This keeps large image/document bodies out of the SSE URL.

- [ ] **Given** the user presses Send, **When** the handler fires, **Then** `POST /ai-chat/conversations/:id/messages/prepare` is called with the message content, optional image base64, and the IDs of `readyDocuments`; the response returns `{ messageId }`.
- [ ] **Given** `prepare` resolved, **When** the handler continues, **Then** an SSE connection is opened at `GET /ai-chat/conversations/:id/stream?message_id=<id>&use_knowledge_search=<bool>&access_token=<jwt>&tenant_id=<id>`.
- [ ] **Given** the SSE stream emits `type: 'token'`, **When** each event arrives, **Then** `streamingContent` appends `data.content` and the messages pane auto-scrolls.
- [ ] **Given** the stream emits `type: 'done'`, **When** the event resolves, **Then** `data.full_content` becomes the final assistant message (with a fresh `crypto.randomUUID()` id and `data.sources` attached), `streamingContent` clears, `loading` flips off, and the conversation list reloads so a newly-created conversation appears with its generated title.
- [ ] **Given** the stream emits `type: 'error'`, **When** the event resolves, **Then** `error()` is set to `data.error || 'Ein Fehler ist aufgetreten'`, streaming clears, and loading flips off.
- [ ] **Given** the SSE connection errors with 401 (or the `prepare` call throws 401), **When** the error is caught, **Then** `error()` is set to "Sitzung abgelaufen. Bitte Seite neu laden." so the user knows to reload.
- [ ] **Given** the `StreamData` interface documents `user_message_saved` / `assistant_message_saved` variants, **When** such events arrive, **Then** they are ignored by the current handler (only `token`, `done`, and `error` are acted on). Flutter port should either mirror (ignore) or start consuming them if the backend sends them.

### Attachments: images

- [ ] **Given** the user picks an image file via the file picker, **When** the MIME type is in `ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']`, **Then** it is accepted.
- [ ] **Given** the image is ≤ 5 MB, **When** read via `FileReader`, **Then** the base64 data URI is stored in `selectedImageBase64` for attachment on next send.
- [ ] **Given** the image is > 5 MB, **When** read, **Then** show "Das Bild darf maximal 5MB groß sein."
- [ ] **Given** an image is selected, **When** the user sends or cancels, **Then** the image is cleared after the send completes.

### Attachments: documents

- [ ] **Given** the user picks a PDF or DOCX file ≤ 20 MB, **When** upload starts, **Then** a conversation is ensured (lazy-created if none exists) and `POST /ai-chat/conversations/:id/documents` is called with `{ documentBase64, filename }`.
- [ ] **Given** the upload returns `status: 'processing'`, **When** the response resolves, **Then** the document enters the `pendingDocuments` state and polling begins (every 2s, up to 60 attempts / 2 minutes).
- [ ] **Given** the poll returns `status: 'ready'`, **When** observed, **Then** the document moves to `readyDocuments` and is attached to the next message send.
- [ ] **Given** polling exceeds 60 attempts or returns `status: 'failed'`, **When** the terminal state is observed, **Then** the document's status flips to `failed` with an error message (`'Timeout'` on timeout).

### Mobile sidebar

- [ ] **Given** the viewport is mobile, **When** the hamburger is tapped, **Then** the `MatSidenav` drawer opens and the conversation list is visible.
- [ ] **Given** a conversation is selected, **When** the switch completes, **Then** the drawer closes automatically.

### State persistence across breakpoint

- [ ] **Given** the viewport changes (e.g. orientation), **When** Angular re-creates the component, **Then** `conversationId`, `messages`, and `streamingContent` survive via `AiChatStateService` (service-level signals).

## UI States

| State               | When?                                   | What does the user see?                                                            | A11y notes                                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| New chat            | `conversationId()` is null, no messages | Empty state + composer                                                             | —                                                                              |
| Active conversation | Messages exist                          | Message list + composer; markdown rendering of assistant replies with source chips | Messages live-updating: announce new assistant chunks via `aria-live="polite"` |
| Streaming           | `streamingContent()` has value          | Partial assistant bubble grows as tokens arrive                                    | `aria-live="polite"`                                                           |
| Loading message     | `loading()` is true                     | Send button disabled; inline spinner                                               | `aria-busy`                                                                    |
| Document processing | `pendingDocuments().length > 0`         | Each pending doc shows processing chip with filename                               | —                                                                              |
| Document failed     | Doc `status === 'failed'`               | Red chip with error                                                                | `role="alert"`                                                                 |
| Error               | `error()` has value                     | Error banner                                                                       | `role="alert"`                                                                 |
| Knowledge toggle    | `showKnowledgeToggle()` is true         | Toggle switch above composer                                                       | —                                                                              |

## Flows

### New conversation send

```
User types message (+ optional image / ready docs)
    │
    ▼
click Send
    │
    ▼
POST /ai-chat/conversations/:id/messages/prepare   ← returns { messageId }
    │
    ▼
EventSource GET /ai-chat/conversations/:id/stream?message_id=<id>&...
    │
    ├── type='token'  (n×) → append data.content to streamingContent
    ├── type='done'        → persist assistant message from data.full_content + data.sources
    │                       → clear streamingContent, loading=false
    │                       → reload conversation list (new conv gets its title here)
    └── type='error'       → show error, clear streaming, loading=false
```

> `StreamData` declares `user_message_saved` and `assistant_message_saved` variants but the current handler does not act on them.

### Document upload

```
pick PDF/DOCX
    │
    ▼
ensure conversationId (lazy-create if null)
    │
    ▼
POST /ai-chat/conversations/:id/documents { documentBase64, filename }
    │
    ├── status=ready  → add to readyDocuments
    └── status=processing → poll every 2s up to 60 attempts
                           ├── ready → readyDocuments
                           └── failed / timeout → show error chip
```

## Non-Goals

- **Multi-user conversations** — AI chat is 1:1 with the assistant per user.
- **Voice input** — not implemented.
- **Streaming markdown transforms mid-token** — library renders on complete Markdown blocks; partial token streaming is plain text until `done`.
- **File thumbnails for documents** — only the filename + status are shown.

## Edge Cases

- **Large messages:** very long streaming responses can push the scroll position; auto-scroll uses `shouldScrollToBottom` flag + `AfterViewChecked` to snap back.
- **Switching conversations during streaming:** the `destroy$` subject isn't wired to abort in-flight SSE (verify); the new conversation load may land alongside a still-streaming previous response.
- **Deleting the active conversation:** resets to "new chat" state immediately.
- **Image + documents in the same message:** supported — both attach; assistant can reference both.
- **Knowledge-mode tenants:** documents and RAG coexist; sources may come from both uploaded docs and the knowledge base.
- **Document exceeds server's OCR / extraction limit:** surfaces as `failed` with an error message.

## Permissions & Tenant/Institution

- **Required roles:** `aiChatFeatureGuard` at route level.
- **Tenant feature flags:**
  - `ai_chat` — gates the whole feature (redirect to `/` if off).
  - `knowledge_mode_only` — forces RAG; hides the toggle.
- **Institution context:** resolved server-side per conversation (the backend scopes RAG sources to the user's institution).

## Notifications (Push / In-App)

- Not relevant — AI chat is synchronous streaming; no background-delivered messages.

## i18n Keys

> User-facing strings remain in German. **Several strings are hardcoded** (e.g. `'Tagea AI'`, `'Konversation'`, `'Nur Bilder (…)'`, `'Das Bild darf maximal 5MB groß sein.'`, `'Konversation konnte nicht erstellt werden.'`). Port should normalize all into i18n keys.

## Offline Behavior

**Flutter-specific:**

- Offline: send, upload, and SSE all fail. Show persistent offline banner at the top; composer + send button disabled.
- Cached conversation list visible offline (read-only); switching between them requires online to load messages.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.ts)
- **Template:** [`ai-chat-page.component.html`](../../../apps/tagea-frontend/src/app/pages/ai-chat/ai-chat-page.component.html)
- **State service:** [`AiChatStateService`](../../../apps/tagea-frontend/src/app/services/ai-chat-state.service.ts)
- **SSE service:** [`SseService`](../../../apps/tagea-frontend/src/app/services/sse.service.ts)
- **Tenant features:** `TenantFeaturesService.isAiChatEnabled()`, `.isKnowledgeModeOnly()`
- **Guard:** `aiChatFeatureGuard`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
