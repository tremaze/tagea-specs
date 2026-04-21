# Contracts: HTTP Interceptors

> No REST endpoints here — interceptors don't define routes, they mutate outgoing HTTP traffic. This file documents the HTTP headers added, the context tokens consumed, and the URL skip predicates.

## HTTP Headers (added by tenantContextInterceptor)

Exact casing as sent over the wire:

| Header             | Source                                                    | When added                                                                                                   |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `X-Tenant-ID`      | `UnifiedAuthService.tenantId()`                           | Internal API requests, once the employee profile is loaded                                                   |
| `X-Institution-ID` | `INSTITUTION_ID_OVERRIDE` → `authService.institutionId()` | Internal API requests when a non-null institution ID is resolved; explicitly omitted when override is `null` |
| `X-Timezone`       | `Intl.DateTimeFormat().resolvedOptions().timeZone`        | Every internal API request (always)                                                                          |
| `Authorization`    | `@tagea/auth` session store                               | Added by `AUTH_INTERCEPTOR` on every request (internal and external)                                         |

## HttpContext Token — `INSTITUTION_ID_OVERRIDE`

> Source: `apps/tagea-frontend/src/app/interceptors/institution-context.token.ts`

```ts
import { HttpContextToken } from '@angular/common/http';

// Default: undefined (fall back to authService.institutionId()).
// string:    use this exact institution ID for the X-Institution-ID header.
// null:      explicitly omit the X-Institution-ID header.
export const INSTITUTION_ID_OVERRIDE = new HttpContextToken<string | null | undefined>(() => undefined);
```

**Usage:**

```ts
// Override to a specific institution
this.http.get('/api/...', {
  context: new HttpContext().set(INSTITUTION_ID_OVERRIDE, 'other-institution-id'),
});

// Explicitly omit X-Institution-ID
this.http.get('/api/...', {
  context: new HttpContext().set(INSTITUTION_ID_OVERRIDE, null),
});
```

## Skip-URL predicates (tenantContextInterceptor)

Evaluated in order; first match wins. All predicates are applied to the full `req.url`.

```ts
// 1. External URL (Keycloak, Matrix, etc.) — anything not on our API host.
!req.url.startsWith(apiUrl); // apiUrl = environment.apiUrl || 'http://localhost:3000'

// 2. Bootstrap endpoint. endsWith (not includes) so /auth/current-institution is NOT skipped.
req.url.endsWith('/auth/current');

// 3. Password-reset flow.
req.url.includes('/public/password-reset');

// 4. Public tenant / client branding endpoints.
req.url.includes('/public/tenant/');
req.url.includes('/public/clients/');
```

When any predicate matches, the interceptor forwards the request with no additions (not even `X-Timezone`).

## Sentry fingerprint shape (sentryHttpContextInterceptor)

```ts
// Source: apps/tagea-frontend/src/app/interceptors/sentry-http-context.interceptor.ts
scope.setFingerprint([
  'http-error',
  req.method, // 'GET' | 'POST' | ...
  String(error.status), // e.g. '500'
  normalizeUrlPath(req.urlWithParams), // e.g. '/api/appointments/:id/occurrences/:id'
]);
```

## Sensitive-key filter list

> Documentation-only shape. Literal set used by `sanitizePii()` in `sentry-http-context.interceptor.ts` when walking request/response bodies. Matching is case-insensitive and ignores `-` / `_` separators.

```ts
// documentation-only
const SENSITIVE_KEYS = new Set(['password', 'passwort', 'token', 'secret', 'authorization', 'cookie', 'session', 'credit_card', 'creditcard', 'iban', 'ssn', 'access_token', 'refresh_token', 'api_key', 'apikey']);
```

## Sanitization limits

> Documentation-only shape. Constants defined alongside `sanitizePii()`; values tuned so Sentry events stay small.

```ts
// documentation-only
const MAX_STRING_LENGTH = 1024; // strings truncated with '...[truncated]'
const MAX_DEPTH = 5; // deeper values become '[Max depth exceeded]'
const MAX_ARRAY_ITEMS = 20; // inline constant: data.slice(0, 20)
const FILTERED = '[Filtered]'; // replacement for sensitive-key values
```

## URL normalization regexes

> Documentation-only shape. Used by `normalizeUrlPath()` for Sentry fingerprinting and the `HttpError` message.

```ts
// documentation-only
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const NUMERIC_SEGMENT_RE = /\/\d+(?=\/|$)/g;
```

## Interceptor registration order

> Documentation-only shape. Extracted from `core.module.ts`. Angular applies interceptors in array order on the request and reverse order on the response.

```ts
// documentation-only
provideHttpClient(
  withInterceptors([
    AUTH_INTERCEPTOR, // from @tagea/auth
    tenantContextInterceptor,
    sentryHttpContextInterceptor,
  ]),
);
```

## Flutter port note

```dart
// Dart / Dio equivalent sketch — not a literal port target.
final dio = Dio()
  ..interceptors.add(AuthInterceptor())          // mirrors @tagea/auth: Bearer + refresh-on-401 + single retry
  ..interceptors.add(TenantContextInterceptor()) // adds X-Tenant-ID, X-Institution-ID, X-Timezone with the same skip rules
  ..interceptors.add(SentryHttpInterceptor());   // captures 400+ with PII-sanitized payloads
```

The Dart tenant interceptor must reproduce the same four skip predicates byte-for-byte (external host, `endsWith('/auth/current')`, `/public/password-reset`, `/public/tenant/` and `/public/clients/`) and the same 5-second wait-for-tenant behavior.
