# Feature: Login

> **Status:** 🚧 Spec in progress — pilot for workflow calibration
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Users authenticate via a Keycloak redirect. On startup the app checks whether a valid session exists; if not, it redirects to the identity provider. After a successful sign-in the user lands on their institution's dashboard.

## User Stories

- As an **invited user** I want to be redirected to sign-in directly via an invitation link, so that I can reach the app without extra steps.
- As a **user who just completed onboarding** I want a brief confirmation before being redirected to sign-in, so that I understand what is happening.
- As an **already authenticated user** I want to land on the dashboard immediately when opening the app, without having to sign in again.

## Acceptance Criteria

- [ ] **Given** no auth token is present, **When** the login page loads, **Then** redirect to Keycloak after a ~1s delay.
- [ ] **Given** a valid auth token is present, **When** the login page loads, **Then** navigate directly to `/{institutionId}/dashboard` without an IdP redirect.
- [ ] **Given** the query param `invitation=true`, **When** the login page loads, **Then** redirect to Keycloak immediately (no delay, no onboarding message).
- [ ] **Given** the query param `onboarding=complete`, **When** the login page loads, **Then** show a success message for 3s, then run the normal auth check.
- [ ] **Given** a successful IdP sign-in, **When** the user returns to `/auth/callback`, **Then** persist the tokens and navigate to the institution-scoped dashboard.
- [ ] **Given** the user aborts the IdP sign-in, **When** they return, **Then** the login page is shown again without an error flash.

## UI States

| State               | When?                                      | What does the user see?                    | A11y notes                        |
| ------------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------- |
| Initial / Loading   | Page load, auth check not yet resolved     | Logo + spinner                             | Loading status via `aria-live`    |
| Redirecting         | Auth check finished, IdP redirect imminent | "You are being redirected to sign in…"     | Message via `aria-live="polite"`  |
| Onboarding Complete | `?onboarding=complete`                     | "Onboarding complete — signing you in now" | Success icon with `role="status"` |
| Error               | Callback failed                            | Error message + "Try again"                | `role="alert"`                    |

## Flows

```
┌────────────┐    no token      ┌──────────┐  success   ┌──────────────┐
│ /login     │ ─────────────────▶│ Keycloak │ ──────────▶│ /auth/callback│
└────────────┘                   └──────────┘             └───────┬──────┘
      │                                                           │
      │ token present                                             ▼
      │                                               ┌──────────────────┐
      └──────────────────────────────────────────────▶│ /{inst}/dashboard│
                                                      └──────────────────┘
```

## Non-Goals

- **Signup** inside the app — handled by Keycloak registration or invitation flow
- **Forgot password** UI — handled inside Keycloak
- **Social login** — out of scope
- **Biometric auth** on Flutter — phase 2

## Edge Cases

- Token exists but is expired → Keycloak redirect for silent refresh.
- User has no institution assigned → dashboard route handles this (separate spec).
- Deep link before login (`/some/protected/page`) → should land there after login, not on the dashboard (currently **not** implemented in Angular; tracked as an open item).
- Multiple tabs: if login is in-flight in tab A, tab B must not trigger a duplicate redirect.

## Permissions & Tenant/Institution

- **Required roles:** none (public)
- **Institution context:** extracted from the JWT after login (`institutionId()` on the auth service). The dashboard URL is institution-scoped.
- **Backend access checks:** the Keycloak token is sent with every API call in the `Authorization` header; the backend validates the signature and institution membership.

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

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/login/login.component.ts`](../../../apps/tagea-frontend/src/app/pages/login/login.component.ts)
- **Auth service:** [`apps/tagea-frontend/src/app/services/unified-auth.service.ts`](../../../apps/tagea-frontend/src/app/services/unified-auth.service.ts)
- **E2E tests:** _(to be identified — add link)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
