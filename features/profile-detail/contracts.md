# Contracts: Profile Detail

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/profile.routes.ts
export const PROFILE_BASE_GUARDS = {
  canActivate: [permissionGuard],
  data: { requiredPermission: 'clients.view' },
};

export const PROFILE_CHILD_ROUTES: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: 'overview', loadComponent: () => ... },
  { path: 'appointments', loadComponent: () => ... },
  { path: 'stammdaten', loadComponent: () => ..., canDeactivate: [UnsavedChangesGuard] },
  { path: 'relationships', loadComponent: () => ... },
  { path: 'financial', loadComponent: () => ..., canActivate: [financialSupportFeatureGuard] },
  { path: 'reminders', loadComponent: () => ... },
  { path: 'documents', loadComponent: () => ... },
  { path: 'messages', loadComponent: () => ... },
  { path: 'cases', loadComponent: () => ..., canActivate: [caseFeatureGuard] },
  { path: 'reports', loadComponent: () => ..., canActivate: [clientReportsFeatureGuard] },
  { path: 'reports/:reportId', loadComponent: () => import('../components/client-reports/client-report-editor.component').then(m => m.ClientReportEditorComponent), canActivate: [clientReportsFeatureGuard] },
];
```

Mounted by the parent at `/einrichtung/:institutionId/profile/:id`:

```ts
{
  path: 'profile/:id',
  loadComponent: () => import('../pages/profile-page/profile-layout.component').then(m => m.ProfileLayoutComponent),
  ...PROFILE_BASE_GUARDS,
  children: PROFILE_CHILD_ROUTES,
}
```

## Tab services

Each tab injects its own service(s). Relevant examples:

- Overview: `BasicClientService`
- Appointments: `AppointmentsService` scoped to client
- Stammdaten: `BasicClientService` + custom-fields services
- Financial: `FinancialSupportService`
- Reminders: reminders service
- Documents: document service
- Messages: `ClientMessagesService`
- Cases: `CaseManagementService`
- Reports: `ClientReportsService` (verify exact name)

## Key difference vs case-detail

`UnsavedChangesGuard` is applied **only to the Stammdaten tab** here (and at the layout level in case-detail). The granularity matters for the Flutter port if ever attempted.
