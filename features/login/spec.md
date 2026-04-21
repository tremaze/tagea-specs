# Feature: Login

> **Status:** 🚧 Spec in progress — pilot for workflow calibration
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Users authenticate via a Keycloak redirect. On startup the app checks whether a valid session exists; if not, it routes the user to a public landing page from which the IdP redirect is initiated. After a successful sign-in the user lands on their institution's dashboard.

> **Routing note:** The `/login` path **does** exist in `PUBLIC_ROUTES` but only as a redirect to `/auth/callback` — no component renders at `/login`. The authoritative entry-decision logic lives in `rootRedirectGuard` (on the empty-path route), and the public landing page where users initiate an explicit IdP login is `/welcome` → `LandingPageComponent`. The two `LoginComponent` files under `pages/login/` and `components/login/` exist in the codebase but are not mounted by any route — they are vestigial.

## User Stories

- As an **invited user** I want to be redirected to sign-in directly via an invitation link, so that I can reach the app without extra steps.
- As a **user who just completed onboarding** I want a brief confirmation before being redirected to sign-in, so that I understand what is happening.
- As an **already authenticated user** I want to land on the dashboard immediately when opening the app, without having to sign in again.

## Acceptance Criteria

The authoritative "login" behavior lives in `rootRedirectGuard` (on the empty-path route `/`):

- [ ] **Given** the user hits `/` while **already authenticated** (`AuthService.isAuthenticated === true`), **When** the guard runs, **Then** `router.createUrlTree(['/dashboard'])` is returned. The URL is `/dashboard` — **not** institution-scoped at this step; institution context is resolved downstream.
- [ ] **Given** the user hits `/` with **no active session but a refresh token** (`AuthService.hasRefreshToken() === true`), **When** the guard calls `AuthService.ensureAuthenticated()` and it returns `true`, **Then** route to `/dashboard` (silent re-auth succeeded — user never sees the landing page).
- [ ] **Given** the user hits `/` with **no refresh token**, **When** the guard calls `AuthService.trySilentLogin()` and it returns `true`, **Then** route to `/dashboard` (SSO session detected).
- [ ] **Given** all three checks above fail, **When** the guard resolves, **Then** route to `/welcome` where the user can initiate an explicit IdP login.

Query-param entry points via `/login` (which is a route redirect, not a component mount — see Routing Note above):

- [ ] **Given** a request hits `/login`, **When** the router processes it, **Then** a `redirectTo: 'auth/callback'` redirect fires (defined in `PUBLIC_ROUTES`). This is the only way `/login` is reachable; no component renders there.

## UI States

| State               | When?                                      | What does the user see?                    | A11y notes                        |
| ------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------- |
| Initial / Loading   | Page load, auth check not yet resolved     | Logo + spinner                             | Loading status via `aria-live`    |
| Redirecting         | Auth check finished, IdP redirect imminent | "You are being redirected to sign in…"     | Message via `aria-live="polite"`  |
| Onboarding Complete | `?onboarding=complete`                     | "Onboarding complete — signing you in now" | Success icon with `role="status"` |
| Error               | Callback failed                            | Error message + "Try again"                | `role="alert"`                    |

## Flows

```
User hits /
    │
    ▼
rootRedirectGuard.canActivate
    │
    ├── isAuthenticated ─────────────▶ /dashboard
    ├── hasRefreshToken
    │    └── ensureAuthenticated? ──▶ /dashboard
    ├── trySilentLogin? (SSO) ──────▶ /dashboard
    └── else ───────────────────────▶ /welcome
                                         │
                            user initiates IdP redirect
                                         │
                                         ▼
                                     Keycloak
                                         │
                                     success
                                         ▼
                                  /auth/callback ──▶ (see auth-callback spec)
                                         │
                                         ▼
                              /               (post-bootstrap)
                                         │
                              rootRedirectGuard again ──▶ /dashboard
                                         │
                              defaultModeRedirectGuard (on ** wildcard)
                                         │
                                         ▼
                              /einrichtung/{institutionId}/dashboard
                              (or /teamspace, /client-portal, /blocked-access
                              per tenant features + assignments)
```

> `/dashboard` (no prefix) is the initial target from the guard. Downstream resolution happens in `defaultModeRedirectGuard` (mounted on the `**` wildcard route inside the secure shell): it inspects tenant features + the user's institution assignments and ultimately navigates to `/einrichtung/{institutionId}/dashboard` (counseling), `/teamspace` (teamspace-only users), `/client-portal` (clients), or `/blocked-access` (no access at all). The `institutionRoute` helper is **not** involved in this path; it is used elsewhere (e.g. [session-expired](../session-expired/spec.md)) for direct post-action navigation.

## Non-Goals

- **Signup** inside the app — handled by Keycloak registration or invitation flow
- **Forgot password** UI — handled inside Keycloak
- **Social login** — out of scope
- **Biometric auth** on Flutter — phase 2

## Edge Cases

- Token exists but is expired → `AuthService.isAuthenticated` returns false; `rootRedirectGuard` then tries `ensureAuthenticated()` (refresh-token path) followed by `trySilentLogin()`. If both fail the user lands on `/welcome`. There is no iframe-based silent refresh — refresh is driven by the refresh-token grant in `@tagea/auth`.
- User has no institution assigned → dashboard route handles this (separate spec).
- Deep link before login (`/some/protected/page`) → should land there after login, not on the dashboard (currently **not** implemented in Angular; tracked as an open item).
- Multiple tabs: if login is in-flight in tab A, tab B must not trigger a duplicate redirect.

## Permissions & Tenant/Institution

- **Required roles:** none (public)
- **Institution context:** **not** derived from the JWT. After login the frontend resolves the institution from the URL (`/einrichtung/:id/…`) via `InstitutionContextService.setInstitutionId(...)`; the initial redirect picked by `defaultModeRedirectGuard` uses the first entry from `AuthorizationStore.context().institutions`. The `institutionId` signal on `UnifiedAuthService` is re-exported from `InstitutionContextService`, not parsed from the token.
- **Tenant context:** resolved by the backend from the `X-Tenant-ID` header (added by the tenant interceptor) and/or the `currentTenant` field in the `/auth/current` response. The Keycloak JWT itself does **not** carry an institution claim.
- **Backend access checks:** the Keycloak token is sent with every API call in the `Authorization: Bearer` header; the backend validates the signature via `OidcJwtGuard` / `OidcAuthMiddleware` and resolves tenant/institution membership from the database, not from JWT claims.

## Notifications (Push / In-App)

- Not relevant for this flow — push-token registration happens in a separate bootstrap phase **after** a successful login (own spec).

## i18n Keys

> User-facing strings remain in German.

- `login.redirecting` — "Du wirst zur Anmeldung weitergeleitet…"
- `login.onboarding_complete` — "Onboarding abgeschlossen"
- `login.error` — "Anmeldung fehlgeschlagen"

## Offline Behavior

**Flutter-specific:**

- Without network: token refresh fails → keep using the cached token until it expires.
- Offline login is **not** possible (Keycloak dependency).
- The app should show an offline indicator instead of a blank login page.

## References

- **Root redirect guard:** [`apps/tagea-frontend/src/app/guards/root-redirect.guard.ts`](../../../apps/tagea-frontend/src/app/guards/root-redirect.guard.ts) — decides between dashboard and `/welcome` on empty-path entry.
- **Redirect-if-authenticated guard:** [`apps/tagea-frontend/src/app/guards/redirect-if-authenticated.guard.ts`](../../../apps/tagea-frontend/src/app/guards/redirect-if-authenticated.guard.ts) — wraps `PUBLIC_ROUTES`; has an `EXCLUDED_PATHS` list for error surfaces (`/session-expired`, etc.).
- **Landing page (IdP redirect entry):** [`apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts)
- **OIDC auth service (used directly by `rootRedirectGuard`):** [`packages/auth/src/lib/services/auth.service.ts`](../../../packages/auth/src/lib/services/auth.service.ts) — exports `AuthService` with `isAuthenticated`, `hasRefreshToken()`, `ensureAuthenticated()`, `trySilentLogin()`, `isInitialized$`.
- **App-level auth orchestration (profile load, tenant/institution switching):** [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
- **Vestigial login components (not mounted by any route):** `pages/login/login.component.ts`, `components/login/login.component.ts` — present in the tree but unreachable.
- **E2E tests:** _(to be identified — add link)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
