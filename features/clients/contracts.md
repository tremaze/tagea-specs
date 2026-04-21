# Contracts: Clients List

## Services

| Service              | Purpose                                                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `BasicClientService` | Core client CRUD (`getClient`, `createClient`, `updateClient`, `deleteClient`), related-entity preview, login enable/disable |
| `ClientsDataService` | List/filter/search composition on top of basic service (pagination, signals, infinite scroll)                                |
| `EmployeesService`   | Reads/writes personal preferences (persisted filter categories + department)                                                 |
| `UnifiedAuthService` | Provides `institutionId()` for navigation + permission checks                                                                |

## Data Models

```ts
// apps/tagea-frontend/src/app/models/client.model.ts

// UI-facing shape used by ClientsPageComponent (camelCase, flattened for the list)
interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  category?: 'client' | 'related_person' | 'contact';
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  postalCode: string;
  city: string;
  nationality: string;
  gender: string;
  lastContact: string;
  registrationDate: string;
  notes: string;

  // Client portal login (PHASE 6)
  login_enabled?: boolean;
  authProviderUserId?: string;
  status?: string;

  // Counselors (Bezugsmitarbeiter) — replaces the old "assigned employee" concept
  counselors: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    color?: string | null;
  }[];
}

// Wire-level shape (snake_case, matches backend Client entity/DTO)
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  category: 'client' | 'related_person' | 'contact';
  dateOfBirth?: Date | string;
  gender?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  nationality?: string;
  email?: string;
  phone?: string;
  important_note?: string;
  personal_info?: ClientPersonalInfo;
  created_at: Date | string;
  updated_at: Date | string;
  authProviderUserId?: string;
  login_enabled?: boolean;
  status?: string; // 'ACTIVE' | 'PENDING_ACTIVATION' | 'INACTIVE'
  version: number; // optimistic locking
  department_id?: string | null;
  interface_language?: string;
  last_contact_date?: string | null;
  invalid_fields?: number;
  counselors?: CounselorSummary[];
}
```

> `category` is the categorical enum surfaced in filters — NOT a `ClientStatus` enum.
> The UI list filters by `category`, `department_id`, plus contact/location/date fields — see `ClientFilters` below.

```ts
// apps/tagea-frontend/src/app/models/client.model.ts
interface ClientFilters {
  page?: number;
  limit?: number;
  search?: string;
  categories?: ('client' | 'related_person' | 'contact')[];
  department_id?: string;
  phone?: string;
  email?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  nationality?: string;
  gender?: 'männlich' | 'weiblich' | 'divers';
  birth_date?: string;
  birthDateFrom?: string;
  birthDateTo?: string;
  registrationDateFrom?: string;
  registrationDateTo?: string;
  created_from?: string;
  created_to?: string;
  managed_only?: boolean;
}
```

## Dialogs

```ts
// apps/tagea-frontend/src/app/components/client-dialog/client-dialog.component.ts
interface ClientDialogData {
  client?: Client;
  mode: 'create' | 'edit';
  suggestedAddress?: {
    fromClientName: string;
    street?: string;
    postal_code?: string;
    city?: string;
  };
}

// apps/tagea-frontend/src/app/components/delete-confirmation-dialog/delete-confirmation-dialog.component.ts
interface DeleteConfirmationDialogData {
  entityName: string; // e.g. "Klient"
  entityTitle: string; // display title (e.g. "Mustermann, Max")
  confirmationText: string; // text the user must type to confirm
  relatedEntities?: RelatedEntitiesSection[];
}

interface RelatedEntitiesSection {
  icon: string;
  label: string;
  total: number;
  items: RelatedEntityItem[];
}

interface DeleteConfirmationDialogResult {
  confirmed: boolean;
}
```

## Backend endpoints (institution-scoped)

Controller: `apps/tagea-backend/src/clients/clients.controller.ts`
Base route: `${INSTITUTION_ROUTE_PREFIX}/clients` (institution-scoped, `@Auth({ scope: 'institution' })`).

| Method | Path                            | Permission             | Used by (frontend)                      |
| ------ | ------------------------------- | ---------------------- | --------------------------------------- |
| GET    | `/clients`                      | `CLIENTS_VIEW`         | `BasicClientService.getAllClients`      |
| GET    | `/clients/minimal`              | `CLIENTS_VIEW`         | `BasicClientService.getMinimalClients`  |
| POST   | `/clients`                      | `CLIENTS_CREATE`       | `BasicClientService.createClient`       |
| GET    | `/clients/:id`                  | `CLIENTS_VIEW`         | `BasicClientService.getClient`          |
| PATCH  | `/clients/:id`                  | `CLIENTS_EDIT`         | `BasicClientService.updateClient`       |
| DELETE | `/clients/:id`                  | `CLIENTS_DELETE`       | `BasicClientService.deleteClient`       |
| GET    | `/clients/:id/related-entities` | `CLIENTS_VIEW`         | `BasicClientService.getRelatedEntities` |
| POST   | `/clients/:id/enable-login`     | `CLIENTS_ENABLE_LOGIN` | `BasicClientService.enableClientLogin`  |
| POST   | `/clients/:id/disable-login`    | `CLIENTS_EDIT`         | `BasicClientService.disableClientLogin` |

## Navigation target

Row tap → `institutionRoute(institutionId, 'profile', clientId)` → `/einrichtung/:id/profile/:clientId`.
