# Parity: Appointment Detail

## Angular

- **Status:** ✅ Implemented (full cross-cutting component with 3 modes)
- **Path:** [`apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts)
- **Views:** `AppointmentDetailStaffViewComponent`, `AppointmentDetailClientViewComponent`
- **E2E:** _(to be identified — likely multiple tests across staff + client personas)_

## Flutter

- **Status:** ⏳ Planned
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

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
