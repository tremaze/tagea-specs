# Parity: Teamspace Submissions

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **E2E:** [`apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/`](../../../apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/) (UI submit: `submissions-consumer-submit-ui.spec.ts`)

## Flutter

- **Status:** 🚧 List + read-only detail (WP6, tagea-next-flutter #62 + QA follow-ups); create flow pending
- **Path:** `apps/tagea_frontend/lib/features/teamspace/submissions/` (UI), `packages/teamspace_core` (`SubmissionsApi`, `SubmissionsListCubit`, `SubmissionDetailCubit`)
- **Files:**
  - `submissions_page.dart` (tabs „Neue Meldung“ / „Meine Meldungen“ / „Mitarbeiter“)
  - `detail/submission_detail_page.dart`
  - `submissions_new_page.dart` — ⏳ create flow (deep-link-friendly, takes teamspaceId + categoryId)
- **Tests:** widget tests under `apps/tagea_frontend/test/features/teamspace/submissions/`; `integration_test/teamspace_submissions_test.dart` ⏳

## Known Divergences

| Topic                 | Angular                              | Flutter                                                                        |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| Dynamic form renderer | `TageaCustomFieldsComponent`         | Shared dynamic-form widget (see [client-profile](../client-profile/parity.md)) |
| Deep link routing     | Angular `data: { mode: 'deepLink' }` | GoRouter path params + named route                                             |
| Card                  | `TageaSubmissionCardComponent`       | `TageaSubmissionItem` (status icon, category, status badge, relative date; submitter as subtitle in the supervisor list; no response preview) |
| Status / teamspace chips | computed, not rendered            | rendered (acceptance criterion)                                                |
| Default tab (mobile)  | „Neue Meldung“                       | „Meine Meldungen“ while the create flow is „Kommt bald“                         |
| Detail field grid     | 200 px label column, tables for repeating groups | label above value; repeating rows as numbered blocks (phone width)   |
| Rich-text values      | rendered HTML                        | plain text (untrusted API content)                                              |
| Attachments           | preview dialog + download            | presigned URL opened by the platform                                            |
| Pull-to-refresh       | —                                    | lists and detail, including the detail's not-found and error states            |
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
