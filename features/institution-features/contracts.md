# Contracts: Institution Features

## Endpoints

### `GET /api/tenant-institutions/:id/features`

**Auth:** `Auth({ scope: 'tenant', permissions: [TENANT_INSTITUTIONS_VIEW] })`
**Path param:** `id` (institution UUID)
**Response (200):**

```ts
type FeatureWithLockStatus = {
  /** Feature key, e.g. 'financialSupport', 'chat', 'tasks'. */
  key: keyof InstitutionFeatures;
  /** Display name for the UI (German), tenant override > catalog default. */
  displayName: string;
  /**
   * Whether the feature is enabled at institution level.
   * Mirrors the DB exactly: `institutions.features[key]?.enabled ?? false`.
   * A missing key is reported as `false` — there is no implicit "inherit".
   */
  institutionEnabled: boolean;
  /** Whether the feature is enabled at tenant level. */
  tenantEnabled: boolean;
  /** `tenantEnabled && institutionEnabled` — what runtime gates check. */
  effectiveEnabled: boolean;
  /** True iff the tenant has the feature disabled (institution cannot override up). */
  locked: boolean;
};

type Response = FeatureWithLockStatus[];
```

**Error codes:** 401, 403, 404 (institution not found)

### `PATCH /api/super-admin/tenants/:id/features`

**Auth:** Super admin (`@RequireSuperAdmin`).
**Path param:** `id` (tenant UUID).
**Body:** `UpdateTenantFeaturesDto` — partial map of tenant feature keys to objects (`{ enabled: boolean, ... }`). Each feature has its own DTO type because some include extra fields (`billing.provider`, `mfa.target`, `videoMeeting.provider`, etc.).
**Response (200):** the resolved `TenantFeatures`.
**Side effects:**
- Audit-log entries (`feature_audit_log`) are written for each changed key.
- For every key that transitions from `enabled: true` to `enabled: false`, the tenant's `institutions` table is updated to flip `features.<key>.enabled = false` for every row where it was `true`. The mapping `clientRegistration → clientSelfRegistration` is honored. Disabling `institutions` also sets `allow_counseling_mode = false` on affected rows.

**Error codes:** 400, 401, 403, 404.

### `PATCH /api/tenant-institutions/:id/features`

**Auth:** `Auth({ scope: 'tenant', permissions: [TENANT_INSTITUTIONS_EDIT] })`
**Path param:** `id` (institution UUID)
**Body:** `UpdateInstitutionFeaturesDto` — partial map of `featureKey -> { enabled: boolean }`. Keys omitted from the body are left untouched in the DB.
**Response (200):** the updated `Institution`.
**Side effect:** when `features.institutions` is set, the legacy boolean `institutions.allow_counseling_mode` is mirrored for backward compatibility.
**Error codes:** 400 (invalid DTO), 401, 403, 404.

## Data Models

```ts
// Source: apps/tagea-backend/src/institutions/entities/institution.entity.ts
interface InstitutionFeature {
  enabled: boolean;
}

interface InstitutionFeatures {
  financialSupport?: InstitutionFeature;
  caseManagement?: InstitutionFeature;
  reports?: InstitutionFeature;
  billing?: InstitutionFeature;
  departments?: InstitutionFeature;
  /** Controls whether employees may switch to counseling mode. */
  institutions?: InstitutionFeature;
  clientPortal?: InstitutionFeature;
  chat?: InstitutionFeature;
  teamspace?: InstitutionFeature;
  cariData?: InstitutionFeature;
  tasks?: InstitutionFeature;
  vivendiSync?: InstitutionFeature;
  microsoftSync?: InstitutionFeature;
  azureSync?: InstitutionFeature;
  outlookCalendarSync?: InstitutionFeature;
  videoMeeting?: InstitutionFeature;
  clientMessages?: InstitutionFeature;
  proofOfSalary?: InstitutionFeature;
  multilingual?: InstitutionFeature;
  aiChat?: InstitutionFeature;
  schulungen?: InstitutionFeature;
  /** Tenant-side master switch is `clientRegistration` (not `clientSelfRegistration`). */
  clientSelfRegistration?: InstitutionFeature;
  fileStorage?: InstitutionFeature;
  clientReports?: InstitutionFeature;
  aiDocumentation?: InstitutionFeature;
}
```

## Semantics

- **Source of truth:** the `institutions.features` JSONB column.
- **Missing key = disabled** at every layer: `getFeaturesWithLockStatus`, `getEffectiveFeatures`, `isFeatureEnabled`. There is no implicit "inherit from tenant" default.
- **Hierarchical AND:** `effectiveEnabled = tenantEnabled && institutionEnabled`. Tenant `false` always wins.
- **Lock:** `locked = !tenantEnabled`. The institution-level value is rewritten by the cascade (see below), not preserved across a tenant disable.
- **Tenant → Institution cascade (disable only):** when `PATCH /super-admin/tenants/:id/features` flips a feature from `enabled: true` to `enabled: false`, `TenantManagementService.updateTenantFeatures` runs an UPDATE on the tenant's `institutions` table that sets `features.<key>.enabled = false` for every row where it was previously `true`. The reverse direction (re-enable) does **not** cascade — admins must opt in per institution.
  - Mapping is 1:1 except `clientRegistration` (tenant) → `clientSelfRegistration` (institution).
  - Disabling `institutions` also sets the legacy `institutions.allow_counseling_mode` column to `false` on affected rows.
  - Tenant features without an institution counterpart (`timeTracking`, `datevExport`, `pep`, `mfa`, `employeeRegistration`) are no-ops in the cascade.
- **Special key mapping:** `clientSelfRegistration` reads its tenant-level master from `clientRegistration` (legacy naming).
