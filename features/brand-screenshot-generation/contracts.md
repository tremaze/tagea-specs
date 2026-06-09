# Contracts: Brand Screenshot Generation

> Wire contracts for the brand-manager screenshots module. All endpoints are admin-only on the brand-manager backend and protected by the existing `X-API-Key` admin guard.

## Persisted Configuration

### `GET /brands/:brandId/screenshots/config`

Returns the persisted screenshot configuration for the brand. If none exists, returns an entry per `brand.tenantIds[]` with empty `screenshotUserUsername` (so the dialog can render the right number of rows).

```typescript
interface BrandScreenshotConfigDto {
  brandId: string;
  tenantConfigs: Array<{
    tenantId: string;
    screenshotUserUsername: string;  // Keycloak preferred_username; empty string if not yet configured
    note: string | null;             // free-text admin note
  }>;
  lastRunAt: string | null;          // ISO 8601
  lastStatus: 'idle' | 'running' | 'success' | 'failed' | 'partial';
}
```

### `PUT /brands/:brandId/screenshots/config`

Replaces the persisted configuration. The body's `tenantConfigs` array must contain exactly one entry per `brand.tenantIds`. Unknown tenant IDs → 400.

```typescript
interface UpdateBrandScreenshotConfigDto {
  tenantConfigs: Array<{
    tenantId: string;
    screenshotUserUsername: string;
    note?: string | null;
  }>;
}
```

Response: `BrandScreenshotConfigDto`.

## Run Lifecycle

### `POST /brands/:brandId/screenshots/trigger`

Validates the configuration, resolves the per-tenant route plan (Token Exchange + `GET /session/v2`), and dispatches the GitHub workflow. Returns the new `runId`.

**Pre-flight validations (run synchronously before workflow dispatch):**

- Brand has ≥ 1 tenant ID.
- Every tenant has a non-empty `screenshotUserUsername` in the persisted config.
- Token Exchange succeeds for every tenant.
- `GET /session/v2` returns a `landing.scope.kind !== 'none'` for every tenant.

Failure of any pre-flight check returns 422 with per-tenant errors; no workflow is dispatched.

Concurrent runs return 409.

```typescript
// Request: empty body (config is read from persisted store)

// Response 200:
interface ScreenshotRunDto {
  id: string;
  brandId: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'partial';
  plan: ResolvedScreenshotPlan;
  githubRunId: number | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ResolvedScreenshotPlan {
  tenants: Array<{
    tenantId: string;
    tenantName: string;             // resolved via tenants-proxy for display
    screenshotUserUsername: string;
    routes: Array<{
      path: string;                 // e.g. "/teamspace" or "/einrichtung/<id>/dashboard"
      label: string;                // e.g. "01-landing"
      devices: Array<{
        platform: 'ios' | 'android';
        deviceClass: string;        // e.g. "iphone-6.7", "phone"
      }>;
    }>;
  }>;
}

// Response 422:
interface TriggerValidationErrorDto {
  errors: Array<{
    tenantId: string;
    code: 'missing_user' | 'token_exchange_failed' | 'no_active_session' | 'unknown_tenant';
    message: string;
  }>;
}

// Response 409:
interface RunInProgressErrorDto {
  message: string;
  currentRunId: string;
}
```

### `GET /brands/:brandId/screenshots/runs`

Returns the most recent runs (default limit 20) for the brand, newest first.

Response: `ScreenshotRunDto[]`.

### `GET /brands/:brandId/screenshots/runs/:runId`

Returns a single run with current status (used for polling by the UI).

Response: `ScreenshotRunDto`.

## CI-Side Callbacks

These endpoints are called by `mobile-screenshots.yml` running in GitHub Actions. They use the same `X-API-Key` auth as the existing build workflow.

### `POST /brands/:brandId/screenshots/runs/:runId/upload`

Multipart upload of a single PNG produced by snapshot/screengrab.

**Form fields:**
- `file`: PNG binary
- `tenantId`: string
- `platform`: `'ios' | 'android'`
- `deviceClass`: string (e.g. `iphone-6.7`)
- `label`: string (e.g. `01-landing`)

**Behavior:** the brand-manager writes the file via `FileStorageService` to:

```
screenshots/<tenantId>/<platform>/<deviceClass>/<label>.png
```

(brand-scoped at the file-storage root; brand-id is implicit in the storage context).

Overwrites any existing file at that path. Returns 200 with the file metadata.

### `POST /brands/:brandId/screenshots/runs/:runId/complete`

Reports the final outcome of the workflow. Body:

```typescript
interface ScreenshotRunCompletionDto {
  success: boolean;
  failureReason?: string;
  perTenantOutcomes?: Array<{
    tenantId: string;
    success: boolean;
    failureReason?: string;
    screenshotsUploaded: number;
  }>;
  workflowRunId: string;
}
```

If `success: true` and all `perTenantOutcomes` succeeded → run status = `success`.
If `success: true` and at least one tenant outcome failed → `partial`.
If `success: false` → `failed` with `failureReason`.

## Entities (Brand-Manager DB)

```typescript
@Entity('brand_screenshot_configs')
class BrandScreenshotConfig {
  @PrimaryGeneratedColumn('uuid') id: string;

  @OneToOne(() => Brand, { onDelete: 'CASCADE' })
  @JoinColumn() brand: Brand;

  @Column('uuid') brandId: string;

  @Column({ type: 'simple-json', default: '[]' })
  tenantConfigs: Array<{
    tenantId: string;
    screenshotUserUsername: string;
    note: string | null;
  }>;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt: Date | null;

  @Column({ default: 'idle' })
  lastStatus: 'idle' | 'running' | 'success' | 'failed' | 'partial';

  @UpdateDateColumn() updatedAt: Date;
}

@Entity('screenshot_runs')
class ScreenshotRun {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Brand, { onDelete: 'CASCADE' })
  brand: Brand;

  @Column('uuid') brandId: string;

  @Column()
  status: 'queued' | 'running' | 'success' | 'failed' | 'partial';

  @Column({ type: 'simple-json' })
  plan: ResolvedScreenshotPlan;

  @Column({ type: 'simple-json', nullable: true })
  perTenantOutcomes: Array<{ tenantId: string; success: boolean; failureReason?: string; screenshotsUploaded: number }> | null;

  @Column({ type: 'bigint', nullable: true })
  githubRunId: number | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn() createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
```

## Token Exchange (Keycloak)

The brand-manager calls Keycloak directly. Request shape (per tenant, both at trigger pre-flight and inside the CI workflow):

```
POST {KEYCLOAK_BASE_URL}/realms/{realm}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=urn:ietf:params:oauth:grant-type:token-exchange
&client_id=brand-manager-screenshots
&client_secret=<from env>
&subject_token=<service_account_access_token>
&requested_subject=<screenshotUserUsername>
&audience=<brand.authClientId>
&requested_token_type=urn:ietf:params:oauth:token-type:access_token
```

The service-account access token is fetched first via `client_credentials`:

```
POST {KEYCLOAK_BASE_URL}/realms/{realm}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=brand-manager-screenshots
&client_secret=<from env>
```

Errors map to per-tenant `token_exchange_failed` with the Keycloak `error_description` carried through.

## Environment Variables

New env vars on the brand-manager backend:

| Variable                              | Purpose                                                          |
| ------------------------------------- | ---------------------------------------------------------------- |
| `KEYCLOAK_BASE_URL`                   | e.g. `https://keycloak.tagea.de`                                 |
| `KEYCLOAK_REALM`                      | Realm the screenshot users live in                               |
| `KEYCLOAK_SCREENSHOT_CLIENT_ID`       | Confidential client name, default `brand-manager-screenshots`    |
| `KEYCLOAK_SCREENSHOT_CLIENT_SECRET`   | Service-account secret                                           |
| `TAGEA_BACKEND_URL`                   | Where the brand-manager fetches `GET /session/v2`                |

Existing vars (already configured):
- `BRAND_MANAGER_API_KEY` — used by the GitHub workflow for callbacks (same key as build flow).

## GitHub Workflow Inputs

`mobile-screenshots.yml` accepts:

```yaml
inputs:
  brand_id: required, string
  run_id: required, string                # brand-manager run id, used in upload/complete callbacks
  plan_b64: required, string              # base64-encoded ResolvedScreenshotPlan JSON
  environment: required, choice [qs, prod]
  branch: optional, string
```

The brand-manager dispatch service base64-encodes the plan JSON, the workflow decodes it at runtime and iterates.
