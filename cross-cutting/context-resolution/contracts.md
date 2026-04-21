# Contracts: Context Resolution

> API endpoints, DTOs, and the frontend service surface that every feature consumes.

## Service Map (Frontend)

Frontend-local state lives in five singletons, all `@Injectable({ providedIn: 'root' })`. Public surface is Angular **signals** (preferred) and a handful of async methods for mutations.

### `UnifiedAuthService`

Central orchestrator. Fronts the OIDC session (`@tagea/auth`) with a higher-level store of employee + permission + superadmin state, and owns the context-switch methods.

Populated by `loadEmployeeProfile()` (triggered reactively when OIDC becomes authenticated) and by `setCurrentTenant()` / `setInstitutionFromUrl()` on switches.

Public signals / computeds:

```ts
// documentation-only
interface UnifiedAuthServiceSurface {
  isAuthenticated: Signal<boolean>; // true once profile loaded successfully
  isAuthResolved: Signal<boolean>; // hasBegunLoading && !isLoading — safe guard gate
  isLoading: Signal<boolean>;
  employee: Signal<Employee | null>; // camelCase shape below
  permissions: Signal<string[]>; // mirrors AuthorizationStore.effectivePermissions
  institutionId: Signal<string | null>; // re-exported from InstitutionContextService
  isSuperAdmin: Signal<boolean>;
  isTenantAdmin: Signal<boolean>;
  isSchulungAdmin: Signal<boolean>;
  hasInstitutionAssignments: Signal<boolean>;
  hasCounselingInstitutions: Signal<boolean>;
  profileLoadError: Signal<string | null>; // 'NO_TENANT_ASSIGNMENT' | 'EMAIL_NOT_VERIFIED' | 'SESSION_EXPIRED' | raw message
  pushBrandId: Signal<string | null>;
  userName: Signal<string>; // computed: "First Last" or OIDC-claim fallback
  userEmail: Signal<string>; // computed
  userRole: Signal<string>; // computed: employee.role
  tenantId: Signal<string>; // computed: employee.tenantId
  userType: Signal<'client' | 'employee'>; // from /auth/current payload
  isClient: Signal<boolean>;
  isEmployee: Signal<boolean>;
}
```

Key methods:

```ts
class UnifiedAuthService {
  login(): Promise<void>;
  logout(): Promise<void>;
  ensureAuthenticated(): Promise<boolean>;
  ensureProfileLoaded(): Promise<void>; // APP_INITIALIZER helper
  checkAuthStatus(): Promise<boolean>;
  getAccessToken(): string | null;

  hasPermission(permission: string): boolean;
  hasAnyPermission(permissions: string[]): boolean;
  hasAllPermissions(permissions: string[]): boolean;
  hasTenantPermission(permission: string): boolean; // ignores active-institution scoping

  setCurrentTenant(tenantId: string): Promise<void>;
  setCurrentInstitution(institutionId: string | null): Promise<void>;
  setInstitutionFromUrl(institutionId: string): void;

  refreshTokens(): Promise<unknown>;
  ensureSilentRefreshActive(): void;
}
```

### `AuthorizationStore` (RBAC v2)

Single source of truth for permission evaluation. Loaded once during bootstrap; updates `activeInstitutionId` on each URL-driven switch. `effectivePermissions` is a `computed()` that recomputes automatically.

```ts
class AuthorizationStore {
  readonly isLoaded: Signal<boolean>;
  readonly context: Signal<AuthContextResponse | null>;
  readonly activeInstitutionId: Signal<string | null>;

  readonly isSuperAdmin: Signal<boolean>;
  readonly isTenantAdmin: Signal<boolean>;

  readonly effectivePermissions: Signal<string[]>;
  readonly tenantPermissions: Signal<string[]>;
  readonly accessibleInstitutionIds: Signal<string[]>;
  readonly hasAccessibleInstitutions: Signal<boolean>;

  hasInstitutionAccess(institutionId: string): boolean;
  loadContext(): Promise<boolean>;
  switchInstitution(institutionId: string): void; // emits ContextChangeEvent
  setActiveInstitutionId(id: string | null): void; // silent (no event)
  clear(): void;
}
```

Evaluation order of `effectivePermissions`:

1. If `activeInstitutionId` is set → return `context.institutions[id].permissions`.
2. Else if there is any institution at all → use the first one (deterministic fallback so guards don't flicker).
3. Else merge `tenant.role.permissions` with every `teamspaces[*].permissions` into a `Set` and return it as an array.

`tenantPermissions` returns `clientPermissions` for clients; otherwise `tenant.role.permissions`.

### `InstitutionContextService`

The one-and-only holder of the active-institution state. A tiny signal wrapper so the HTTP interceptor, top-bar, and authorization store can all read the same reference.

```ts
class InstitutionContextService {
  readonly institutionId: Signal<string | null>;
  setInstitutionId(id: string | null): void;
}
```

### `TenantFeaturesService`

Tenant-level feature-flag registry. Populated synchronously from the `/auth/current` chain (`setFeatures(…)`). Also owns a cached tenant-logo URL with a 30-minute TTL.

```ts
class TenantFeaturesService {
  readonly features: Signal<TenantFeatures | null>;
  readonly loading: Signal<boolean>;
  readonly logoUrl: Signal<string | null>;

  readonly isFinancialSupportEnabled: Signal<boolean>;
  readonly isCaseManagementEnabled: Signal<boolean>;
  readonly isReportsEnabled: Signal<boolean>;
  readonly isBillingEnabled: Signal<boolean>;
  readonly billingProvider: Signal<string>;
  readonly isDepartmentsEnabled: Signal<boolean>;
  readonly isInstitutionsEnabled: Signal<boolean>;
  readonly isClientPortalEnabled: Signal<boolean>;
  readonly isChatEnabled: Signal<boolean>;
  readonly isTeamspaceEnabled: Signal<boolean>;
  readonly isCariDataEnabled: Signal<boolean>;
  readonly isTasksEnabled: Signal<boolean>;
  readonly isOutlookCalendarSyncEnabled: Signal<boolean>;
  readonly isVideoMeetingEnabled: Signal<boolean>;
  readonly videoMeetingProvider: Signal<string>;
  readonly isClientMessagesEnabled: Signal<boolean>;
  readonly isProofOfSalaryEnabled: Signal<boolean>;
  readonly isMultilingualEnabled: Signal<boolean>;
  readonly isAiChatEnabled: Signal<boolean>;
  readonly isKnowledgeModeOnly: Signal<boolean>;
  readonly isSchulungenEnabled: Signal<boolean>;
  readonly isTimeTrackingEnabled: Signal<boolean>;
  readonly isVivendiSyncEnabled: Signal<boolean>;
  readonly isDatevExportEnabled: Signal<boolean>;
  readonly isPepEnabled: Signal<boolean>;
  readonly isFileStorageEnabled: Signal<boolean>;
  readonly isClientReportsEnabled: Signal<boolean>;
  readonly isAiDocumentationEnabled: Signal<boolean>;

  loadFeatures(): void; // manual refresh (rarely needed)
  refreshFeatures(): Observable<TenantFeatures>;
  setFeatures(features: TenantFeatures): void; // used by UnifiedAuthService
  clearFeatures(): void; // used on logout
  isFeatureEnabled(featureName: keyof TenantFeatures): boolean;

  loadLogoUrl(): Promise<string | null>; // 30-minute cache
  refreshLogoUrl(): Promise<string | null>; // bypass cache
  clearLogoCache(): void;
}
```

### `CurrentEmployeeService` (legacy wrapper)

`BehaviorSubject` bridge that exposes the employee as the **snake_case** `Employee` model (for older consumers). Driven by an `effect()` on `UnifiedAuthService.employee()`; it maps camelCase → snake_case. Do not mutate directly — update flows through `UnifiedAuthService`.

```ts
class CurrentEmployeeService {
  currentEmployee$: Observable<Employee | null>;

  getCurrentEmployee(): Employee | null;
  getCurrentEmployeeId(): string | null;
  getCurrentEmployeeName(): string;
  getDefaultEmployeeId(): string | null;
  refreshCurrentEmployee(): Promise<void>;
  waitForCurrentEmployee(): Promise<Employee | null>;
  enrichEmployeeOptionsWithCurrent(options: { value: string; label: string }[], markAsCurrent?: boolean): { value: string; label: string }[];
  hasProofOfSalaryAccess(): boolean;
}
```

### `ContextChangeService`

Broadcast channel for "the context just changed, you may want to refetch". A single signal holds the last event; page components watch it in an `effect()`.

```ts
type ContextChangeType = 'tenant' | 'institution';

interface ContextChangeEvent {
  type: ContextChangeType;
  previousId: string | null;
  newId: string;
  timestamp: number;
  metadata?: {
    previousName?: string;
    newName?: string;
    triggeredBy?: string;
  };
}

class ContextChangeService {
  readonly contextChange: Signal<ContextChangeEvent | null>;
  notifyContextChange(event: ContextChangeEvent): void;
  getLastChange(): ContextChangeEvent | null;
}
```

Today only `AuthorizationStore.switchInstitution()` emits on this channel. Tenant switches reload the page, so a broadcast is unnecessary there.

## Data Models

### Employee (UnifiedAuthService-internal, camelCase)

```ts
// apps/tagea-frontend/src/app/services/unified-auth.service.ts
interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string; // tenant role name, or client.category for clients
  phone?: string;
  department: string;
  position: string;
  tenantId: string;
  status: string;
  authProviderUserId?: string;
  emailVisible?: boolean;
  phoneVisible?: boolean;
  notification_preferences_seen?: boolean;
}
```

`userType` is read off the employee object (the backend tags the payload with `'employee'` or `'client'`) — it is not declared on the TS interface above, but consumers rely on it. See `auth-context-response.dto.ts` on the backend for the full shape.

### `AuthContextResponse` (RBAC v2)

```ts
// apps/tagea-frontend/src/app/models/authorization-context.model.ts
interface InstitutionRoleDto {
  id: string;
  name: string;
  displayName: string;
  hierarchyLevel: number;
  isStandard: boolean;
}

interface InstitutionAuthDto {
  institutionId: string;
  role: InstitutionRoleDto;
  permissions: string[];
  deniedTenantPermissions: string[];
}

interface TeamspaceRoleDto {
  id: string;
  name: string;
  displayName: string;
  hierarchyLevel: number;
}

interface TeamspaceAuthDto {
  teamspaceId: string;
  role: TeamspaceRoleDto;
  permissions: string[];
  scopedInstitutionIds: string[];
}

interface AuthContextResponse {
  elevation: { isSuperAdmin: boolean; isTenantAdmin: boolean };
  tenant: {
    tenantId: string;
    role: { id: string; name: string; permissions: string[] } | null;
  };
  institutions: Record<string, InstitutionAuthDto>;
  teamspaces: Record<string, TeamspaceAuthDto>;
  clientPermissions: string[] | null;
}
```

### `TenantFeatures`

```ts
// apps/tagea-frontend/src/app/services/tenant-features.service.ts
interface TenantFeature {
  enabled: boolean;
  displayName?: string;
}

interface AiChatFeature extends TenantFeature {
  knowledgeModeOnly?: boolean;
}

interface TimeTrackingFeature extends TenantFeature {
  provider?: string;
}

interface BillingFeature extends TenantFeature {
  provider?: string;
}

interface VideoMeetingFeature extends TenantFeature {
  provider?: string;
}

interface TenantFeatures {
  financialSupport?: TenantFeature;
  caseManagement?: TenantFeature;
  reports?: TenantFeature;
  billing?: BillingFeature;
  departments?: TenantFeature;
  institutions?: TenantFeature;
  clientPortal?: TenantFeature;
  chat?: TenantFeature;
  teamspace?: TenantFeature;
  cariData?: TenantFeature;
  tasks?: TenantFeature;
  outlookCalendarSync?: TenantFeature;
  videoMeeting?: VideoMeetingFeature;
  clientMessages?: TenantFeature;
  proofOfSalary?: TenantFeature;
  multilingual?: TenantFeature;
  aiChat?: AiChatFeature;
  schulungen?: TenantFeature;
  employeeRegistration?: TenantFeature;
  clientRegistration?: TenantFeature;
  clientSelfRegistration?: TenantFeature;
  timeTracking?: TimeTrackingFeature;
  vivendiSync?: TenantFeature;
  datevExport?: TenantFeature;
  pep?: TenantFeature;
  fileStorage?: TenantFeature;
  clientReports?: TenantFeature;
  aiDocumentation?: TenantFeature;
}
```

Each optional field follows the `TenantFeature`-extending shape. Unknown features default to disabled when `features()` is `null` (not yet loaded).

## Backend Endpoints

All routes on the `@Controller('auth')` in `apps/tagea-backend/src/auth/auth.controller.ts` unless noted.

### `GET /auth/current` — bootstrap

Resolves the calling user to a tenant and principal. Auto-provisions a default tenant for the first-ever user (empty system); for SSO users with `vivendiSync + microsoftSync` enabled, may auto-onboard via Microsoft Graph `employeeId` + Vivendi.

**Response (employee):**

```ts
// documentation-only
interface AuthCurrentEmployeeResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    tenantId: string;
    status: string;
    authProviderUserId?: string;
    userType: 'employee';
    personnelNumber?: string;
    accessProofOfSalary?: boolean;
    emailVisible?: boolean;
    phoneVisible?: boolean;
    notification_preferences_seen?: boolean;
  };
  currentTenant: string;
  availableTenants: Array<{ id: string; name: string; role: string }>;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  hasInstitutionAssignments: boolean;
  hasCounselingInstitutions: boolean;
}
```

**Response (client):** same shape but `userType: 'client'`, adds `category`, `emailVerified`, `loginEnabled`; omits `hasCounselingInstitutions`.

**Error codes:**

- `401` — no authenticated user.
- `403` — `Email not verified` (frontend maps to `EMAIL_NOT_VERIFIED`); or `Vivendi sync required` variants (German message).
- `404` — `No tenant association found for user` / `User profile not found`.

**Cache headers:** `Cache-Control: no-store, no-cache, must-revalidate, private` (forced to keep tenant switches consistent).

### `POST /auth/current-tenant` — tenant switch

```ts
// documentation-only
interface SetCurrentTenantDto {
  tenantId: string;
}
```

Validates that `tenantId` is in the caller's `AuthUserTenant` mappings and that a principal exists there. Updates the `last_used_at` timestamp on the mapping. Returns the same shape as `/auth/current` (minus the counseling/institution-assignment flags).

**Error codes:** `401` unauthorized tenant, `404` no principal in tenant.

### `GET /auth/me/tenants` — list tenants for current user

Returns all tenants the user has an `AuthUserTenant` mapping for, plus a `currentTenantId` indicating which one the request resolved against.

```ts
// documentation-only
interface MyTenantsResponse {
  tenants: Array<{ id: string; name: string; role: string; isCurrent: boolean }>;
  currentTenantId: string | null;
}
```

### `GET /auth/me/institutions` — list institutions assigned to the current user

Employees only. Returns only institutions with `is_active && isCounselingModeEnabled`. Tenant admins see every active+counseling institution in the tenant.

Response: `Institution[]` (backend entity).

### `GET /auth/me/departments` — list departments assigned to the current user

Employees only. Returns only active departments.

### `POST /auth/current-institution` — institution switch (non-URL)

```ts
// documentation-only
interface SetCurrentInstitutionDto {
  institutionId: string | null;
}
```

Passing `null` clears the context ("view all"). Requires assignment unless the user is `isTenantAdmin`. Persists `lastUsedInstitution` for the employee (so the next login can preselect).

**Response:**

```ts
// documentation-only
interface SetCurrentInstitutionResponse {
  success: boolean;
  institutionId: string | null;
  institutionName: string | null;
}
```

**Error codes:** `400` not assigned / not active / counseling mode disabled.

### `GET /auth/me/permissions` — flat permission list

Returns the union of (a) all institution permissions across every assigned institution, (b) tenant role permissions, and (c) client permissions if applicable. Sorted alphabetically. Used as a legacy path; most consumers now read `AuthorizationStore.effectivePermissions()` instead.

### `GET /auth/context` — RBAC v2

Returns the full `AuthContextResponse` (see data-model section). This is the one endpoint the `AuthorizationStore` hits during bootstrap and after tenant switches.

### `GET /tenants/current/features` — feature flags

Returns a `TenantFeatures` object. Resolved via `apiConfig.getApiUrl('tenants/current/features')` on the frontend. On failure the frontend substitutes a minimal all-disabled defaults object.

### `GET /tenants/current/push-brand` — push-notification brand

Returns `{ brandId: string | null }`. Consumed by `UnifiedAuthService` during bootstrap; stored in `pushBrandId` for the push-registration path (`cross-cutting/bootstrap-and-push`).

### `GET /tenants/current/logo` — tenant logo URL

Returns `{ url: string | null }`. Called lazily by `TenantFeaturesService.loadLogoUrl()` with a 30-minute cache.

## Events (Frontend-internal)

Only one channel: `ContextChangeService.contextChange`, defined above. Emits on institution switch via `AuthorizationStore.switchInstitution`. Backend push / websocket events are out of scope here.

> **Flutter port note:** The corresponding Dart classes must respect the same JSON field names and nullability as the `AuthContextResponse` / `TenantFeatures` shapes above. Signals map most naturally to Riverpod `StateNotifier` providers; `ContextChangeService` fits a `StreamController<ContextChangeEvent>`.
