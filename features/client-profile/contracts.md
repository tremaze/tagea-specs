# Contracts: Client Profile

## Endpoints Consumed

| Action                   | Service / Method (approximate)                                              | Notes                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Load profile             | `UnifiedAuthService.employee()` signal + backend `/api/users/me`            | Profile data mirrors the `Client` model                                                                                                                                  |
| Update profile           | `HttpClient.patch('/api/clients/me')` (verify path via `ApiConfigService`)  | Body: `Partial<Client>`                                                                                                                                                  |
| Load password policy     | Backend endpoint — verify path                                              | Returns `PasswordPolicy`                                                                                                                                                 |
| Change password          | Backend endpoint — verify path                                              | Body: `{ currentPassword, newPassword }`                                                                                                                                 |
| Load custom fields       | `CustomFieldsV2Service.getCustomFieldsV2(entityId, entityType, mode)`       | Returns mode-dependent shape; `FieldGroupingService` converts to `FieldGroup[]`                                                                                          |
| Save custom field values | `CustomFieldsV2Service.saveAllCustomFieldsV2(entityId, entityType, values)` | Body: `Record<string, unknown>`                                                                                                                                          |
| Load managed clients     | `GET /api/client-portal/managed-clients`                                    | Returns `ManagedClient[]` — only relationships with `can_manage: true` and `is_deleted: false`. See DTO below for the wire shape and the reverse-relationship semantics. |

## Data Models

```ts
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: { street; zip; city; country };
  institution_id: string;
  // + additional fields
}

// Source of truth: apps/tagea-backend/src/client-portal/dto/managed-client.dto.ts
// (Wire response from GET /api/client-portal/managed-clients)
interface ManagedClient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  login_enabled: boolean; // whether the managed client can log into the portal themselves
  relationship_type: string; // free-form, tenant-configurable; see "Relationship semantics" below
}

interface PasswordPolicy {
  minLength: number;
  minUpperCase: number;
  minLowerCase: number;
  minDigits: number;
  minSpecialChars: number;
}
```

## Relationship semantics (managed clients)

Two important non-obvious behaviors confirmed in [`client-portal.service.ts:getManagedClients()`](../../../apps/tagea-backend/src/client-portal/client-portal.service.ts):

1. **`relationship_type` values are tenant-configurable.** They come from the `relationship_types` database table (`apps/tagea-backend/src/relationship-types/relationship-type.entity.ts`), scoped per institution via `institution_id`. The values are German free-form strings — examples from the Swagger documentation: `"Kind"`, `"Ehepartner"`. Do **not** treat as a fixed enum on the Flutter side; render the string verbatim and let admins control vocabulary in the backend.

2. **The returned `relationship_type` is the _reverse_ relationship** — i.e. what the managed client _is to the calling user_, not what the calling user is to them. The backend looks up the inverse `client_relationships` row (`client_id = related, related_client_id = me`) and uses its `relationship_type`. If no reverse row exists, it falls back to the forward `relationship_type`. This means a parent viewing their managed child sees `"Kind"` (the child IS a Kind to me), not `"Erziehungsberechtigte/r"`.

## Custom Fields v2

Field group structure supports dynamic rendering (text / dropdown / checkbox / date / ...). See `FieldGroupingService` for grouping logic and `TageaCustomFieldsComponent` for rendering rules.

> **Flutter port note:** Custom fields require a flexible render system. Consider a `dynamic_form` pattern: fetch field definitions, map to widgets via a switch on `type`. `reactive_forms` makes dynamic form state manageable.
