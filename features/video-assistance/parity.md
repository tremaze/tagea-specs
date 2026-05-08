# Parity: Video Assistance

## Angular

- **Status:** ⏳ Not yet implemented
- **Path (planned):**
  - Backend module: `apps/tagea-backend/src/video-assistance/`
  - Client portal page: `apps/tagea-frontend/src/app/pages/client-portal/videoassistance/`
  - Control page: `apps/tagea-frontend/src/app/pages/control/videoassistance/`
- **E2E (planned):** `apps/tagea-frontend-e2e/src/specs/video-assistance/`

## Flutter

- **Status:** ⏳ Not started
- **Path:** `lib/features/video_assistance/` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/video_assistance/`

## Known Divergences

- **Mobile companion (Capacitor) vs. plain web portal.** Both consume the same SSE stream. The Capacitor build can opt into FCM wake-up for `request.assigned` (stretch goal); the plain-web portal cannot.
- **Pre-join camera/mic preview.** Web reuses the existing `public-video-join` lobby; Flutter has its own native camera-preview widget. Behavior parity is verified through the same accept-criteria, not 1:1 widget mapping.
- **Heartbeat survival.** Web uses `navigator.sendBeacon` + Web Worker fallback to survive backgrounded tabs. Native (Capacitor / Flutter) keeps a foreground service / background timer. Same observable effect: `heartbeat_expires_at` is refreshed every 30 s while the user is "present".

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-08 | baumgart | Spec created |
