# Contracts: Bulk Messaging

## Service: `ClientMessagesService`

Same service used by [client-nachrichten](../client-nachrichten/contracts.md) on the client side. Staff-facing methods used by `BulkMessagingPageComponent`:

- `getBroadcasts(filters: BroadcastMessageFilters)` — paginated list of broadcasts
- `getInquiries(filters: ClientInquiryFilters)` — paginated list of inquiries
- `getNewInquiriesCount()` — returns `{ new_count: number }` (drives the "Incoming" tab badge)
- `triggerInquiriesRefresh()` — notifies subscribers after staff actions on an inquiry
- Broadcast creation happens via `ClientMessageDialogComponent` (mode `'bulk'`) which internally calls the service
- Inquiry response flow happens via `ClientInquiryDialogComponent`

## Data Models

```ts
// apps/tagea-frontend/src/app/models/client-message.model.ts
export enum BroadcastMessageStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ARCHIVED = 'archived',
}

export interface BroadcastMessage {
  id: string;
  subject: string;
  content: string;
  sender_employee_id: string;
  sender_name: string;
  institution_id: string;
  status: BroadcastMessageStatus;
  sent_at?: Date | null;
  recipients_count: number;
  seen_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface BroadcastMessageFilters {
  status?: BroadcastMessageStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedBroadcastMessages {
  data: BroadcastMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

```ts
// apps/tagea-frontend/src/app/models/client-inquiry.model.ts
// ClientInquiryStatus enum — see client-nachrichten/contracts.md for full definition.

export interface ClientInquiryFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: ClientInquiryStatus;
  sender_client_id?: string;
  initiated_by?: 'client' | 'employee';
  sort_by?: 'created_at' | 'subject' | 'status';
  sort_order?: 'ASC' | 'DESC';
}

export interface NewInquiriesCountResponse {
  new_count: number;
}
```

## Dialogs

- `ClientMessageDialogComponent` — compose a broadcast; opened with `ClientMessageDialogData { mode: 'bulk' }` (recipient picker + editor).
- `BroadcastMessageDetailDialogComponent` — inspect a sent broadcast (per-recipient seen status); opened with `BroadcastMessageDetailDialogData { messageId, messageType: 'broadcast' }`.
- `ClientInquiryDialogComponent` — staff response flow for an inquiry; opened with `{ inquiry }`.
