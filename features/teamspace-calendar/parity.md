# Parity: Teamspace Calendar

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/termine-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-page.component.ts)
- **New booking:** [`termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts)
- **Detail:** [`termine-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-detail.component.ts)
- **Desktop grid:** `@fullcalendar/angular` (month/week/day)
- **Mobile:** `MobileCalendarComponent` (shared with [client-termine](../client-termine/parity.md))
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/teamspace/calendar/calendar_page.dart`
  - `lib/features/teamspace/calendar/termin_new_page.dart`
  - `lib/features/teamspace/calendar/termin_detail_page.dart`
- **Calendar widgets:**
  - `table_calendar` for mobile month picker
  - Custom `ScrollableDayAgenda` for mobile infinite scroll
  - `syncfusion_flutter_calendar` or a custom month/week grid for desktop/tablet
- **Integration tests:** `integration_test/teamspace_calendar_test.dart`

## Known Divergences

| Topic                   | Angular                                      | Flutter                                            |
| ----------------------- | -------------------------------------------- | -------------------------------------------------- |
| Desktop calendar engine | FullCalendar via `@fullcalendar/angular`     | Custom or `syncfusion_flutter_calendar`            |
| Timezone rendering      | Berlin pipes + `AppointmentTimeService`      | `timezone` package with Berlin location            |
| Event click (desktop)   | `MatDialog` → `AppointmentDialogV2Component` | `showDialog` with shared appointment-detail widget |
| Series action dialog    | Angular Material dialog                      | `showDialog` with radio-group scope picker         |
| Mobile calendar         | Shared `MobileCalendarComponent`             | Shared Flutter widget across client + staff        |

## Port Log

| Date       | Who      | What                                                                                                                                                                                      |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                                                                                                                                                              |
| 2026-04-22 | sb       | Spec updated: participant-based visibility (teamspace membership no longer grants visibility); dialog-opener limited to organizers; notification RSVP removed; staff invitation email added |
