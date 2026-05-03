# Contracts: Tenant Selection (3 Eingangsbühnen)

> All endpoints are public (no auth). They live in `apps/tagea-backend/src/public-api/`.

## Cloud-Group Endpoints

### `GET /public/tenant-groups/:idOrSlug`

Resolves a Cloud-Group (group with `is_cloud_group = true` and `is_active = true`) by id **or** slug. Used by Onboarding Wizard and Cloud Discovery to render the group header.

**Path params:** `idOrSlug` — UUID **or** slug
**Response 200:**

```ts
// apps/tagea-frontend/src/app/services/public-cloud-group.service.ts
interface PublicCloudGroupInfo {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;       // signed S3 URL, TTL 1 h
  primaryColor?: string;
}
```

**Error codes:** 404 (group not found, not a cloud group, or inactive)

---

### `GET /public/tenant-groups/:idOrSlug/tenants?q=&limit=&offset=`

Returns active Träger inside the cloud group, alphabetically by name. Used by Wizard and Cloud Discovery search field.

**Path params:** `idOrSlug` — UUID or slug
**Query params:**

| Name     | Type   | Required | Default | Notes                                 |
| -------- | ------ | -------- | ------- | ------------------------------------- |
| `q`      | string | no       | —       | Search term; ignored if < 2 chars     |
| `limit`  | int    | no       | 50      | Backend caps at 100                   |
| `offset` | int    | no       | 0       | Pagination start                      |

**Response 200:**

```ts
// apps/tagea-frontend/src/app/services/public-cloud-group.service.ts
interface PublicCloudTenant {
  id: string;
  name: string;
  logoUrl?: string;       // signed S3 URL, TTL 1 h
  primaryColor?: string;
  state?: string;         // Bundesland from tenants.state
  city?: string;          // tenants.settings.address.city, if set
  brandId?: string;       // "caritas" | "donum-vitae" | … — falls back to tenant_groups.brand_id
  registrationEnabled: boolean;          // settings.features.clientRegistration
  employeeRegistrationEnabled: boolean;  // settings.features.employeeRegistration
}

interface PublicCloudTenantList {
  items: PublicCloudTenant[];
  total: number;
}
```

**Error codes:** 400 (invalid limit/offset), 404 (group not found / inactive)

---

## Tenant Endpoints

### `GET /public/tenant/:tenantId`

Used by `TenantResolutionService.resolveCloudTenant()` to validate a persisted cloud-tenant id on app start, **and** by the picker/Wizard to confirm a selection. The picker writes the response into `applyCloudSelection()`.

**Path params:** `tenantId` — UUID
**Response 200:**

```ts
// apps/tagea-frontend/src/app/core/tenant-resolution.service.ts
interface PublicTenantInfo {
  id: string;
  name: string;
  logoUrl?: string;       // signed S3 URL, TTL 1 h
  primaryColor?: string;
  registrationEnabled: boolean;
  employeeRegistrationEnabled: boolean;
  tenantGroupId: string | null;
}
```

**Error codes:** 404 (tenant not found or inactive)

---

### `GET /public/tenant/by-domain?domain=...`

Resolves a custom domain (e.g. `caritas-hamm.de`) to its tenant. Used during APP_INITIALIZER for custom-domain builds.

**Query params:** `domain` — full hostname

**Response 200:** Same `PublicTenantInfo` as above.

**Error codes:** 400 (missing param), 404 (no match)

---

## Group-Booking Endpoints

These power the inline BookingFlow on TenantHomepage. They are scoped per group + tenant + institution + template.

### `GET /public/tenant/groups/:slug/institutions`

Returns all active institutions across tenants in the group. Frontend filters by `tenantId` to get the institutions of the current tenant.

**Response 200:**

```ts
// apps/tagea-frontend/src/app/services/public-tenant-group.service.ts
interface PublicGroupInstitution {
  tenantId: string;
  tenantName: string;
  institutionId: string;
  institutionName: string;
  city?: string;
  street?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

interface PublicGroupInfo {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  institutions: PublicGroupInstitution[];
}
```

---

### `GET /public/tenant/groups/:slug/institutions/:tenantId/:institutionId/templates`

Returns active, non-archived appointment templates ("Beratungskategorien") for one institution. The frontend aggregates over all institutions of the tenant to build the tenant-wide themes list.

**Response 200:**

```ts
// apps/tagea-frontend/src/app/services/public-tenant-group.service.ts
interface PublicAppointmentTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  durationMinutes: number | null;
}
```

---

### `GET /public/tenant/groups/:slug/institutions/:tenantId/:institutionId/templates/:templateId/slots`

Returns available slots for the next 14 days for one institution + template. Frontend fans out across all institutions offering the same template and merges results, tagging each slot with its institution.

**Response 200:**

```ts
// apps/tagea-frontend/src/app/services/public-tenant-group.service.ts
interface PublicAvailableSlot {
  startDatetime: string;       // ISO datetime
  endDatetime: string;         // ISO datetime
  durationMinutes: number;
  allowedSettings: string[];   // subset of "vor-ort" | "video" | "telefon" | "chat"
  employeeId: string;
  location: string | null;     // free-form location label (Raum, Gebäude, ...)
}
```

---

## Frontend Aggregation (no extra backend hop)

The booking flow needs tenant-scoped themes + slots. The aggregation is done client-side:

```ts
// apps/tagea-frontend/src/app/services/public-tenant-group.service.ts

interface TenantTheme {
  id: string;              // template.id (deduplicated across institutions)
  name: string;
  description: string | null;
  icon: string;
  durationMinutes: number | null;
  institutions: PublicGroupInstitution[];   // all that offer this template
}

interface EnrichedSlot extends PublicAvailableSlot {
  institutionId: string;
  institutionName: string;
  institutionCity?: string;
}

class PublicTenantGroupService {
  // Existing per-institution endpoints
  getGroupInstitutions(slug: string): Observable<PublicGroupInfo>;
  getInstitutionTemplates(slug: string, tenantId: string, institutionId: string): Observable<PublicAppointmentTemplate[]>;
  getTemplateSlots(slug: string, tenantId: string, institutionId: string, templateId: string): Observable<PublicAvailableSlot[]>;

  // Tenant-aggregated wrappers (forkJoin over institutions, dedupe / merge)
  getTenantThemes(slug: string, tenantId: string): Observable<TenantTheme[]>;
  getTenantThemeSlots(slug: string, tenantId: string, theme: TenantTheme): Observable<EnrichedSlot[]>;
}
```

**Aggregation rules:**
- `getTenantThemes`: get all institutions of the tenant → fork-join `getInstitutionTemplates` per institution → group by `template.id` → each template carries the list of institutions that offer it.
- `getTenantThemeSlots`: fork-join `getTemplateSlots` over each `theme.institutions` → flatten → tag each slot with institution → sort by `startDatetime`.

---

## Booking Submission

### `POST /public/booking`

Creates a guest booking. Rate-limited to 5 bookings per hour per IP.

**Body:**

```ts
// apps/tagea-frontend/src/app/services/guest-booking.service.ts
interface GuestBookingRequest {
  groupSlug: string;
  tenantId: string;          // UUID
  institutionId: string;     // UUID
  templateId: string;        // UUID
  employeeId: string;        // UUID — from selected slot
  slotStart: string;         // ISO datetime
  slotEnd: string;           // ISO datetime
  setting: string;           // 'vor-ort' | 'video' | 'telefon' | 'chat'
  slotLocation?: string;     // free-form, taken from slot.location
  firstName: string;         // min 2 chars
  lastName: string;          // min 2 chars
  email: string;             // must include '@'
  phone?: string;            // optional
}

interface GuestBookingResponse {
  success: boolean;
  appointmentId: string;
  confirmationSent: boolean;
}
```

**Error codes:**
- 400 — validation (invalid UUIDs, missing fields, bad setting, name too short, no '@' in email)
- 429 — rate limit exceeded (`Buchungslimit erreicht. Bitte versuchen Sie es später erneut.`)

---

## State Integration

```ts
// apps/tagea-frontend/src/app/core/tenant-resolution.service.ts
class TenantResolutionService {
  readonly tenantInfo: Signal<PublicTenantInfo | null>;
  readonly cloudPickerRequired: Signal<boolean>;       // true → router shows picker
  readonly cloudGroupId: Signal<string | null>;        // UUID after resolve
  readonly cloudGroupSlug: Signal<string | null>;      // slug needed by booking endpoints
  applyCloudSelection(tenantInfo: PublicTenantInfo): Promise<void>;
  clearCloudSelection(): Promise<void>;
}

// apps/tagea-frontend/src/app/core/cloud-tenant-storage.service.ts
class CloudTenantStorageService {
  get(): Promise<string | null>;
  set(tenantId: string): Promise<void>;
  clear(): Promise<void>;
}
```

`CloudTenantStorageService` is single-slot: at most one persisted `tenantId`. Native uses Capacitor `Preferences`, web uses `localStorage` (key `tagea.cloudTenant.selectedId`).

`cloudGroupSlug` is required by all booking endpoints (`POST /public/booking` and `GET /public/tenant/groups/:slug/...`). For Custom-Domain builds it stays `null` — the backend would need to either expose the slug on tenant entities or accept slug-less booking calls. **TODO** Phase-2.

---

## Routing & Guards

```ts
// apps/tagea-frontend/src/app/guards/native-only.guard.ts
export const nativeOnlyGuard: CanActivateFn;   // Web → /select-tenant

// apps/tagea-frontend/src/app/guards/web-only.guard.ts
export const webOnlyGuard: CanActivateFn;       // Native → /onboarding

// apps/tagea-frontend/src/app/guards/root-redirect.guard.ts
export const rootRedirectGuard: CanActivateFn;  // / → /dashboard | /select-tenant | /onboarding | /welcome
```

| Route | Component | Guards |
|---|---|---|
| `/onboarding` | `OnboardingWizardComponent` | `nativeOnlyGuard` |
| `/select-tenant` | `CloudDiscoveryComponent` | `webOnlyGuard` |
| `/welcome` | `LandingPageComponent` (dispatcher → `TenantHomepageComponent` if tenant set) | `redirectIfAuthenticatedGuard` |

Both `/onboarding` and `/select-tenant` are excluded from `redirectIfAuthenticatedGuard.EXCLUDED_PATHS`.

`rootRedirectGuard` order:
1. authenticated → `/dashboard`
2. has refresh token → restore session → `/dashboard`
3. SSO session detected → `/dashboard`
4. `cloudPickerRequired` → `/select-tenant` (web) or `/onboarding` (native)
5. fallthrough → `/welcome`

---

## DEV Cloud-Group Hack

**Gated behind `if (!environment.production)`.** In `tenant-resolution.service.ts`:

- URL param `?cloudGroup=<idOrSlug>` triggers cloud-mode for one boot.
- Persisted to `localStorage['tagea.dev.cloudGroupId']` to survive the post-pick redirect (which strips the query param).
- Removed automatically when `localStorage.clear()` is called.

In production builds, the hack code path is dead — anyone could otherwise flip a standard auth build into cloud-picker mode.

---

## Phase 2 — planned

The following endpoints are **not yet implemented**.

### `POST /public/invitation-code/:code` *(planned)*

Resolves a printed/emailed invitation code to a tenant + (optionally) pre-fills registration.

> Documentation-only shape. Type does not yet exist in source.

```ts
// documentation-only
interface InvitationCodeResult {
  tenantId: string;
  tenantName: string;
  tenantGroupId: string | null;
  // Future: prefillEmail?, prefillRole?, expiresAt
}
```

### `POST /public/qr-code/:token` *(planned)*

Same shape as `InvitationCodeResult`, distinct endpoint to allow per-channel rate-limiting and audit.

> **Flutter port note:** Dart classes for `PublicCloudGroupInfo`, `PublicCloudTenant`, `PublicCloudTenantList`, `PublicTenantInfo`, `PublicGroupInstitution`, `PublicAppointmentTemplate`, `PublicAvailableSlot`, `TenantTheme`, `EnrichedSlot`, `GuestBookingRequest`, and `GuestBookingResponse` must use identical JSON field names. The Flutter Wizard mirrors the Angular state machine; Cloud Discovery and Tenant Homepage are web-only.
