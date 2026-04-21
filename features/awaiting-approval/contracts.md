# Contracts: Awaiting Approval

## Polling

- `EmployeesService.getCurrentEmployee()` — returns the current employee record.
- Endpoint: `GET /employees/me` (backend: `EmployeeSelfServiceController` with `@Controller('employees/me')`, `@Auth({ scope: 'authenticated' })` — any authenticated user, including `PENDING_APPROVAL`, may call it).
- Frontend wiring: `this.http.get<Employee>(`${this.baseUrl}/me`)` where `baseUrl = apiConfig.getApiUrl('employees')`.
- Polled every 5000ms via RxJS `interval(5000).pipe(switchMap(...))`.
- The `status` field is inspected:

```ts
// Documentation-only shape — the full Employee model lives in
// apps/tagea-frontend/src/app/models/employee.model.ts (status typed as `string`).
// Backend enum: apps/tagea-backend/src/common/types/user-principal.types.ts
interface Employee {
  id: string;
  // UserStatus enum: 'active' | 'deleted' | 'suspended' | 'pending_activation' | 'pending_approval'
  status: string;
  // + many other fields (first_name, last_name, email, tenant_id, role, …)
}
```

- When `status === 'active'`, a 2-second delay is applied via `delay(2000)` to let the success UI show, then `Router.navigate(['/'])` fires.

## Actions

### "Abmelden"

- `UnifiedAuthService.logout()` — same as other auth-surface pages.

## Redirect out

- Approval detected → `Router.navigate(['/'])` (root). Under the secure shell, `/` renders `SecureMainComponent` guarded by `activeEmployeeGuard`, which now permits the user (status flipped to `active`) and lets the default child route resolve to the institution dashboard.

> **Flutter port note:** Drive polling from a `Cubit` (or `Bloc`) that owns a `Timer.periodic(Duration(seconds: 5))` or a `StreamSubscription` on `Stream.periodic(Duration(seconds: 5))` and emits new state on each tick. Cancel the timer/subscription in the Cubit/Bloc's `close()` override — `BlocProvider` calls `close()` automatically when the widget is removed from the tree, which is the BLoC equivalent of cancelling on dispose. Consider backoff on errors (the Angular impl currently doesn't handle poll errors).
