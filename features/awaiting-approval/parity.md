# Parity: Awaiting Approval

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employee-awaiting-approval/employee-awaiting-approval.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-awaiting-approval/employee-awaiting-approval.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/awaiting_approval_page.dart`
- **Integration tests:** `integration_test/awaiting_approval_test.dart`

## Known Divergences

| Topic                    | Angular                             | Flutter                                                      |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------ |
| Poll mechanism           | RxJS `interval(5000)` + `switchMap` | `Cubit`/`Bloc` driving `Timer.periodic` or `Stream.periodic` |
| Teardown                 | `destroy$` subject                  | `Cubit`/`Bloc` cancels subscription in `close()` override    |
| Error handling           | None (stream dies on error)         | Add `.handleError` + retry with backoff                      |
| Success delay            | RxJS `delay(2000)`                  | `Future.delayed(Duration(seconds: 2))` before navigation     |
| Notification on approval | Polling only                        | Consider FCM push as primary, polling as fallback            |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
