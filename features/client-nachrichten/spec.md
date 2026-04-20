# Feature: Client Nachrichten

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

A combined inbox for clients: broadcast messages from the institution and inquiries the client raised with staff. Client can filter by type, start a new inquiry, and open either kind in its own detail view.

## User Stories

- As a **client** I want to see messages from my institution and my own inquiries in one list, so that I have a single place for all written communication.
- As a **client with a question or request** I want to start a new inquiry, so that I can reach staff without phone calls.
- As a **client** I want to see the status of my inquiries (new / read / in_progress / closed / archived), so that I know whether I can expect a reply.

## Acceptance Criteria

### Combined List (`/client-portal/nachrichten`)

- [ ] **Given** the page loads, **When** fetches complete, **Then** broadcast messages and inquiries are merged into one list, sorted by date descending.
- [ ] **Given** the list is non-empty, **When** filter chips render, **Then** three chips are shown: **"All"**, **"Pending acknowledgement"** (count badge of messages where `requires_acknowledgement && !has_acknowledged`), and **"My inquiries"** (count badge of inquiries with unread staff replies).
- [ ] **Given** the user taps a broadcast message, **When** navigation resolves, **Then** open `/client-portal/nachrichten/:id` (broadcast detail route).
- [ ] **Given** the user taps an inquiry, **When** the tap fires, **Then** `ClientInquiryViewDialogComponent` opens as a `MatDialog` (no route navigation; the inquiry detail is a dialog, not a separate page).
- [ ] **Given** the user presses "New inquiry" (desktop header button or mobile FAB), **When** the dialog/sheet opens, **Then** they can fill and submit the `ClientInquiryFormComponent`.
- [ ] **Given** a new inquiry is submitted, **When** the API accepts it, **Then** close the dialog, prepend the inquiry to the list, show a success snackbar.
- [ ] **Given** the user is on mobile, **When** "New inquiry" is activated, **Then** the inquiry form opens in a full-screen layout suitable for small screens.

### Broadcast Detail (`/client-portal/nachrichten/:id`)

- [ ] **Given** the detail loads, **When** it renders, **Then** the broadcast body + sender + date + attachments (if any) are shown read-only.
- [ ] **Given** the detail opens from an unread message, **When** the view renders, **Then** the message is marked as seen (`ClientMessagesService.markAsSeen(id)`).

### Inquiry Detail (Dialog — `ClientInquiryViewDialogComponent`)

> An inquiry detail route (`/client-portal/nachrichten/anfrage/:id`) exists in `client-portal.routes.ts` but the list page opens the inquiry as a **dialog in place**. Both surfaces should render the same content; the list's preferred entry is the dialog.

- [ ] **Given** the inquiry dialog opens, **When** it renders, **Then** the original question, any staff replies, current status, and supporting attachments are shown.
- [ ] **Given** an inquiry is `new` / `read` / `replied` / `in_progress`, **When** the client has a follow-up, **Then** they can post an additional message (subject to backend support — verify). Note: `replied` is deprecated but still appears on historical records — the Flutter port must handle it in the follow-up-allowed set.
- [ ] **Given** the user navigates directly to `/client-portal/nachrichten/anfrage/:id`, **When** the detail route loads, **Then** the same content is rendered via `ClientInquiryDetailComponent` (route-based fallback).

## UI States

| State     | When?                     | What does the user see?                | A11y notes      |
| --------- | ------------------------- | -------------------------------------- | --------------- |
| Loading   | During fetch              | Spinner + label                        | `role="status"` |
| Empty     | No items + no inquiry yet | Empty illustration + "New inquiry" CTA | —               |
| Populated | Any items                 | Filter chips + item cards              | —               |
| Error     | Fetch fail                | Error block                            | `role="alert"`  |

## Non-Goals

- **Real-time message delivery** — broadcasts and inquiries are pulled on page load; no WebSocket subscriptions (that's the separate Chat feature).
- **Archiving** messages — not implemented.
- **Bulk actions** (mark all read, delete) — not implemented.

## Edge Cases

- **Only broadcasts, no inquiries:** Inquiries filter chip still shown but selecting it yields empty state.
- **Inquiry attachments:** submitted via the inquiry form; size/type limits enforced by backend.
- **Type discrimination:** items are a union `{ type: 'message'; data: ClientMessage } | { type: 'inquiry'; data: ClientInquiry }`; navigation + rendering branches on `type`.
- **Unread counts:** driven by `ClientMessagesService.getUnreadCount()` (or similar) — same source as dashboard badge.

## Permissions & Tenant/Institution

- **Required roles:** Client (via `clientPortalGuard`).
- **Tenant feature flag:** `client_messages` — if disabled, the entire route is blocked by `clientMessagesFeatureGuard` at the parent.
- **Institution context:** server-resolved.

## Notifications (Push / In-App)

- New broadcast → increments dashboard "Messages" badge; push notification deep-links to `/client-portal/nachrichten/:id`.
- Staff reply to inquiry → push notification deep-links to `/client-portal/nachrichten/anfrage/:id`.
- Auto-mark-as-seen fires on dashboard feed; list view also marks items read when opened.

## i18n Keys

> User-facing strings remain in German.

- `clientPortal.messages.title`, `.subtitle`, `.helpTooltip`
- `clientPortal.messages.states.{loading,empty,emptyText}`
- `clientPortal.inquiry.newInquiry`
- filter chip labels (verify in template)

## Offline Behavior

**Flutter-specific:**

- Cached list offline; submitting a new inquiry requires online (or queue + flush — decide during port).
- Attachments can be prepared offline but uploaded on reconnect.

## References

- **Angular implementation (list):** [`apps/tagea-frontend/src/app/pages/client-portal/client-messages-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-messages-page.component.ts)
- **Broadcast detail:** [`client-message-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-message-detail.component.ts)
- **Inquiry detail:** [`client-inquiry-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-inquiry-detail.component.ts)
- **Inquiry form:** `ClientInquiryFormComponent`, `ClientInquiryViewDialogComponent`
- **Service:** `ClientMessagesService`
- **Models:** `ClientMessage`, `ClientInquiry`, `ClientInquiryStatus`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
