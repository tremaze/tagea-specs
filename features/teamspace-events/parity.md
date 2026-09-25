# Parity: Teamspace Events

## Angular

- **Status:** ✅ Implemented (user-facing); verwaltung has missing guard (TODO)
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts)
- **Detail / editor / verwaltung:** `events-detail.component.ts`, `events-editor.component.ts`, `events-verwaltung.component.ts`
- **Registration page:** `pages/teamspace/events-register.component.ts` (route `teamspace/events/:id/anmelden`), wizard `shared/events/registration/**`, eligibility dialog `shared/events/event-eligibility-dialog/`
- **E2E:** `apps/tagea-frontend-e2e/src/tests/teamspaces/events/event-registration-page-ui.spec.ts`, `mobil-mitarbeitende-veranstaltung-anmeldung.spec.ts`

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
| Refresh          | —                                                   | Pull-to-refresh on list and detail, also in the loading / not-found / error states of the detail |
| Cancel after deadline | "Abmelden" offered until the start; non-organizers get a `403` | Hidden after the deadline with a hint; organizer exemption open (Asana "Entscheidungen offen") |
| Offline          | Web service worker `/api/**` freshness cache only   | Not cached; error state + retry, failed refresh keeps shown data |
| RSVP state       | UI updates via service method response              | Same — backend-authoritative              |
| Registration page | Two-column page, sticky event card right           | Single column; event summary card above the step (mobile first) |
| Success button   | Label "Von vorne", but navigates back to the detail | "Zur Veranstaltung" (same navigation)     |
| Eligibility dialog (teamspace) | Opens on `event_participation_rule_violation`; the fixable variant saves via the client-portal endpoint | Explain-only variant (reasons + "Schließen"); code never sent to staff today |
| `series_already_registered` | Generic "Anmeldung fehlgeschlagen." | "Du bist bereits für diese Reihe angemeldet." |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude (WP3) | Endpoints/query/cancel body verified against backend; Flutter list, detail, cancel |
| 2026-09-23 | Claude (WP3 QA) | Deadline rule + organizer exemption corrected against backend; offline documented as not cached |
| 2026-09-25 | Claude (M2-Specs) | Registration flow (`/anmelden`, teamspace one-step wizard, custom fields, CTA/result mapping, eligibility dialog, series mode) specified against backend; Flutter register (WP4) ⏳ |
