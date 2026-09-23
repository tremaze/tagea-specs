# Parity: Gehaltsnachweise

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🚧 In review — [tagea-next-flutter#68](https://github.com/tremaze/tagea-next-flutter/pull/68)
- **Path:** `apps/tagea_frontend/lib/features/teamspace/payslips/` (list `payslips_page.dart`, preview `preview/payslip_preview_page.dart`)
- **Domain:** `packages/teamspace_core` (`PayslipsApi`, `PayslipsCubit`, `PayslipPreviewCubit`)
- **Preview:** `TageaPdfViewer` in `packages/tagea_media` (pdfrx, renders from memory on iOS, Android and web)
- **Tests:** widget and cubit tests in the Flutter repo; integration tests not yet

## Known Divergences

| Topic    | Angular                                           | Flutter                                              |
| -------- | ------------------------------------------------- | ---------------------------------------------------- |
| Grouping | Component-local `MonthGroup[]` computation        | Derived state in the Cubit: compute grouped months and emit via `state.copyWith(groupedByMonth: ...)` (or expose as a computed getter on the state class) |
| Preview  | `MatDialog` with `DocumentPreviewDialogComponent` | Shared Flutter preview widget                        |
| Download | Browser download                                  | OS save dialog / browser download from memory; no `open_file` |
| Entry    | Teamspace quick link                              | Teamspace quick link (same gate)                     |
| 403      | Generic "Fehler beim Laden"                       | List: "Kein Zugriff"; preview: "nicht verfügbar" unless the session denies access |
| Offline  | —                                                 | No offline cache (privacy)                           |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude   | Flutter port (tagea-next-flutter#68); spec updated: 403 semantics, no offline cache, save dialog |
