# Parity: Teamspace Submissions

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🟡 List + read-only detail (WP6); create flow pending
- **Path:** `apps/tagea_frontend/lib/features/teamspace/submissions/` (UI), `packages/teamspace_core` (`SubmissionsApi`, `SubmissionsListCubit`, `SubmissionDetailCubit`)
- **Sub-routes:**
  - `submissions_list_page.dart`
  - `submissions_new_page.dart` (deep-link-friendly, takes teamspaceId + categoryId)
  - `submission_detail_page.dart`
- **Integration tests:** `integration_test/teamspace_submissions_test.dart`

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
| Pull-to-refresh       | —                                    | lists and detail                                                                |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
| 2026-09-23 | Claude (WP6) | List tabs, answer vs. history, detail endpoints clarified from Angular + backend |
