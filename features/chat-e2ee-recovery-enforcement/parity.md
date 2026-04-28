# Parity: Chat E2EE Recovery File Enforcement

## Angular

- **Status:** N/A
- **Path:** Not implemented in Angular — the reference frontend does
  not ship E2EE.
- **E2E:** N/A

## Flutter

- **Status:** ⏳
- **Path:**
  - `packages/matrix_chat/lib/src/cubits/encryption_setup_cubit.dart`
  - `packages/matrix_chat/lib/src/widgets/encryption/matrix_encryption_setup_page.dart`
  - `packages/matrix_chat/lib/src/widgets/encryption/matrix_encryption_setup_guard.dart`
  - `apps/tagea_frontend/lib/home/tabs/chat_shell.dart`
  - `apps/tagea_frontend/lib/chat/tagea_recovery_file_helper.dart`
- **Integration tests:** to be added in
  `packages/matrix_chat/test/src/cubits/encryption_setup_cubit_test.dart`
  and a new widget test for the `saveRecoveryFile` enforcement UI.

## Known Divergences

This is a Flutter-only feature. No Angular parity is expected because
the Angular reference frontend does not provide E2EE. The "downloaded"
flag is intentionally local-per-device-per-user — there is no remote
sync of this flag to other devices or to the Angular frontend.

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-28 | ltoenjes | Spec created |
