# Parity: Teamspace Appointment RSVP Notifications

## Angular

- **Status:** ⏳ Not yet implemented
- **Path:** No new frontend components. Existing `NotificationCenterComponent` surfaces the new types automatically; only new i18n keys under `apps/tagea-frontend/src/assets/i18n/*.json` are required.
- **E2E:** To be added alongside implementation — extend existing teamspace-appointment E2E to assert organizer receives the notification after a participant RSVPs.

## Flutter

- **Status:** ⏳ Not yet implemented
- **Path:** `lib/features/notifications/...` _(in tagea-flutter repo; reuses existing notification rendering — only new i18n keys required)_
- **Integration tests:** `integration_test/notifications/...`

## Known Divergences

None expected. Both platforms use the same backend payload and the same deep-link route. Push delivery differs per OS but is already handled by the existing gateway.

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-22 | baumgart | Spec created |
