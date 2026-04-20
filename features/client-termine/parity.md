# Parity: Client Termine

## Angular

- **Status:** ✅ Implemented
- **List path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-termine-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-termine-page.component.ts)
- **Booking path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-termine-neu.component.ts)
- **Detail:** reuses `AppointmentDetailComponent` at `/client-portal/termine/:id` (mode: `client`)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/client_portal/termine/termine_page.dart` (list)
  - `lib/features/client_portal/termine/booking/booking_flow.dart` (wizard, multi-step with page view)
  - Detail reuses the shared appointment-detail widget (see [appointment-detail/parity.md](../appointment-detail/parity.md))
- **Mobile calendar:** `table_calendar` or custom scroll view that mirrors `MobileCalendarComponent`.
- **Infinite scroll:** `ScrollController` with bottom threshold + visibility-detector for sentinel.
- **Integration tests:** `integration_test/client_termine_test.dart`

## Known Divergences

| Topic                 | Angular                                                   | Flutter                                                                           |
| --------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Sidebar layout        | CSS grid 300px + 1fr on desktop, single column on mobile  | `LayoutBuilder` with desktop/mobile split; sidebar collapses into mobile calendar |
| Filter chip selection | single-select                                             | single-select (same behavior)                                                     |
| Week filter UX        | desktop-only (from sidebar mini-calendar)                 | mobile calendar already provides date scope; no extra week-filter chip needed     |
| Booking wizard        | Single-page multi-step with expansion panels              | `Stepper` widget or `PageView`-based multi-step                                   |
| File upload           | Web `<input type="file">`                                 | `image_picker` / `file_picker` packages                                           |
| Cancelled detection   | Footer metadata icon `event_busy` (implementation detail) | Use canonical `status === 'cancelled'` instead; cleaner contract                  |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
