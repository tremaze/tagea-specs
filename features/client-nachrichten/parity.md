# Parity: Client Nachrichten

## Angular

- **Status:** ✅ Implemented
- **List:** [`apps/tagea-frontend/src/app/pages/client-portal/client-messages-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-messages-page.component.ts)
- **Broadcast detail:** [`client-message-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-message-detail.component.ts)
- **Inquiry detail:** [`client-inquiry-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-inquiry-detail.component.ts)
- **Inquiry form:** `ClientInquiryFormComponent`, `ClientInquiryViewDialogComponent`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested paths:**
  - `lib/features/client_portal/nachrichten/nachrichten_page.dart`
  - `lib/features/client_portal/nachrichten/broadcast_detail_page.dart`
  - `lib/features/client_portal/nachrichten/inquiry_detail_page.dart`
  - `lib/features/client_portal/nachrichten/new_inquiry_sheet.dart`
- **Integration tests:** `integration_test/client_nachrichten_test.dart`

## Known Divergences

| Topic                | Angular                                              | Flutter                                                                        |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| Inquiry form trigger | `MatDialog` on desktop, same on mobile (full-screen) | `showModalBottomSheet` on mobile, `showDialog` on desktop (responsive wrapper) |
| Attachment picker    | Browser `<input type="file">`                        | `file_picker`                                                                  |
| Status chip colors   | Material surface variants                            | `Chip` with color roles mapped from `ClientInquiryStatus`                      |
| Combined list type   | TS discriminated union                               | Dart `sealed class` (Dart 3) for type-safe branching                           |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
