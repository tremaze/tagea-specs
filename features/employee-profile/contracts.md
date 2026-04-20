# Contracts: Employee Profile

## Services

Exact methods live in the component's injected services. Verify signatures there during any port.

- Employee CRUD (own profile)
- Availability read/write (similar to `WorkingHoursService`)
- Avatar upload (with `HttpEventType.UploadProgress`)
- Password change
- Custom-fields read/write

## Route contract

```ts
// apps/tagea-frontend/src/app/app.routes.ts
{
  path: 'employee-profile',
  loadComponent: () => import('./pages/employee-profile/employee-profile.component').then(m => m.EmployeeProfileComponent),
  canDeactivate: [UnsavedChangesGuard],
}
```

## Related

Structurally similar to [client-profile](../client-profile/contracts.md). Shares:

- `UnsavedChangesGuard` pattern
- Custom-fields dynamic-form rendering
- `ProfileCardComponent`
