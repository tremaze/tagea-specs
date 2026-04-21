# Parity: Gehaltsnachweise

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/gehaltsnachweise/gehaltsnachweise_page.dart`
- **Preview:** shared with [client-dokumente](../client-dokumente/parity.md)
- **Integration tests:** `integration_test/gehaltsnachweise_test.dart`

## Known Divergences

| Topic    | Angular                                           | Flutter                                              |
| -------- | ------------------------------------------------- | ---------------------------------------------------- |
| Grouping | Component-local `MonthGroup[]` computation        | Derived state in the Cubit: compute grouped months and emit via `state.copyWith(groupedByMonth: ...)` (or expose as a computed getter on the state class) |
| Preview  | `MatDialog` with `DocumentPreviewDialogComponent` | Shared Flutter preview widget                        |
| Download | Browser download                                  | Save via `path_provider` + open via `open_file`      |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
