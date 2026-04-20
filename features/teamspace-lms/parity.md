# Parity: Teamspace LMS

## Angular

- **Status:** ✅ Implemented (user-facing); admin surface ❌ Flutter scope
- **Route file:** [`apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`](../../../apps/tagea-frontend/src/app/pages/lms/lms.routes.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/lms/home_page.dart`
  - `lib/features/lms/course_overview_page.dart`
  - `lib/features/lms/course_player_page.dart`
  - `lib/features/lms/pdf_viewer_page.dart`
- **Key packages:**
  - `video_player` or `chewie` for video lessons
  - `syncfusion_flutter_pdfviewer` or `flutter_pdfview` for PDFs (with auth-header loader)
- **Integration tests:** `integration_test/teamspace_lms_test.dart`

## Known Divergences

| Topic                | Angular                               | Flutter                                                                            |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| Video player         | HTML5 `<video>` with Angular wrappers | `video_player` + `chewie` for controls                                             |
| PDF viewer           | iframe with authenticated URL         | `syncfusion_flutter_pdfviewer`; fetch bytes with Dio + render via `memoryProvider` |
| Progress persistence | Angular facade                        | Riverpod `LearningController`                                                      |
| Course catalog cache | In-memory signal                      | Riverpod provider + optional `hive` cache                                          |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
