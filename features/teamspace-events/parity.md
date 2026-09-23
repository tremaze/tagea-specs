# Parity: Teamspace Events

## Angular

- **Status:** ✅ Implemented (user-facing); verwaltung has missing guard (TODO)
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts)
- **Detail / editor / verwaltung:** `events-detail.component.ts`, `events-editor.component.ts`, `events-verwaltung.component.ts`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🚧 List + read-only detail + cancel own registration (WP3); register (WP4), verwaltung/editor pending
- **Paths:**
  - `apps/tagea_frontend/lib/features/teamspace/events/events_page.dart`
  - `apps/tagea_frontend/lib/features/teamspace/events/detail/event_detail_page.dart`
  - `packages/teamspace_core/lib/src/api/events_api.dart`, `cubits/events_list_cubit.dart`, `cubits/event_detail_cubit.dart`
  - `packages/ui/lib/src/feed/tagea_event_card.dart`
- **Integration tests:** `integration_test/teamspace_events_test.dart`

## Known Divergences

| Topic            | Angular                                             | Flutter                                   |
| ---------------- | --------------------------------------------------- | ----------------------------------------- |
| Verwaltung guard | Commented-out TODO                                  | **Enforce from day one**                  |
| Context reload   | Angular `effect()` on `ContextChangeService` signal | `BlocListener<ContextCubit, ContextState>` reacting to context changes |
| Card             | `EventArticleCardComponent`                         | `TageaEventCard` (packages/ui), adds the location row |
| Filtering        | Client-side on loaded pages (search, teamspace, free places) | Server-side (`search`, `teamspace_ids`, `available_spots_only`, `upcoming_only`) so paging stays correct; "Meine Anmeldungen" stays client-side |
| Detail registration | Mobile peek bottom sheet with status          | Inline "Anmeldung" card + pinned "Abmelden" bar |
| Cancel prompt    | `SimplePromptDialog` (optional reason)              | Bottom sheet with optional reason (UX §3) |
| Refresh          | —                                                   | Pull-to-refresh on list and detail        |
| RSVP state       | UI updates via service method response              | Same — backend-authoritative              |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude (WP3) | Endpoints/query/cancel body verified against backend; Flutter list, detail, cancel |
