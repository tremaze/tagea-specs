# Feature: HTTP Interceptors

> **Status:** ✅ Specified
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

Every outgoing request to the Tagea backend passes through a fixed chain of HTTP middleware that attaches authentication, tenant context, and error telemetry. The chain is defined once in `core.module.ts` and applies uniformly to all services — feature code never constructs auth headers, tenant IDs, or Sentry scopes by hand.

## Interceptor Chain

Registered via `provideHttpClient(withInterceptors([...]))` in `apps/tagea-frontend/src/app/core/core.module.ts`. Angular runs them left-to-right on the request and right-to-left on the response.

| #   | Interceptor                    | Source                                                                        | Adds on request                                                           | Handles on response                                                              |
| --- | ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | `AUTH_INTERCEPTOR`             | `@tagea/auth` (external library)                                              | `Authorization: Bearer <access_token>`                                    | On 401: refresh token, retry the request once                                    |
| 2   | `tenantContextInterceptor`     | `apps/tagea-frontend/src/app/interceptors/tenant-context.interceptor.ts`      | `X-Tenant-ID`, `X-Institution-ID`, `X-Timezone` (conditional — see below) | Passthrough                                                                      |
| 3   | `sentryHttpContextInterceptor` | `apps/tagea-frontend/src/app/interceptors/sentry-http-context.interceptor.ts` | Passthrough                                                               | On status ≥ 400: capture Sentry event with PII-sanitized request/response bodies |

## Flow Diagram

```
Request
  │
  ▼ AUTH_INTERCEPTOR            → adds Authorization: Bearer <token>
  │
  ▼ tenantContextInterceptor    → adds X-Tenant-ID, X-Institution-ID, X-Timezone (conditional)
  │
  ▼ sentryHttpContextInterceptor → passthrough
  │
  ▼ Backend
  │
  ▲ sentryHttpContextInterceptor → on status ≥ 400: capture Sentry event (PII-sanitized)
  │
  ▲ tenantContextInterceptor    → passthrough
  │
  ▲ AUTH_INTERCEPTOR            → on 401: refresh token + retry
  │
Response (or thrown error)
```

## Interceptor 1 — AUTH_INTERCEPTOR

**Provenance:** Imported as a symbol from `@tagea/auth`. Its implementation lives outside this repository; the frontend treats it as a black box and should not replicate its internals.

**Observable behavior:**

- Reads the current OIDC access token from the auth library's session store.
- Attaches it as `Authorization: Bearer <access_token>` to every outgoing request (including external URLs — it does not discriminate by host).
- When the downstream backend responds with `401 Unauthorized`, the interceptor attempts an automatic token refresh. On success it retries the original request exactly once with the new token; on failure the 401 propagates to the caller.

**Non-goals for this spec:** Refresh-token rotation, storage, PKCE flows, and platform differences (web vs. native Capacitor) are documented in the `@tagea/auth` package, not here.

**Flutter port note:** The Flutter app should install an equivalent Dio interceptor (e.g. via `dio_interceptor` / `flutter_appauth`) that attaches the bearer token and performs a single retry after refresh on 401. Behavior must match: one retry, not an unbounded loop.

## Interceptor 2 — tenantContextInterceptor

**Purpose:** Inject multi-tenant context headers on all requests to the Tagea backend so that backend guards can scope queries to the current tenant / institution without the frontend having to encode those IDs in each URL or body.

### Skip rules (evaluated top-to-bottom, first match wins)

The interceptor short-circuits to `next(req)` — adding **no headers at all** — when any of these match the outgoing `req.url`:

1. URL does **not** start with `environment.apiUrl` (falls back to `http://localhost:3000` when unset). This covers Keycloak, Matrix, and every other external host.
2. URL ends with `/auth/current` (bootstrap endpoint that loads the employee profile — tenant is resolved server-side from the JWT + `last_used_at` in the meta DB).
3. URL includes `/public/password-reset`.
4. URL includes `/public/tenant/` or `/public/clients/`.

> **Note:** The `/auth/current` check uses `endsWith` specifically so it does not also match `/auth/current-institution`, which **is** tenant-scoped.

### Header assembly (for non-skipped requests)

Always-included:

- `X-Timezone: <value>` — from `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser's IANA zone, e.g. `Europe/Berlin`).

Conditionally included (depend on whether tenant/institution are resolved):

- `X-Tenant-ID: <value>` — from `UnifiedAuthService.tenantId()` (a signal that resolves after the employee profile is loaded).
- `X-Institution-ID: <value>` — resolution order:
  1. If the request's `HttpContext` sets `INSTITUTION_ID_OVERRIDE` to a `string`, that value is used.
  2. If the override is `null`, the header is explicitly **omitted** (even when an institution is otherwise available).
  3. Otherwise the header comes from `UnifiedAuthService.institutionId()` (delegated to `InstitutionContextService`).

### Race-condition handling

When `tenantId()` is already populated at interception time, headers are added synchronously and the request is forwarded.

When `tenantId()` is still empty (request fires before the employee profile has loaded), the interceptor subscribes to `toObservable(authService.employee)` and:

- Filters for the first emission where `employee` is non-null and carries a truthy `tenantId`.
- Waits up to **5 seconds** via `timeout(5000)`.
- On resolution: clones the request with the assembled headers and forwards.
- On timeout (or any upstream error): logs a `console.warn` and forwards the request with **only** `X-Timezone` — no `X-Tenant-ID`, no `X-Institution-ID`. The backend may then respond with 401, which `AUTH_INTERCEPTOR` can opt to refresh.

## Interceptor 3 — sentryHttpContextInterceptor

**Purpose:** Attach rich request/response context to Sentry events for any HTTP error, while scrubbing PII.

### Trigger

Runs the capture branch when a response has status **≥ 400**. Successful responses pass through untouched. The original error is always re-thrown so downstream `.subscribe()` callers see the same `HttpErrorResponse` they would without the interceptor.

### Captured data (per error)

- `scope.setTag('http_status', <status>)`.
- `scope.setFingerprint(['http-error', <method>, <status>, <normalized-path>])` — groups similar errors together in Sentry regardless of parametric path segments.
- Event `request` block: `{ method, url: req.urlWithParams, data: <sanitized body> }`.
- Event `contexts.response`: `{ status_code, data: <sanitized error payload> }`.
- A custom `HttpError` exception with name `HttpError <status>` and message `<method> <normalizedPath> failed with status <status>`.

### URL normalization (for fingerprinting and error messages)

`normalizeUrlPath(url)` applies these substitutions to the URL's pathname:

- UUID v4 segments → `:id` (regex `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi`).
- Numeric segments like `/42/` → `/:id/` (regex `/\/\d+(?=\/|$)/g`).
- Falls back to the raw string if `new URL(url)` throws.

### PII sanitization (`sanitizePii`)

Applied recursively to both request body and response body. Guarantees:

- **Sensitive keys** are replaced with `"[Filtered]"`. Key matching is case-insensitive and strips `-` and `_`. The set is:
  `password`, `passwort`, `token`, `secret`, `authorization`, `cookie`, `session`, `credit_card`, `creditcard`, `iban`, `ssn`, `access_token`, `refresh_token`, `api_key`, `apikey`.
- **Emails inside strings** are masked to `<first-char>***@...` (regex matches local-parts up to the `@`).
- **Strings** are truncated to 1024 chars with a `...[truncated]` suffix.
- **Arrays** are truncated to 20 items.
- **Recursion depth** is capped at 5; deeper values become `"[Max depth exceeded]"`.
- **Non-plain objects** (classes, maps, etc.) become `"[Non-serializable]"`.

## Acceptance Criteria

- [ ] **Given** a user logged in with a resolved tenant, **when** they issue a `GET /api/appointments`, **then** the outgoing request carries `Authorization: Bearer …`, `X-Tenant-ID`, `X-Institution-ID`, and `X-Timezone`.
- [ ] **Given** the employee profile has not yet loaded, **when** any internal API request fires, **then** the interceptor delays the request up to 5 seconds waiting for `tenantId`, and sends it with the real tenant header as soon as it appears.
- [ ] **Given** the employee profile never loads within 5 seconds, **when** an internal API request fires, **then** the request is sent with only `X-Timezone` and a console warning is logged.
- [ ] **Given** a request targets Keycloak (not `environment.apiUrl`), **when** it goes through the chain, **then** only `Authorization` is added — no `X-Tenant-ID` / `X-Institution-ID` / `X-Timezone`.
- [ ] **Given** a request targets `GET /public/tenant/<slug>`, **when** it goes through the chain, **then** no tenant headers are added (public endpoints resolve tenant via query string `?domain=…` when needed).
- [ ] **Given** a caller sets `req.context.set(INSTITUTION_ID_OVERRIDE, 'other-institution-id')`, **when** the request fires, **then** `X-Institution-ID` equals the override regardless of the current institution signal.
- [ ] **Given** a caller sets `req.context.set(INSTITUTION_ID_OVERRIDE, null)`, **when** the request fires, **then** `X-Institution-ID` is entirely absent from the headers.
- [ ] **Given** the backend returns `401` on an internal API call, **when** the response flows back up the chain, **then** `AUTH_INTERCEPTOR` refreshes the token and retries exactly once.
- [ ] **Given** the backend returns `500`, **when** the response flows back, **then** Sentry receives an event named `HttpError 500` with fingerprint `['http-error', <method>, '500', <normalized path>]` and PII-sanitized bodies.
- [ ] **Given** a request body contains `{ email: "alice@example.com", password: "p4ss" }`, **when** an error is captured, **then** the Sentry event shows `email: "a***@example.com"` and `password: "[Filtered]"`.
- [ ] **Given** an error URL path is `/api/appointments/7a3b.../occurrences/42`, **when** fingerprinted, **then** the stored fingerprint path is `/api/appointments/:id/occurrences/:id`.

## Non-Goals

- Caching, deduplication, or retry logic for non-401 errors (no backoff, no circuit breaker).
- Request cancellation / rate limiting — those belong to feature services.
- Mutating the response body (sanitization is Sentry-scope only; the caller still sees the original body).
- Replacing Sentry's `httpClientIntegration` in full — we use this interceptor because the default integration cannot capture request/response bodies; breadcrumbs from the default integration remain untouched.
- Implementation internals of `AUTH_INTERCEPTOR` — covered by the `@tagea/auth` library.

## Edge Cases

- **Multiple concurrent requests before tenant loads:** each request independently subscribes to `toObservable(authService.employee)`; all resolve on the same emission. Angular tears down the subscriptions after the first matching emit due to `take(1)`.
- **`tenantId()` resolves then logs out:** a later request sees `tenantId()` empty again, re-enters the wait path, and will time out (since no new employee emits).
- **Override set but no institution available:** `INSTITUTION_ID_OVERRIDE = 'x'` always wins; even in the post-wait branch the override is re-read from `req.context`.
- **Extremely large error body:** recursion depth 5, array truncation at 20, string truncation at 1024 keep Sentry events well under payload limits.
- **Circular references / class instances in bodies:** `isPlainObject` rejects anything whose prototype is not `Object.prototype`, replacing it with `"[Non-serializable]"` — prevents `JSON.stringify` cycles.
- **Keycloak 401:** `AUTH_INTERCEPTOR` handles refresh; tenant interceptor never saw the request in the first place so no header leaks.

## Permissions & Tenant/Institution

- **Required roles:** none — interceptors apply to every authenticated caller. They are the mechanism by which tenant/institution scope is enforced.
- **Institution context:** `X-Institution-ID` is optional at the header level; backend guards treat a missing header as "no specific institution selected". The `INSTITUTION_ID_OVERRIDE` token is the sanctioned way to deviate per-request without mutating the global signal.
- **Backend access checks:** Backend rejects internal API requests with missing `X-Tenant-ID` after `/auth/current` (401 or 404). Frontend relies on the refresh/retry logic of `AUTH_INTERCEPTOR` to recover from transient 401s caused by race conditions.

## i18n Keys

None — interceptors produce no user-facing strings. The `console.warn` in the timeout path is a developer-only diagnostic and is not translated.

## Offline Behavior

No offline handling at the interceptor layer. Requests that fail with `status === 0` are still captured by `sentryHttpContextInterceptor` (since `0 < 400` evaluates false, the check `error.status >= 400` excludes pure network failures — they bubble up unrecorded). Any request queueing is a feature-level concern.

## References

- **Angular implementation:**
  - `apps/tagea-frontend/src/app/core/core.module.ts` (chain registration, comments at lines 54–57)
  - `apps/tagea-frontend/src/app/interceptors/tenant-context.interceptor.ts`
  - `apps/tagea-frontend/src/app/interceptors/sentry-http-context.interceptor.ts`
  - `apps/tagea-frontend/src/app/interceptors/institution-context.token.ts`
- **External library:** `@tagea/auth` — `AUTH_INTERCEPTOR` symbol
- **E2E tests:** n/a (header behavior is not directly asserted by e2e; covered indirectly via any logged-in flow)
- **Contracts:** see [contracts.md](./contracts.md)
