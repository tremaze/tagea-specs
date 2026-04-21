# Contracts: Client Profile

## Endpoints Consumed

| Action                    | Service / Method                                                                                                                                   | Notes                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Load profile              | `GET /api/clients/me` via `HttpClient.get` + `ApiConfigService.getApiUrl('clients/me')`                                                            | Returns a full `Client` entity. Handled by `ClientPortalController.getMyProfile` in `apps/tagea-backend/src/clients/client-portal.controller.ts`.                                                              |
| Update profile            | `PATCH /api/clients/me` via `HttpClient.patch('clients/me', updateDto)`                                                                            | Body matches `UpdateClientDto` (frontend sends a subset: `first_name`, `last_name`, `phone`). Backend strips protected fields (`status`, `category`, `login_enabled`, `email_verified`, `authProviderUserId`). |
| Update chat notifications | `PATCH /api/clients/me` with body `{ chat_notifications: boolean }`                                                                                | Same endpoint as Update profile; passed through `UpdateClientDto`'s `personal_info`-adjacent fields and persisted.                                                                                             |
| Delete own account        | `DELETE /api/clients/me`                                                                                                                           | Deactivates the Keycloak account; client record stays. Triggers frontend `logout()` and redirect to `/`.                                                                                                       |
| Load password policy      | `GET /api/auth/password-policy` (public)                                                                                                           | Returns `PasswordPolicyResponse` from Keycloak realm policy. Frontend uses the subset `{ minLength, minUpperCase, minLowerCase, minDigits, minSpecialChars }`.                                                 |
| Change password           | `POST /api/auth/me/change-password`                                                                                                                | Body: `ChangePasswordDto` = `{ currentPassword, newPassword }`. No forced sign-out.                                                                                                                            |
| Load custom fields        | `CustomFieldsService.getFieldDefinitions('client', true)` (V1) + `CustomFieldsV2Service.getCustomFieldsV2(entityId, entityType, mode)` (V2 values) | Definitions are grouped by `FieldGroupingService.groupFieldsByCategory(definitions)` into `FieldGroup[]`. Values load with `mode = 'cache'`.                                                                   |
| Save custom field values  | `CustomFieldsV2Service.bulkUpdateCustomFieldsV2(entityId, entityType, values)`                                                                     | Wire: `PUT …/custom-fields/v2/bulk` with body `{ fields: Record<string, unknown> }`. Returns `{ success, updated_count }`.                                                                                     |
| Load managed clients      | `GET /api/client-portal/managed-clients`                                                                                                           | Returns `ManagedClientResponseDto[]` — only relationships with `can_manage: true` and `is_deleted: false`. See DTO below for the wire shape and the reverse-relationship semantics.                            |

> **Note:** In the current build, the Custom Fields tab is gated out (`loadCustomFields()` is commented out in `ngOnInit`) pending the `visible_in_client_portal` / `editable_in_client_portal` flags on `CustomFieldDefinition`. The endpoints are wired but not invoked yet.

## Data Models

> Documentation-only shape. Mirrors `apps/tagea-frontend/src/app/models/client.model.ts` — the `Client` interface there is the authoritative frontend type.

```ts
// Source of truth: apps/tagea-frontend/src/app/models/client.model.ts
// Address fields are flat columns, not a nested object.
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  category: 'client' | 'related_person' | 'contact';
  email?: string;
  phone?: string;
  dateOfBirth?: Date | string;
  gender?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  nationality?: string;
  important_note?: string;
  personal_info?: { notes?: string; [key: string]: unknown };
  authProviderUserId?: string;
  login_enabled?: boolean;
  status?: string;
  version: number;
  department_id?: string | null;
  interface_language?: string;
  last_contact_date?: string | null;
  invalid_fields?: number;
  created_at: Date | string;
  updated_at: Date | string;
}
```

```ts
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
```

```ts
// Frontend interface in client-profile.component.ts — a subset of the backend
// PasswordPolicyResponse from apps/tagea-backend/src/auth/services/user-management.service.ts
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
