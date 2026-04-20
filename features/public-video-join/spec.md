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

- [ ] **Given** the user opens `/public/video/:token`, **When** `GuestBookingService` validates the token, **Then** token-resolved metadata (`VideoCallToken`) is loaded.
- [ ] **Given** validation fails, **When** the error is observed, **Then** the error state renders (localized text + error icon).
- [ ] **Given** validation succeeds, **When** pre-join UI shows, **Then** `VideoPreJoinComponent` lets the user choose display name + camera/mic preferences (`VideoPreJoinPrefs`).
- [ ] **Given** the user confirms pre-join, **When** the connect action fires, **Then** either `JitsiService` or `LivekitService` is engaged depending on the platform indicated by the token.
- [ ] **Given** the video connection drops / the meeting ends, **When** the user returns to the page, **Then** a farewell screen renders.

## UI States

| State    | When?                       | Rendering                                            |
| -------- | --------------------------- | ---------------------------------------------------- |
| Loading  | Token validation in-flight  | Spinner + "Video-Termin wird vorbereitet..."         |
| Error    | Token invalid / expired     | Error icon + message                                 |
| Pre-join | Token valid, not yet joined | `VideoPreJoinComponent` with name + device selection |
| In-call  | User joined                 | Embedded video UI (Jitsi or LiveKit)                 |
| Ended    | Connection closed           | Farewell screen                                      |

## Non-Goals

- **Chat / reactions** — managed by the embedded video provider, not by this page.
- **Recording control** — backend / provider responsibility.

## Edge Cases

- **Token consumed** — once joined, the token may be single-use; returning to the page shows "already joined" or a validation error.
- **Provider fallback** — if Jitsi fails, the user sees a fatal error; there is no UI fallback to LiveKit (provider choice is backend-determined).
- **Browser permissions denied** — `VideoPreJoinComponent` surfaces permission errors; user must grant camera/mic to proceed.

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth, token-gated).
- **Tenant context:** resolved from the token.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/public-video-join/public-video-join.component.ts`](../../../apps/tagea-frontend/src/app/pages/public-video-join/public-video-join.component.ts)
- **Pre-join:** [`apps/tagea-frontend/src/app/components/video-pre-join/video-pre-join.component.ts`](../../../apps/tagea-frontend/src/app/components/video-pre-join/video-pre-join.component.ts)
- **Services:** `GuestBookingService`, `JitsiService`, `LivekitService`
- **Models:** `VideoCallToken`, `VideoPreJoinPrefs`, `VideoPreJoinPreferences`
- **Backend endpoints:** see [contracts.md](./contracts.md)
