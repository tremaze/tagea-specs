# Parity: HTTP Interceptors

## Angular

- **Status:** ✅ Implemented
- **Paths:**
  - `apps/tagea-frontend/src/app/core/core.module.ts` (chain registration)
  - `apps/tagea-frontend/src/app/interceptors/tenant-context.interceptor.ts`
  - `apps/tagea-frontend/src/app/interceptors/sentry-http-context.interceptor.ts`
  - `apps/tagea-frontend/src/app/interceptors/institution-context.token.ts`
- **External library:** `@tagea/auth` (provides `AUTH_INTERCEPTOR`)
- **E2E:** no direct tests; header behavior is exercised by every authenticated e2e flow under `apps/tagea-frontend-e2e/src/`.

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/core/http/` _(in tagea-flutter repo — suggested home for a `DioInterceptor` trio)_
- **Integration tests:** `integration_test/http/` — verify bearer attachment, tenant headers on internal calls, skip behavior for public endpoints.

## Known Divergences

- **Auth library:** `@tagea/auth` is TypeScript-only. Flutter will implement the equivalent using `flutter_appauth` + a Dio interceptor; observable behavior (Bearer attachment, single retry on 401 after refresh) must match.
- **Timezone source:** Angular uses `Intl.DateTimeFormat().resolvedOptions().timeZone`. Flutter should use the `timezone` package or `DateTime.now().timeZoneName` — both must produce IANA zone strings (`Europe/Berlin`) rather than abbreviations (`CEST`).
- **PII sanitization constants** (`SENSITIVE_KEYS`, `MAX_DEPTH = 5`, `MAX_STRING_LENGTH = 1024`, array cap 20) must be mirrored exactly in the Flutter Sentry interceptor.
- **HttpContext tokens** have no direct Dart analogue. The Flutter port should expose a per-request `Options(extra: {'institutionIdOverride': ...})` convention with the same three-state semantics (`null` = omit, `String` = override, absent = default).
- **Sentry fingerprint tuple** must stay identical so errors cluster cross-platform: `['http-error', method, status, normalizedPath]`.

## Port Log

| Date       | Who      | What                                                                  |
| ---------- | -------- | --------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec bundle authored from Angular source (spec / contracts / parity). |
