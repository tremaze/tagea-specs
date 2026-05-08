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
- **Lock:** `locked = !tenantEnabled`. The persisted institution value is preserved when locked, so toggling tenant back on restores the original institution state.
- **Special key mapping:** `clientSelfRegistration` reads its tenant-level master from `clientRegistration` (legacy naming).
