# Parity: Teamspace Events

## Angular

- **Status:** ✅ Implemented (user-facing); verwaltung has missing guard (TODO)
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/events-page.component.ts)
- **Detail / editor / verwaltung:** `events-detail.component.ts`, `events-editor.component.ts`, `events-verwaltung.component.ts`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/teamspace/events/events_list_page.dart`
  - `lib/features/teamspace/events/event_detail_page.dart`
  - `lib/features/teamspace/events/event_editor_page.dart`
- **Integration tests:** `integration_test/teamspace_events_test.dart`

## Known Divergences

| Topic            | Angular                                             | Flutter                                   |
| ---------------- | --------------------------------------------------- | ----------------------------------------- |
| Verwaltung guard | Commented-out TODO                                  | **Enforce from day one**                  |
| Context reload   | Angular `effect()` on `ContextChangeService` signal | Riverpod `ref.listen` on context provider |
| Card             | `EventArticleCardComponent`                         | Shared `EventCard` widget                 |
| RSVP state       | UI updates via service method response              | Same — backend-authoritative              |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
