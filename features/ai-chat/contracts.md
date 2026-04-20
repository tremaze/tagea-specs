# Contracts: AI Chat (Tagea AI)

## Endpoints

Base path is resolved via `ApiConfigService.getApiUrl(path)`.

| Method      | Path                                                                                                             | Purpose                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`       | `ai-chat/conversations`                                                                                          | List conversations (summary)                                                                     |
| `POST`      | `ai-chat/conversations`                                                                                          | Create a new empty conversation (lazy — only used when a document is uploaded before first send) |
| `GET`       | `ai-chat/conversations/:id`                                                                                      | Load a conversation's full messages                                                              |
| `DELETE`    | `ai-chat/conversations/:id`                                                                                      | Delete a conversation                                                                            |
| `POST`      | `ai-chat/conversations/:id/documents`                                                                            | Upload a document (base64 body)                                                                  |
| `GET`       | `ai-chat/conversations/:id/documents`                                                                            | Poll document status                                                                             |
| `POST`      | `ai-chat/conversations/:id/messages/prepare`                                                                     | Prepare a message — uploads content + image base64 + document IDs; returns `{ messageId }`       |
| `GET` (SSE) | `ai-chat/conversations/:id/stream?message_id=<id>&use_knowledge_search=<bool>&access_token=<jwt>&tenant_id=<id>` | Open an SSE stream keyed by the prepared `messageId`; emits `StreamData` events                  |

> The send flow is **two-step**: `prepare` uploads the payload (including large image base64) via a normal POST, then `stream` runs over SSE where URL-size constraints prevent inline attachments. The `access_token` and `tenant_id` travel in the query string because `EventSource` cannot set headers.

## Data Models

```ts
// Component-local (source: ai-chat-page.component.ts)
interface StreamData {
  type: 'token' | 'done' | 'error' | 'user_message_saved' | 'assistant_message_saved';
  content?: string;
  full_content?: string;
  error?: string;
  message_id?: string;
  token_count?: number;
  sources?: SourceReference[];
}

interface ConversationResponse {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ConversationDetail extends ConversationResponse {
  messages: MessageResponse[];
  system_prompt: string | null;
}

interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_data: string | null;
  image_mime_type: string | null;
  created_at: string;
  documents?: MessageDocumentResponse[];
  sources?: SourceReference[];
}

interface MessageDocumentResponse {
  id: string;
  filename: string;
  mime_type: string;
}

interface DocumentResponse {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  status: 'processing' | 'ready' | 'failed';
  error_message: string | null;
  created_at: string;
}
```

`ChatMessage` (in-memory, post-mapping) and `SourceReference` live in [`ai-chat-state.service.ts`](../../../apps/tagea-frontend/src/app/services/ai-chat-state.service.ts).

## File Limits

```ts
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
```

## Document Polling

```ts
// From ai-chat-page.component.ts
const maxAttempts = 60; // 2 min total
// Polls GET ai-chat/conversations/:id/documents every 2000ms
// Stops when status !== 'processing', or on timeout.
```

## Tenant Feature Flags

- `isAiChatEnabled()` — hard gate; false → redirect to `/`.
- `isKnowledgeModeOnly()` — forces `useKnowledgeSearch = true` and hides the toggle.

## SSE

Uses a shared `SseService.createEventSource<StreamData>(url, { preventReconnect: true })`. Each send opens a stream that emits `StreamData` events with progressive token assembly.

### Events currently consumed by the component

| Event type | Handling                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------- |
| `token`    | Append `data.content` to `streamingContent`                                                                    |
| `done`     | Persist assistant message from `data.full_content` + `data.sources`; clear streaming; reload conversation list |
| `error`    | Show `data.error                                                                                               |     | 'Ein Fehler ist aufgetreten'`; clear streaming |

### Events declared in `StreamData` but not consumed

`user_message_saved` and `assistant_message_saved` are part of the declared union but the current handler's switch does not branch on them. Treat as a future/contract hint but do not rely on them for UI state.

> **Flutter port note:** use `flutter_client_sse` or `dio` with `ResponseType.stream`. Keep the consumed event names (`token`, `done`, `error`) verbatim to preserve backend compatibility. Preserve the `?message_id=...&access_token=...` query-param auth pattern since native SSE clients also cannot set headers on the GET.
