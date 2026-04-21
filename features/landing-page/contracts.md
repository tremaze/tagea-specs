# Contracts: Landing Page

## Services

| Service                   | Purpose                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `TenantResolutionService` | Domain/nativeTenantId → `PublicTenantInfo`; exposes signals for branding |
| `UnifiedAuthService`      | `login()` to kick off the IdP (Keycloak) flow                            |

### `TenantResolutionService` signals consumed by the landing page

Shapes exported from `apps/tagea-frontend/src/app/core/tenant-resolution.service.ts`:

```ts
interface TenantBranding {
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface PublicTenantInfo {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  registrationEnabled: boolean;
  employeeRegistrationEnabled: boolean;
}
```

## Registration sub-forms

Rendered inline when the user chooses to register:

- `RegistrationFormComponent` — client self-registration (handoff to the [public-register](../public-register/contracts.md) flow)
- `EmployeeRegistrationFormComponent` — employee self-registration (separate backend endpoint; details in `public-register` contracts)

## Backend endpoints

All served by `PublicTenantController` (`apps/tagea-backend/src/public-api/public-tenant.controller.ts`). Every route is marked `@Public()` — no auth required.

| Method | Path                       | Used by                                    | Response           |
| ------ | -------------------------- | ------------------------------------------ | ------------------ |
| GET    | `/public/tenant/by-domain` | Custom-domain web resolution (`?domain=…`) | `PublicTenantInfo` |
| GET    | `/public/tenant/:tenantId` | Native apps with `nativeTenantId` set      | `PublicTenantInfo` |

> Both endpoints return the same `PublicTenantInfo` shape. The frontend stores it in `TenantResolutionService` and exposes its signals (`branding`, `registrationEnabled`, `employeeRegistrationEnabled`, `tenantId`, `tenantInfo`, `error`) to the landing page.
