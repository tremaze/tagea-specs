# Parity: Appointment Detail

## Angular

- **Status:** ✅ Implemented (full cross-cutting component with 3 modes)
- **Path:** [`apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts)
- **Views:** `AppointmentDetailStaffViewComponent`, `AppointmentDetailClientViewComponent`
- **E2E:** _(to be identified — likely multiple tests across staff + client personas)_

## Flutter

- **Status:** 🚧 Partial — staff invitee detail with RSVP (`/teamspace/kalender/:id`) and booker overview with cancel (`/teamspace/buchung/:id`) ported; client mode and video join pending.
- **Implemented path:** `apps/tagea_frontend/lib/features/teamspace/calendar/detail/` (one page; booked offers render the booking overview), data layer `AppointmentDetailCubit` in `packages/teamspace_core`.
- **Suggested path:** `lib/features/appointments/detail/appointment_detail_page.dart`
- **Mode enum:** `AppointmentDetailMode { staff, booker, client }`
- **Repository abstraction:** `AppointmentRepository` (abstract class) with `StaffAppointmentRepository` and `ClientAppointmentRepository` concrete impls.
- **View split:** `AppointmentDetailStaffView` + `AppointmentDetailClientView` widgets, chosen by mode.
- **Integration tests:** one test file per mode to avoid combinatorial explosion.

## Known Divergences

| Topic                  | Angular                                                                  | Flutter                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| DI / service injection | `APPOINTMENT_DETAILS_SERVICE` token with two providers                   | Constructor-injected repo into a Cubit/Bloc, provided via `BlocProvider` scoped per route (appointment id and optional slot id passed as constructor parameters) |
| Mode discrimination    | `route.data.mode` string                                                 | `AppointmentDetailMode` enum passed as page argument                                                         |
| Custom fields UI       | `TageaCustomFieldsComponent`                                             | Dynamic form widget — see [client-profile spec](../client-profile/spec.md) for the shared rendering strategy |
| Timezone               | `AppointmentTimeService` + Angular date pipes configured to Berlin       | `timezone` + `intl` packages; render via helper `formatBerlinTime(dt)`                                       |
| Video join             | Angular `VideoSessionService` → likely opens WebRTC in new tab or iframe | Dedicated native video screen using `flutter_webrtc` or an in-app WebView                                    |
| Dialog confirmations   | `MatDialog` + `SimpleConfirmationDialogComponent`                        | `showDialog` + `ConfirmDialog` widget                                                                        |
| Booker cancel form     | `MatDialog` (`AppointmentCancelDialogComponent`), reason optional, confirm always enabled | Bottom sheet; reason required (confirm validates and shows an inline error), remark optional; snackbar error with retry; action disabled offline |
| Booker cancel visibility | Only the own participant row is checked                                | Also hidden when the appointment itself is already cancelled                                                 |
| Calendar tap on a booking | Loads the appointment, then routes bookers to `/teamspace/buchung/:id` | Opens `/teamspace/kalender/:id`; the page renders the booking overview once it knows the caller booked the offer (no second request). `/teamspace/buchung/:id` exists for deep links. |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude (WP2) | Booker mode: cancel own booking (cancel-participation, payload, categories), booker uses the client view |
