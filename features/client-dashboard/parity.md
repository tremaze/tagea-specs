# Parity: Client Dashboard

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-portal-dashboard.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-portal-dashboard.component.ts)
- **Template:** [`client-portal-dashboard.component.html`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-portal-dashboard.component.html)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/client_portal/dashboard/`
- **State management:** `flutter_bloc`; one `Cubit` per data source (feed, next appointment, unread counts, pending signatures) to mirror the parallel-load structure. `Cubit` is the default since each data source is a straightforward load-and-display.
- **Infinite scroll:** `ScrollController` with bottom threshold; same per-source pagination state.
- **Read tracking:** `VisibilityDetector` package replaces IntersectionObserver.
- **Integration tests:** `integration_test/client_portal_dashboard_test.dart`

## Known Divergences

| Topic                              | Angular                                                                  | Flutter                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Layout                             | CSS grid with sidebar at `>= 600px`, stacked + bottom sheet at `< 600px` | Responsive `LayoutBuilder`; sidebar is a `SliverSide` or a `ModalBottomSheet` |
| Read tracking                      | IntersectionObserver on DOM                                              | `VisibilityDetector` widget wrapping each card                                |
| Feed card                          | `TageaFeedCardComponent`                                                 | `FeedCard` widget with same metadata shape                                    |
| Bottom sheet                       | `MatBottomSheet`                                                         | `showModalBottomSheet`                                                        |
| Pending-signature offline behavior | —                                                                        | Persist count to local storage so the badge shows offline                     |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
