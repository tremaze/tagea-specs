# Feature: Public Video Join

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Public landing for a video-meeting invite at `/public/video/:token`. Guest users click the link in an email and arrive here: the page validates the token via `GuestBookingService`, shows a pre-join UI for camera/mic preferences, then connects to Jitsi or LiveKit depending on the backend-resolved platform.

## User Stories

- As an **invited guest (no login)** I want to join a video meeting from an email link, so that I can attend my appointment remotely.
- As a **guest** I want to adjust camera / mic before joining, so that I'm not caught on a bad config.

## Acceptance Criteria

- [ ] **Given** the user opens `/public/video/:token?tenantId=...`, **When** `GuestBookingService.getVideoToken(token, tenantId)` validates the token, **Then** token-resolved metadata (`VideoCallToken`) is loaded.
- [ ] **Given** either the `token` path param or the `tenantId` query param is missing, **When** the component initializes, **Then** an error message prompts the user to check the link in their confirmation e-mail (no backend call is made).
- [ ] **Given** validation fails, **When** the error is observed, **Then** the error state renders (localized text + error icon) using `err.error.message` when available.
- [ ] **Given** validation succeeds, **When** pre-join UI shows, **Then** `VideoPreJoinComponent` displays the backend-provided `displayName` and lets the user toggle camera / mic / background-blur (`VideoPreJoinPreferences`).
- [ ] **Given** the user confirms pre-join, **When** the connect action fires, **Then** either `JitsiService` or `LivekitService` is engaged depending on the `provider` (`'JITSI' | 'LIVEKIT'`) returned by the backend.
- [ ] **Given** the provider reports `state() === 'lobby_waiting'`, **When** the view renders, **Then** a lobby waiting screen is shown (moderator must approve).
- [ ] **Given** the provider reports `state() === 'lobby_rejected'`, **When** the view renders, **Then** a rejection screen is shown.
- [ ] **Given** the video connection drops (`state() === 'disconnected'`) after a successful join, **When** the user returns to the page, **Then** a farewell screen renders.

## UI States

| State          | When?                                                   | Rendering                                                                              |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Loading        | Token validation in-flight                              | Spinner + "Video-Termin wird vorbereitet..."                                           |
| Fetch Error    | Token / tenantId missing, or `getVideoToken` fails      | Error icon + "Video-Termin nicht verfügbar" + backend message                          |
| Pre-join       | Token valid, not yet joined                             | `VideoPreJoinComponent` with device toggles (audio / video / blur) + "Jetzt beitreten" |
| Lobby waiting  | Provider state = `lobby_waiting`                        | Spinner + "Der Moderator wurde benachrichtigt."                                        |
| Lobby rejected | Provider state = `lobby_rejected`                       | Block icon + "Ihr Beitritt wurde abgelehnt."                                           |
| Connection err | Provider state = `error`                                | Error icon + "Verbindungsfehler" + provider error                                      |
| In-call        | User joined (fallthrough state)                         | Remote video grid + PiP self-preview + control bar (mic / cam / screen / blur / end)   |
| Ended          | Provider state = `disconnected` after a successful join | Call-end icon + "Termin beendet"                                                       |

## Non-Goals

- **Chat / reactions** — managed by the embedded video provider, not by this page.
- **Recording control** — backend / provider responsibility.

## Edge Cases

- **Token consumed** — once joined, the token may be single-use; returning to the page shows "already joined" or a validation error.
- **Provider fallback** — if Jitsi fails, the user sees a fatal error; there is no UI fallback to LiveKit (provider choice is backend-determined).
- **Browser permissions denied** — `VideoPreJoinComponent` surfaces permission errors; user must grant camera/mic to proceed.

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth, token-gated — backend endpoint is decorated with `@Public()`).
- **Tenant context:** the `tenantId` is passed as a query string parameter (`?tenantId=<uuid>`) alongside the token path param. Both are validated by the backend (`UUID_REGEX` for `tenantId`, `/^[0-9a-f-]{36}$/` for `token`). The frontend refuses to call the backend if either is missing.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/public-video-join/public-video-join.component.ts`](../../../apps/tagea-frontend/src/app/pages/public-video-join/public-video-join.component.ts)
- **Pre-join:** [`apps/tagea-frontend/src/app/components/video-pre-join/video-pre-join.component.ts`](../../../apps/tagea-frontend/src/app/components/video-pre-join/video-pre-join.component.ts)
- **Services:** `GuestBookingService`, `JitsiService`, `LivekitService`
- **Models:** `VideoCallToken`, `VideoPreJoinPrefs` (in `models/jitsi.model.ts`), `VideoPreJoinPreferences` (exported from `video-pre-join.component.ts`)
- **Backend controller:** [`apps/tagea-backend/src/public-api/guest-booking.controller.ts`](../../../apps/tagea-backend/src/public-api/guest-booking.controller.ts)
- **Backend endpoints & contracts:** see [contracts.md](./contracts.md)
