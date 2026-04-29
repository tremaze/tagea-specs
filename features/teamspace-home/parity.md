# Parity: Teamspace Home

## Angular (Capacitor / Web)

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts) (~931 LoC; refactor candidate but behaviorally authoritative)
- **Template:** [`teamspace-v2-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.html)
- **Components:** `tagea-page-header`, `tagea-filter-chips` (+ `tagea-filter-chip`), `tagea-feed-card` (~660 LoC), `tagea-sidebar-card`, `tagea-appointment-card`, `tagea-quick-links`, `tagea-submission-item`, `teamspace-mobile-sheet`
- **E2E:** archived under `apps/tagea-frontend-e2e/.archive/2026-04-22-rebuild/tests/feed-teamspace.spec.ts`
- **Known issues to NOT replicate:**
  - Mobile bottom-sheet has 7 hardcoded German strings (Slang/Transloco bypass) — Flutter port uses i18n keys end-to-end.
  - `onQuickLinkClick` switch still has a dead `case 'teamspaces':` branch from the removed quick-link entry — Flutter port omits.

## Flutter

- **Status:** 🚧 Port-prep — spec drift fixed (2026-04-29). PR-1 merges spec into the Flutter repo. PR-2..PR-5 implement the port.
- **Suggested path:** `apps/tagea_frontend/lib/features/teamspace/home/teamspace_home_page.dart`
- **Sub-widgets / files:**
  - `view/feed_view.dart` — filter chips + feed list + read divider + infinite-scroll trigger
  - `view/sidebar_view.dart` — desktop sidebar (4 cards)
  - `view/mobile_sheet.dart` — bottom-sheet variant of the sidebar
  - `widgets/read_status_divider.dart`
  - `widgets/infinite_scroll_trigger.dart` (`VisibilityDetector`)
  - `mappers/feed_card_mapper.dart`, `mappers/next_appointment_mapper.dart`, `mappers/submission_item_mapper.dart`
- **Domain layer:** new `packages/teamspace_core/` with models, APIs, and one cubit per data source under `MultiBlocProvider` at the home route:
  - `FeedCubit`, `TeamspacesCubit`, `UnreadCountCubit`, `NextAppointmentCubit`, `RecentSubmissionsCubit`, `ExternalContentsCubit`, `ReadStatusCubit` (debounced bulk-flush, error-rollback)
- **UI primitives go to `packages/ui/`:** `TageaPageHeader`, `TageaFilterChips`, `TageaSidebarCard`, `TageaQuickLinks`, `TageaStatusBadge`, `TageaSubmissionItem`, `TageaAppointmentCard`, `TageaFeedCard`. Each with a Widgetbook use-case + golden test.
- **Auth-image provider:** new in `packages/ui/` (or `packages/auth_image/` if it grows). Two-tier cache (memory LRU + `flutter_cache_manager` disk), key includes user id, evicted on logout.
- **Integration tests:** `integration_test/teamspace_home_test.dart` mirroring the archived `feed-teamspace.spec.ts` (filter chips, unread badges, read-status divider, infinite scroll, chip switching).

## Known Divergences (Flutter ↔ Angular)

| Topic                  | Angular                                          | Flutter                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile breakpoint      | `max-width: 599px` (single CSS media query)      | `< 720dp` (Material 3 compact window class). **Rationale:** the Tagea Flutter shell already uses 720dp for its bottom-nav ↔ navigation-rail switch (`home_shell.dart`). Aligning the sidebar drop on the same threshold avoids a UX seam where the sidebar disappears at 599 but the rail re-appears only at 720.                                                                       |
| Layout                 | CSS grid with sticky sidebar                     | `LayoutBuilder` with `Row(feed, sidebar)` ≥720dp; below 720dp, single column + FAB → `showModalBottomSheet`                                                                                                                                                                                                                                                                            |
| Filter chips           | Custom `tagea-filter-chip` (CSS button)          | `TageaFilterChips` wrapping Material 3 `FilterChip` with a `Badge` overlay                                                                                                                                                                                                                                                                                                              |
| Auto-mark-as-read      | `IntersectionObserver` (50% threshold)           | `VisibilityDetector` package with `visibleFraction >= 0.5`                                                                                                                                                                                                                                                                                                                              |
| Read-status flush      | RxJS `debounceTime(500)`                         | `Stream.debounce(Duration(milliseconds: 500))` (rxdart) — same protocol, same error-rollback                                                                                                                                                                                                                                                                                            |
| Appointment dialog     | `MatDialog` (`AppointmentDialogV2Component`)     | `showDialog` rendering the shared appointment-detail widget (see [appointment-detail spec](../appointment-detail/spec.md))                                                                                                                                                                                                                                                            |
| External link opening  | `window.open(url, '_blank', 'noopener,noreferrer')` | `url_launcher` with `LaunchMode.externalApplication` (avoids in-app browser; matches Angular's external-tab semantics)                                                                                                                                                                                                                                                              |
| Image loading          | `SecureImageService` (custom blob cache)         | Authenticated `ImageProvider` + `flutter_cache_manager` disk cache. Headers (`Authorization`, `X-Tenant-ID`) injected per request.                                                                                                                                                                                                                                                       |
| HTML excerpt rendering | Angular `[innerHTML]` + `HtmlSanitizerService`   | Backend already strips most HTML in `getExcerpt(content, 350)`. For residual tags, prefer plain `Text` (server-stripped). If we hit unstripped data, use `flutter_html` or a small allow-list stripper. **No raw HTML rendering** without sanitisation.                                                                                                                                |
| Spinner widget         | `mat-spinner`                                    | `CircularProgressIndicator` from `packages/ui` (`TageaCircularProgressIndicator`)                                                                                                                                                                                                                                                                                                       |
| FAB                    | `mat-fab` rendered via `mobileFabOutlet` directive | Standard `FloatingActionButton` placed by `Scaffold.floatingActionButton`                                                                                                                                                                                                                                                                                                            |
| Mobile-sheet i18n      | Hardcoded German                                 | All strings via Slang keys (parity bug fix)                                                                                                                                                                                                                                                                                                                                             |

## Out of Port Scope (deliberate)

- `appointmentToFeedCard` mapper exists in Capacitor but is **not** used by the teamspace-home feed (only by the client-portal). Flutter v1 does not port it; it'll arrive with the client-portal feature.
- `clientMessageToFeedCard` mapper — same reasoning, client-portal only.
- The dead `case 'teamspaces':` quick-link branch in `onQuickLinkClick`.

## Port Log

| Date       | Who      | What                                                                                                                                                                                                              |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                                                                                                                                                                                      |
| 2026-04-29 | sven     | Port-prep: drift fixed (`hasAdminOrRedakteurRole` removal, "appointments are not feed cards", Capacitor mobile-sheet German bug noted). Spec gaps closed: read-status threshold + bulk-flush, pagination semantics, image-auth contract, quick-link routing table, status-mapping table, content-type wire mapping, full i18n key list. Mobile breakpoint divergence (599px → 720dp) documented with rationale. |
