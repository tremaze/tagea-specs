# Parity: Teamspace Employee Directory

## Angular

- **Status:** ✅ Implemented
- **Path:** `apps/tagea-frontend/src/app/pages/teamspace/personenverzeichnis/`
  - `personenverzeichnis-page.component.{ts,html,scss}` (list, search, chips)
  - `personenverzeichnis-filters-bottom-sheet.component.ts` (mobile filter sheet)
  - `dialogs/employee-detail-dialog.component.ts` (detail)
  - `apps/tagea-frontend/src/app/shared/cards/employee-card/employee-card.component.ts` (row card)
  - `apps/tagea-frontend/src/app/services/tenant-employees.service.ts`
- **Route:** `apps/tagea-frontend/src/app/routes/teamspace.routes.ts` (`personenverzeichnis`)
- **E2E:** _(none — usage specs only)_

## Flutter

- **Status:** 🚧 In progress (WP5)
- **Paths:**
  - `apps/tagea_frontend/lib/features/teamspace/directory/`
  - `packages/teamspace_core/lib/src/api/employee_directory_api.dart`,
    `cubits/employee_directory_cubit.dart`, `cubits/employee_detail_cubit.dart`
- **Integration tests:** _(widget tests only)_

## Known Divergences

| Topic | Angular | Flutter |
| --- | --- | --- |
| Detail | Dialog (full-screen on mobile) with "Schließen" | Pushed page (`/teamspace/personenverzeichnis/:id`) with back arrow; back keeps list state |
| Filter sheet body | `mat-select` dropdown inside the sheet | Checkbox list of institutions directly in the sheet |
| Filter options | `GET /tenant/institutions` + client-side `is_active` | `GET /tenant/institutions/active` |
| Filter unavailable | Silently empty select | Filter button hidden |
| Search placeholder | "Name, E-Mail oder Telefon" (phone is not searched) | "Name oder E-Mail" |
| Refresh | — | Pull-to-refresh on list and detail |
| Card quick actions | Mail / phone icon buttons on the card | Same, via `url_launcher` |
| Teamspace chips on card | Two chips + expandable "+n" | Two chips + "+n" summary (not expandable); full list in the detail |

## Port Log

| Date       | Who          | What         |
| ---------- | ------------ | ------------ |
| 2026-09-23 | Claude (WP5) | Spec created from Angular + backend; Flutter port started |
