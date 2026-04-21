# Parity: Teamspace Home

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts)
- **Template:** [`teamspace-v2-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.html)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/home/teamspace_home_page.dart`
- **Sub-widgets:** `feed_list.dart`, `teamspace_sidebar.dart`, `teamspace_mobile_sheet.dart`
- **State management:** One `Cubit` per data source (feed, teamspaces, unread counts, appointments, submissions), each composed under a `MultiBlocProvider` at the home route
- **Integration tests:** `integration_test/teamspace_home_test.dart`

## Known Divergences

| Topic              | Angular                                         | Flutter                                                                                                           |
| ------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Layout             | Grid with sidebar desktop; stacked + FAB mobile | `LayoutBuilder` with mobile `ModalBottomSheet`                                                                    |
| Chip badges        | `FilterChip` component                          | `FilterChip` widget with `Badge` overlay                                                                          |
| Auto-mark-as-read  | IntersectionObserver                            | `VisibilityDetector` package                                                                                      |
| Appointment dialog | `MatDialog` with `AppointmentDialogV2Component` | `showDialog` with shared appointment-detail widget (see [appointment-detail spec](../appointment-detail/spec.md)) |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
