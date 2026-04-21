# Contracts: Client Nachrichten

## Service: `ClientMessagesService`

| Method                           | Purpose                                                              |
| -------------------------------- | -------------------------------------------------------------------- |
| `getMyMessages(filters?)`        | Paginated broadcast messages targeted at this client                 |
| `getMyMessage(id)`               | Single broadcast message for the current client                      |
| `markAsRead(id)`                 | Mark a broadcast as read (triggers `read_at` timestamp)              |
| `markAsSeen(id)`                 | Record the "seen" signal (dashboard feed auto-seen behavior)         |
| `getUnreadCount()`               | Unread broadcast count for the dashboard badge                       |
| `getMyInquiries(filters?)`       | Client's own inquiries (paginated)                                   |
| `getMyInquiry(id)`               | Single inquiry (route-based detail)                                  |
| `createInquiry(dto)`             | Create a new inquiry (`CreateClientInquiryDto`)                      |
| `getMyInquiryMessages(id)`       | Paginated messages of an inquiry thread                              |
| `addMyInquiryMessage(id, dto)`   | Append a follow-up message to an inquiry (`CreateInquiryMessageDto`) |
| `getInquiryUnreadRepliesCount()` | Count of inquiries with unread staff replies                         |
| `getManagedClients()`            | Managed clients the user may submit inquiries on behalf of           |

## Backend Endpoints

All client-facing endpoints live on `ClientPortalController` (`@Controller('client-portal')`).

| Method + Path                                          | Purpose                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| `GET    /client-portal/messages`                       | List broadcasts for this client              |
| `GET    /client-portal/messages/unread-count`          | Unread broadcast count                       |
| `GET    /client-portal/messages/:id`                   | Single broadcast                             |
| `PATCH  /client-portal/messages/:id/read`              | Mark broadcast as read                       |
| `POST   /client-portal/messages/:id/seen`              | Mark broadcast as seen                       |
| `POST   /client-portal/messages/:id/acknowledge`       | Acknowledge broadcast (when required)        |
| `POST   /client-portal/inquiries`                      | Create a new inquiry                         |
| `GET    /client-portal/inquiries`                      | List the caller's inquiries                  |
| `GET    /client-portal/inquiries/:id`                  | Single inquiry                               |
| `GET    /client-portal/inquiries/:id/messages`         | Messages in the inquiry thread               |
| `POST   /client-portal/inquiries/:id/messages`         | Append a reply to the inquiry thread         |
| `GET    /client-portal/inquiries/unread-replies-count` | Count of inquiries with unread staff replies |

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/models/client-message.model.ts
interface ClientMessage {
  id: string;
  subject: string;
  content: string; // body/HTML content
  recipient_client_id: string;
  sender_employee_id: string;
  sender_name: string;
  institution_id: string;
  status: ClientMessageStatus;
  sent_at?: Date | null;
  read_at?: Date | null; // authoritative read indicator
  created_at: Date;
  updated_at: Date;
  // Acknowledgement
  requires_acknowledgement?: boolean;
  has_acknowledged?: boolean;
  acknowledged_at?: Date | null;
  // Seen tracking (from entity-tracking, independent of read_at)
  is_seen?: boolean;
}

// Source: apps/tagea-frontend/src/app/models/client-inquiry.model.ts
interface ClientInquiry {
  id: string;
  subject: string;
  content: string; // original question body
  sender_client_id: string;
  sender?: ClientInquirySender;
  submitted_by_client_id?: string | null;
  submitted_by_client?: { id: string; display_name: string } | null;
  institution_id: string;
  status: ClientInquiryStatus;
  initiated_by: 'client' | 'employee';
  initiator_employee_id?: string | null;
  initiator_employee?: ClientInquiryEmployee | null;
  messages?: InquiryMessage[]; // follow-up thread (replaces legacy `reply_message_id`)
  unread_replies_count?: number;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface InquiryMessage {
  id: string;
  inquiry_id: string;
  content: string;
  sender_type: 'client' | 'employee';
  sender: InquiryMessageSender;
  is_read_by_recipient: boolean;
  read_at?: string | null;
  created_at: string;
}

enum ClientInquiryStatus {
  NEW = 'new',
  READ = 'read',
  /** @deprecated — still appears on historical records; map to in_progress for UI grouping */
  REPLIED = 'replied',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}
```

> **Note:** Neither `ClientMessage` nor `ClientInquiry` currently carries an `attachments` field. The inquiry form submits subject + content only; attachments are **not** part of the v1 feature.

## Combined Item Type (UI-only)

```ts
type CombinedItem = { type: 'message'; data: ClientMessage; date: Date } | { type: 'inquiry'; data: ClientInquiry; date: Date };
```

Sorted by `date` descending. For messages `date = sent_at ?? created_at`; for inquiries `date = updated_at ?? created_at`.

## Inquiry Create DTO

```ts
// Source: apps/tagea-frontend/src/app/models/client-inquiry.model.ts
interface CreateClientInquiryDto {
  subject: string;
  content: string;
  // Optional: submit on behalf of a managed client (e.g. legal guardian use case)
  sender_client_id?: string;
}
```

Backend DTO (authoritative): `apps/tagea-backend/src/client-inquiries/dto/create-client-inquiry.dto.ts` — same three fields, `subject` ≤ 255 chars, `content` non-empty.

> **Flutter port note:** No multipart upload required for v1. When attachment support is added, mirror the backend DTO at that time.
