# Contracts: Case Detail

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/case.routes.ts
export const CASE_BASE_GUARDS = {
  canDeactivate: [UnsavedChangesGuard],
};

export const CASE_CHILD_ROUTES: Routes = [
  { path: '', redirectTo: 'overview', pathMatch: 'full' },
  { path: 'overview', loadComponent: () => ... },
  { path: 'appointments', loadComponent: () => ... },
  { path: 'financial', loadComponent: () => ..., canActivate: [financialSupportFeatureGuard] },
  { path: 'approvals', loadComponent: () => ..., canActivate: [approvalsFeatureGuard] },
  { path: 'data', loadComponent: () => ... },
  { path: 'reminders', loadComponent: () => ... },
  { path: 'documents', loadComponent: () => ... },
];
```

Mounted by the parent at `/einrichtung/:institutionId/cases/:id`:

```ts
{
  path: 'cases/:id',
  loadComponent: () => import('../pages/case-detail-page/case-detail-layout.component').then(m => m.CaseDetailLayoutComponent),
  canDeactivate: [UnsavedChangesGuard],
  children: CASE_CHILD_ROUTES,
}
```

## Tab services

Each tab injects its own service(s). Relevant examples (verify exact names in the respective tab component files):

- `CaseOverviewTabComponent` → `CaseManagementService`
- `CaseAppointmentsTabComponent` → `AppointmentsService` scoped to case
- `CaseFinancialTabComponent` → `FinancialSupportService`
- `CaseApprovalsTabComponent` → approvals service
- `CaseDataTabComponent` → `CustomFieldsService` / `CustomFieldsV2Service`
- `CaseRemindersTabComponent` → reminders service
- `CaseDocumentsTabComponent` → document service
