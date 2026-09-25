# Parity: Teamspace Submissions

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **E2E:** [`apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/`](../../../apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/) (UI submit: `submissions-consumer-submit-ui.spec.ts`)

## Flutter

- **Status:** 🚧 List + read-only detail (WP6, tagea-next-flutter #62 + QA follow-ups) and create flow (WP7, [tremaze/tagea-next-flutter#96](https://github.com/tremaze/tagea-next-flutter/pull/96), custom fields #83 / #88); custom-field type `richtext` pending (Asana 1218854968239289); admin sub-routes not ported
- **Path:** `apps/tagea_frontend/lib/features/teamspace/submissions/` (UI), `packages/teamspace_core` (`SubmissionsApi`, `SubmissionsListCubit`, `SubmissionDetailCubit`; create: `src/submission_create/` — `SubmissionCreateApi`, `SubmissionPickerCubit`, `SubmissionCreateCubit`, `SubmissionAttachmentRules`)
- **Files:**
  - `submissions_page.dart` (tabs „Neue Meldung“ / „Meine Meldungen“ / „Mitarbeiter“)
  - `detail/submission_detail_page.dart`
  - `create/picker/submission_picker_page.dart`, `create/picker/submission_picker_view.dart` — teamspace → category picker with category search
  - `create/form/submission_create_page.dart` — full-screen form route `/teamspace/submissions/new/:tsId/:catId`
  - Routes: `apps/tagea_frontend/lib/routing/routes/submission_create_routes.dart` (above `submissions/:id`)
- **Tests:** widget tests under `apps/tagea_frontend/test/features/teamspace/submissions/`; `integration_test/teamspace_submissions_test.dart` ⏳

## Known Divergences

| Topic                 | Angular                              | Flutter                                                                        |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Dynamic form renderer | `TageaCustomFieldsComponent`         | Shared custom-field building block (`CustomFieldFormController(enableRepeating: true)` + `CustomFieldFormView`, tagea-next-flutter #83 / #88) |
| Custom-field types    | All types Angular renders (`file` shows the unsupported-type card) | All types except `richtext` („web only“ hint until the display decision, Asana 1218854968239289) and `file` (Angular does not support it either; no backend upload endpoint). Either blocks submit only when required |
| Select / entity select | `mat-select` / autocomplete dropdown | Bottom-sheet picker / bottom-sheet search (UX §3) |
| Repeating rows        | Only counts empty fields for a „missing“ badge | Filled rows are validated (required + format); empty rows are neither validated nor sent |
| Deep link routing     | Angular `data: { mode: 'deepLink' }` | GoRouter path params + named route                                             |
| Card                  | `TageaSubmissionCardComponent`       | `TageaSubmissionItem` (status icon, category, status badge, relative date; submitter as subtitle in the supervisor list; no response preview) |
| Status / teamspace chips | computed, not rendered            | rendered (acceptance criterion)                                                |
| Default tab (mobile)  | „Neue Meldung“                       | „Meine Meldungen“                                                              |
| „Neue Meldung“ tab    | Always shown                         | Gated by `tenant.submissions.submit` (required by the categories / create endpoints); without it the tab is hidden and the `new/…` routes show „Kein Zugriff“; with one tab left there is no tab bar |
| Create form           | Wizard step 3 inside the tab         | Own full-screen route `new/:tsId/:catId` (`TageaFormPage`, PM decision, UX §3) with dirty guard; no „Zurücksetzen“ (✕ + discard dialog) |
| After sending         | Success card with „Neue Meldung erstellen“ | Snack bar „Meldung erfolgreich gesendet“, then the app opens the **detail of the new submission** (PM decision); back from there returns to „Meine Meldungen“ (refreshed) |
| Required attachment   | „Senden“ greyed out                  | Button stays enabled; validation error + scroll to the attachment field (UX §4) |
| Attachment input      | Drag & drop / file dialog            | Source sheet (Kamera / Galerie / Dateien) on mobile, file dialog on web; gallery photos re-encoded as JPEG |
| Duplicate file        | Ignored silently                     | Snack bar                                                                       |
| Upload                | Spinner                              | Progress + „Senden abbrechen“ (UX §6); cancel also on leave / file removal until the body is sent |
| `new/:catId` without `teamspaceId` | Link rejected           | Teamspace picker as fallback (PM default); picking a teamspace that offers the category opens its form directly |
| Create: other load errors | Redirect to the list             | Error state with retry (network / server); unknown or inactive teamspace / category still → snack bar + list |
| Offline send          | —                                    | Blocked until the product decision (Asana 1218862875888309)                     |
| Detail field grid     | 200 px label column, tables for repeating groups | label above value; repeating rows as numbered blocks (phone width)   |
| Rich-text values      | rendered HTML                        | plain text (untrusted API content)                                              |
| Attachments           | preview dialog + download            | presigned URL opened by the platform                                            |
| Pull-to-refresh       | —                                    | lists and detail, including the detail's not-found and error states; every picker list and the form's loading / error / no-access states (not the filled-in form) |
| Mobile tabs           | `mat-tab-group` (header paginates)   | segmented tabs; labels wrap between words so all three fit at 360 dp, else the bar scrolls with the selected tab in view |
| Admin sub-routes      | `/teamspace/submissions/verwaltung`, `/konfiguration` | not ported; deep links land on the list                                |
| Back from detail      | page re-initialises                  | list refreshes in place, keeping items and scroll offset                       |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude (WP6) | List tabs, answer vs. history, detail endpoints clarified from Angular + backend |
| 2026-09-23 | Claude (WP6 QA) | Flutter status and divergences after the QA follow-ups |
| 2026-09-25 | Claude (M2-Specs) | Permission map corrected to `tenant.submissions.submit` / `tenant.submissions.view_own` / `submissions.process`; create multipart contract (parts, 5 files × 10 MB, MIME list, errors); deep-link behaviour for both `new/` routes |
| 2026-09-25 | Claude (M2-Specs QA) | Owner decision: all custom-field types rendered in Flutter; status marker 🟡 → 🚧 |
| 2026-09-25 | Claude (M2 parity) | WP7 create flow merged (tagea-next-flutter#96, custom fields #83 / #88); Flutter stays 🚧 (`richtext`, admin sub-routes); deviations recorded |
