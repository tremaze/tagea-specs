# Contracts: Files (Global)

## Route contract

```ts
// apps/tagea-frontend/src/app/pages/files/files.routes.ts
export const FILES_ROUTES: Route[] = [
  {
    path: '',
    loadComponent: () => import('./files-page.component').then((m) => m.FilesPageComponent),
    data: { title: 'Dateien' },
  },
];
```

## Component responsibility

`FilesPageComponent` is shared with [files-institution](../files-institution/spec.md). It inspects the route context to scope its data fetches.

> Exact service + backend contracts are inside `FilesPageComponent` + any sibling service files. Flutter port (if ever attempted) should browse those directly; this feature is scoped ❌ for Flutter.
