# Parity: Institution Calendar

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/calendar-page/calendar-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/calendar-page/calendar-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ❌ Non-goal (P2, staff-facing, complex FullCalendar port)

## Known Divergences

| Topic                 | Angular                         | Flutter (if ported)                           |
| --------------------- | ------------------------------- | --------------------------------------------- |
| Calendar engine       | FullCalendar (JS)               | `syncfusion_flutter_calendar` or custom       |
| Working-hours overlay | CSS-rendered background events  | Custom painter layer                          |
| Outlook sync          | `OutlookSyncService` (MS Graph) | `flutter_outlook` or MSAL-based native bridge |
| Drag-drop reschedule  | FullCalendar native             | Custom pan gesture + drop target              |
| Mobile fallback       | `MobileCalendarComponent`       | Shared Flutter mobile calendar widget         |

## Port Log

| Date       | Who      | What                              |
| ---------- | -------- | --------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only) |
