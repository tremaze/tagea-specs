# Parity: Client Dokumente

## Angular

- **Status:** ✅ Implemented (list); 🚧 Stub (detail route)
- **List path:** [`apps/tagea-frontend/src/app/pages/client-portal/client-dokumente-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-dokumente-page.component.ts)
- **Detail stub:** [`client-dokument-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-dokument-detail.component.ts)
- **Upload dialog:** [`client-document-upload-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-document-upload-dialog.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/client_portal/dokumente/dokumente_page.dart`
  - `lib/features/client_portal/dokumente/document_preview_sheet.dart` (modal bottom sheet instead of dialog for mobile ergonomics)
  - `lib/features/client_portal/dokumente/upload_sheet.dart`
- **Key packages:**
  - `file_picker` — cross-platform file selection
  - `signature` — drawable signature widget
  - `open_file` / `open_filex` — launch downloaded files in native apps
  - `dio` — multipart upload with progress
- **Integration tests:** `integration_test/client_dokumente_test.dart`

## Known Divergences

| Topic                  | Angular                     | Flutter                                                                                                    |
| ---------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Preview UI             | `MatDialog` with iframe/img | Full-screen `PageRoute` or modal bottom sheet; PDF via `syncfusion_flutter_pdfviewer` or `flutter_pdfview` |
| Upload entry           | Mobile FAB + dialog         | Same, but sheet instead of dialog                                                                          |
| Download target        | Browser download            | Save to platform folder + optional "Open in…" sheet                                                        |
| Thumbnails             | Server URL as `src`         | `CachedNetworkImage` for disk caching + fade-in                                                            |
| Signature image format | Base64 PNG over HTTP        | Same format; captured via `signature` controller                                                           |
| Detail route           | Stub placeholder            | Skip — preview sheet replaces it                                                                           |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
