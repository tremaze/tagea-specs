# Parity: Teamspace Submissions

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/teamspace/submissions/`
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
| Card                  | `TageaSubmissionCardComponent`       | Dart `SubmissionCard` widget                                                   |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
