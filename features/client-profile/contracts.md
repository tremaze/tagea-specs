# Contracts: Client Profile

## Endpoints Consumed

| Action                   | Service / Method (approximate)                                              | Notes                                                                           |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Load profile             | `UnifiedAuthService.employee()` signal + backend `/api/users/me`            | Profile data mirrors the `Client` model                                         |
| Update profile           | `HttpClient.patch('/api/clients/me')` (verify path via `ApiConfigService`)  | Body: `Partial<Client>`                                                         |
| Load password policy     | Backend endpoint — verify path                                              | Returns `PasswordPolicy`                                                        |
| Change password          | Backend endpoint — verify path                                              | Body: `{ currentPassword, newPassword }`                                        |
| Load custom fields       | `CustomFieldsV2Service.getCustomFieldsV2(entityId, entityType, mode)`       | Returns mode-dependent shape; `FieldGroupingService` converts to `FieldGroup[]` |
| Save custom field values | `CustomFieldsV2Service.saveAllCustomFieldsV2(entityId, entityType, values)` | Body: `Record<string, unknown>`                                                 |
| Load managed clients     | Service call — verify                                                       | Returns `ManagedClient[]`                                                       |

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

interface ManagedClient {
  id: string;
  first_name: string;
  last_name: string;
  relationship: 'parent' | 'guardian' | 'caregiver' | 'other';
  status: 'active' | 'pending_approval' | /* … */;
  // + other fields
}

interface PasswordPolicy {
  minLength: number;
  minUpperCase: number;
  minLowerCase: number;
  minDigits: number;
  minSpecialChars: number;
}
```

## Custom Fields v2

Field group structure supports dynamic rendering (text / dropdown / checkbox / date / ...). See `FieldGroupingService` for grouping logic and `TageaCustomFieldsComponent` for rendering rules.

> **Flutter port note:** Custom fields require a flexible render system. Consider a `dynamic_form` pattern: fetch field definitions, map to widgets via a switch on `type`. `reactive_forms` makes dynamic form state manageable.
