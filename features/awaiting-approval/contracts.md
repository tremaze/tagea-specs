# Contracts: Awaiting Approval

## Polling

- `EmployeesService.getCurrentEmployee()` — returns the current employee record.
- Polled every 5000ms via RxJS `interval(5000).pipe(switchMap(...))`.
- The `status` field is inspected:

```ts
// Source (shape inferred from component usage)
interface Employee {
  id: string;
  status: 'pending_approval' | 'active' | /* other values */;
  // + other fields
}
```

- When `status === 'active'`, a 2-second delay is applied via `delay(2000)` to let the success UI show, then `Router.navigate(['/'])` fires.

## Actions

### "Abmelden"

- `UnifiedAuthService.logout()` — same as other auth-surface pages.

## Redirect out

- Approval detected → `/` (root; `rootRedirectGuard` then routes to the institution dashboard).

> **Flutter port note:** Use `Stream.periodic(Duration(seconds: 5))` or Riverpod's `StreamProvider` for polling. Cancel the stream when the widget is disposed. Consider backoff on errors (the Angular impl currently doesn't handle poll errors).
