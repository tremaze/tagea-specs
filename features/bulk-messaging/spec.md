# Feature: Bulk Messaging

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff tool at `/einrichtung/:institutionId/bulk-messaging` for sending broadcast messages to cohorts of clients, and for managing client inquiries. Tabbed layout with "Outgoing" (broadcasts) and "Incoming" (inquiries) tabs; each tab has status filter + search + creation dialog. The Incoming tab shows a badge with the count of new inquiries.

## User Stories

- As a **staff member** I want to send a broadcast to a cohort of clients, so that I can reach many people at once.
- As a **staff member** I want to see past broadcasts and their delivery status, so that I know what's been communicated.
- As a **staff member** I want to triage open inquiries from clients, so that no request falls through the cracks.

## Acceptance Criteria

### Outgoing tab (broadcasts)

- [ ] **Given** the user opens the Outgoing tab, **When** `ClientMessagesService.getBroadcasts` resolves, **Then** broadcasts render as cards with subject, `recipients_count`, `seen_count`, and status.
- [ ] **Given** the user presses "New broadcast", **When** action fires, **Then** `ClientMessageDialogComponent` opens in `mode: 'bulk'` for recipient selection + content composition.
- [ ] **Given** a broadcast is tapped, **When** the detail dialog opens, **Then** `BroadcastMessageDetailDialogComponent` shows content and per-recipient seen status.
- [ ] **Given** filters (`BroadcastMessageFilters` — `status`, `search`, `page`, `limit`) change, **When** the 300 ms debounce completes (for search) or immediately (for status), **Then** the list reloads from page 1.
- [ ] **Given** the list has more pages, **When** the scroll sentinel intersects the viewport, **Then** the next page is appended via `loadMoreMessages()`.

### Incoming tab (inquiries)

- [ ] **Given** the user opens the Incoming tab, **When** the list resolves, **Then** inquiries (`ClientInquiry[]`) render with subject, status (`ClientInquiryStatus`), and sender name.
- [ ] **Given** an inquiry is tapped, **When** action fires, **Then** `ClientInquiryDialogComponent` opens for the staff response flow (read / reply / close / archive).
- [ ] **Given** filters (`ClientInquiryFilters`) change, **When** the 300 ms debounce completes (for search) or immediately (for status), **Then** the list reloads from page 1.
- [ ] **Given** an inquiry dialog closes, **When** the close callback fires, **Then** the inquiry list and the new-inquiries badge both refresh and `triggerInquiriesRefresh()` is invoked.

### Deep-link support

- [ ] **Given** the URL carries a query param `tab=incoming`, **When** the page loads, **Then** the Incoming tab is pre-selected (`selectedTabIndex = 1`) and the inquiries list is loaded eagerly.

## UI States

| State         | When?           | Rendering                    |
| ------------- | --------------- | ---------------------------- |
| Loading (tab) | Fetching        | Spinner inside tab           |
| Empty (tab)   | No entries      | Empty state + "New" CTA      |
| Populated     | Entries visible | Filter chips + search + list |

## Non-Goals

- **Client-side viewing of these messages** — that's the [client-nachrichten](../client-nachrichten/spec.md) spec.
- **Push sending via external channels** — backend orchestrates delivery; UI only composes + tracks.

## Edge Cases

- **Large cohort broadcasts** — backend dispatches asynchronously; the broadcast row updates `sent_at` and `seen_count` as recipients mark it seen.
- **Inquiry status transitions** — `ClientInquiryStatus` enum uses: `new / read / replied (deprecated) / in_progress / closed / archived` (see [client-nachrichten/contracts.md](../client-nachrichten/contracts.md)). Chip colors must mirror that enum.
- **Broadcast status** — `BroadcastMessageStatus` is `draft | sent | archived`; there is no separate "partial failure" status. The detail dialog surfaces per-recipient seen state instead.

## Permissions & Tenant/Institution

- **Required permission:** `permissionGuard` with `requiredPermission: 'clients.view'`.
- **Feature guard:** `clientMessagesFeatureGuard`.
- **Institution context:** URL param.

## Notifications (Push / In-App)

- Sending a broadcast triggers push notifications to client portal — the send action here is the trigger.
- New inquiry arrivals can trigger staff push notifications (tenant-configurable).

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/bulk-messaging-page/bulk-messaging-page.ts`](../../../apps/tagea-frontend/src/app/pages/bulk-messaging-page/bulk-messaging-page.ts)
- **Route:** `apps/tagea-frontend/src/app/routes/institution.routes.ts` (path `bulk-messaging` under `einrichtung/:institutionId`, guards `permissionGuard` + `clientMessagesFeatureGuard`).
- **Service:** `ClientMessagesService`
- **Models:** `BroadcastMessage`, `BroadcastMessageFilters`, `BroadcastMessageStatus`, `ClientInquiry`, `ClientInquiryFilters`, `ClientInquiryStatus`, `NewInquiriesCountResponse`
- **Dialogs:** `ClientMessageDialogComponent`, `BroadcastMessageDetailDialogComponent`, `ClientInquiryDialogComponent`
- **Backend endpoints:** see [contracts.md](./contracts.md)
