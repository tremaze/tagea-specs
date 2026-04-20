# Contracts: Client Nachrichten

## Service: `ClientMessagesService`

| Method                                    | Purpose                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `getMyMessages({ limit, page })`          | Paginated broadcast messages targeted at this client     |
| `getMessageById(id)`                      | Single broadcast message                                 |
| `markAsSeen(id)`                          | Mark a broadcast as read                                 |
| `getMyInquiries()` / `getInquiryById(id)` | Client's own inquiries                                   |
| `createInquiry(payload)`                  | New inquiry with optional attachments                    |
| `replyToInquiry(id, message)`             | Add a follow-up to an open inquiry (verify availability) |

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/models/client-message.model.ts
interface ClientMessage {
  id: string;
  subject: string;
  content: string; // body text
  sender_name?: string;
  attachments?: Attachment[];
  read_at?: Date | null; // authoritative read indicator
  requires_acknowledgement: boolean;
  has_acknowledged: boolean;
  published_at: string; // ISO
  // + additional metadata
}

// Source: apps/tagea-frontend/src/app/models/client-inquiry.model.ts
interface ClientInquiry {
  id: string;
  subject: string;
  body: string;
  status: ClientInquiryStatus;
  replies: InquiryReply[];
  attachments?: Attachment[];
  created_at: string;
  updated_at: string;
}

enum ClientInquiryStatus {
  NEW = 'new',
  READ = 'read',
  REPLIED = 'replied', // deprecated — kept for historical records
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}
```

## Combined Item Type (UI-only)

```ts
type CombinedItem = { type: 'message'; data: ClientMessage; date: Date } | { type: 'inquiry'; data: ClientInquiry; date: Date };
```

Sorted by `date` descending.

## Inquiry Form Payload

> **Documentation shape.** `ClientInquiryFormComponent` passes individual FormControl values to `ClientMessagesService.createInquiry(...)` — there is no named DTO interface in the source. Document the expected fields so the Flutter port has a clear target.

```ts
// Documentation shape only. Mirror this in Flutter with a real data class.
interface CreateInquiryInput {
  subject: string;
  body: string;
  category?: string;
  attachments?: File[]; // multipart/form-data
}
```

> **Flutter port note:** Multipart upload via `dio`; use `file_picker` for attachment selection. Track send progress for UX.
