# Contracts: Files (Institution)

Shared with [files-global](../files-global/contracts.md) — the same `FilesPageComponent` backs both mounts. The institution mount differs only in the scoping derived from the URL's `:institutionId` param.

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/institution.routes.ts (lines 268-275)
{
  path: 'dateien',
  loadComponent: () => import('../pages/files/files-page.component').then(m => m.FilesPageComponent),
  canActivate: [fileStorageFeatureGuard],
  data: { title: 'Dateien' },
}
```
