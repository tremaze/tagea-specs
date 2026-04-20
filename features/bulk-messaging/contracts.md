# Contracts: Bulk Messaging

## Service: `ClientMessagesService`

Same service used by [client-nachrichten](../client-nachrichten/contracts.md) on the client side. Staff-facing methods (indicative — verify signatures in the service file):

- List broadcasts with `BroadcastMessageFilters`
- Create broadcast (cohort targeting + content)
- List inquiries with `ClientInquiryFilters`
- Respond to inquiry / transition status

## Data Models

```ts
// apps/tagea-frontend/src/app/models/client-message.model.ts
interface BroadcastMessage {
  id: string;
  subject: string;
  content: string;
  sent_at: string;
  // + status, cohort, recipient counts, acknowledgment tracking
}

interface BroadcastMessageFilters {
  status?: BroadcastMessageStatus;
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

type BroadcastMessageStatus =
  | 'draft'
  | 'sending'
  | 'sent'
  | 'partial_failure'
  | /* verify */;

// apps/tagea-frontend/src/app/models/client-inquiry.model.ts
// Full enum: see client-nachrichten/contracts.md
interface ClientInquiryFilters {
  status?: ClientInquiryStatus;
  // + other filter fields
}
```

## Dialogs

- `ClientMessageDialogComponent` — compose a broadcast (cohort picker + editor)
- `BroadcastMessageDetailDialogComponent` — inspect a sent broadcast (per-recipient status)
- `ClientInquiryDialogComponent` — staff response to an inquiry
