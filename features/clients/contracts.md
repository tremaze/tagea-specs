# Contracts: Clients List

## Services

| Service              | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `BasicClientService` | Core client CRUD — get, create, update, delete         |
| `ClientsDataService` | List/filter/search composition on top of basic service |
| `EmployeesService`   | Employee lookup for assigned-staff column              |

## Data Models

```ts
// apps/tagea-frontend/src/app/models/client.model.ts
interface ClientData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  assigned_employee_id?: string;
  institution_id: string;
  status?: ClientStatus;
  // + extended fields (custom fields, address, etc.)
}
```

> Exact enums (`ClientStatus`) and full field set live in the model file — Flutter port reads there.

## Dialogs

```ts
// apps/tagea-frontend/src/app/components/client-dialog/client-dialog.component.ts
interface ClientDialogData {
  mode: 'create' | 'edit';
  client?: ClientData;
}

// apps/tagea-frontend/src/app/components/delete-confirmation-dialog/delete-confirmation-dialog.component.ts
interface DeleteConfirmationDialogData {
  entity: string;
  entityName: string;
  relatedEntities?: RelatedEntitiesSection[];
}

interface RelatedEntitiesSection {
  label: string;
  count: number;
  // + metadata
}
```

## Navigation target

Row tap → `institutionRoute(institutionId, 'profile', clientId)` → `/einrichtung/:id/profile/:clientId`.
