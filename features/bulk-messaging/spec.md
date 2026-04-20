# Feature: Bulk Messaging

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff tool at `/einrichtung/:institutionId/bulk-messaging` for sending broadcast messages to cohorts of clients, and for managing client inquiries. Tabbed layout with "Broadcasts" and "Inquiries" tabs; each tab has filter chips + search + creation dialog.

## User Stories

- As a **staff member** I want to send a broadcast to a cohort of clients, so that I can reach many people at once.
- As a **staff member** I want to see past broadcasts and their delivery status, so that I know what's been communicated.
- As a **staff member** I want to triage open inquiries from clients, so that no request falls through the cracks.

## Acceptance Criteria

### Broadcasts tab

- [ ] **Given** the user opens the Broadcasts tab, **When** `ClientMessagesService` resolves, **Then** broadcasts render as cards with subject, cohort target, sent count, and status.
- [ ] **Given** the user presses "New broadcast", **When** action fires, **Then** `ClientMessageDialogComponent` opens for cohort selection + content composition.
- [ ] **Given** a broadcast is tapped, **When** the detail dialog opens, **Then** `BroadcastMessageDetailDialogComponent` shows content, delivery status per recipient, and acknowledgment counts.
- [ ] **Given** filters (`BroadcastMessageFilters`) change, **When** debounce completes, **Then** the list reloads.

### Inquiries tab

- [ ] **Given** the user opens the Inquiries tab, **When** the list resolves, **Then** inquiries (`ClientInquiry[]`) render with subject, status (`ClientInquiryStatus`), and client name.
- [ ] **Given** an inquiry is tapped, **When** action fires, **Then** `ClientInquiryDialogComponent` opens for the staff response flow (accept / reply / close).
- [ ] **Given** filters (`ClientInquiryFilters`) change, **When** debounce completes, **Then** the list reloads.

### Deep-link support

- [ ] **Given** the URL carries a query param `tab=inquiries`, **When** the page loads, **Then** the Inquiries tab is pre-selected.

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

- **Large cohort broadcasts** — UI should show send-progress; backend dispatches asynchronously.
- **Inquiry status transitions** — `ClientInquiryStatus` enum uses: `new / read / replied (deprecated) / in_progress / closed / archived` (see [client-nachrichten/contracts.md](../client-nachrichten/contracts.md)). Chip colors must mirror that enum.
- **Broadcast delivery failure** — `BroadcastMessageStatus` tracks partial failures; detail dialog surfaces per-recipient.

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
- **Service:** `ClientMessagesService`
- **Models:** `BroadcastMessage`, `BroadcastMessageFilters`, `BroadcastMessageStatus`, `ClientInquiry`, `ClientInquiryFilters`, `ClientInquiryStatus`
- **Dialogs:** `ClientMessageDialogComponent`, `BroadcastMessageDetailDialogComponent`, `ClientInquiryDialogComponent`
- **Backend endpoints:** see [contracts.md](./contracts.md)
