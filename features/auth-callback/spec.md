# Feature: Auth Callback

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Handles the return leg of the OIDC authorization flow: completes the token exchange, waits for the employee profile to load, then routes the user to the correct destination based on their tenant/email-verification state or to an error page if something went wrong.

## User Stories

- As a **user who just authenticated with Keycloak** I want to be routed to my workspace once the backend confirms my profile, so that I can start using the app without manual clicks.
- As a **user without a tenant assignment** I want to land on a clear explanation page, so that I understand why I can't access the app yet.
- As a **user with an unverified email** I want to be told to verify my email before proceeding, so that I can complete the required step.

## Acceptance Criteria

- [ ] **Given** the OIDC provider has redirected back with a code, **When** `/auth/callback` is loaded, **Then** a loading spinner is shown while the token exchange and profile load complete.
- [ ] **Given** the OIDC token exchange is running, **When** the profile finishes loading, **Then** the user is redirected to `/` with `replaceUrl: true` (so Back doesn't return to the callback).
- [ ] **Given** profile load fails with `NO_TENANT_ASSIGNMENT`, **When** the error is observed, **Then** redirect to `/no-tenant`.
- [ ] **Given** profile load fails with `EMAIL_NOT_VERIFIED`, **When** the error is observed, **Then** redirect to `/blocked-access?reason=email-not-verified`.
- [ ] **Given** any other profile-load error, **When** the error is observed, **Then** redirect to `/auth-error`.
- [ ] **Given** the profile does not load within **120s** (allows E2E auto-provisioning), **When** the timeout is hit, **Then** redirect to `/auth-error`.
- [ ] **Given** the component is destroyed mid-flow, **When** teardown runs, **Then** the in-flight polling loop stops cleanly (no navigation after destroy).

## UI States

| State      | When?                            | What does the user see?                    | A11y notes                                                 |
| ---------- | -------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Processing | Always, until navigation happens | Centered spinner + `login.processing` text | Spinner should have `role="status"` / `aria-live="polite"` |

No other UI — the page is purely transitional.

## Flows

```
Keycloak redirect ──▶ /auth/callback
                          │
       ┌──────────────────┴──────────────────┐
       │ wait: authService.isInitialized$     │
       │ then poll unifiedAuthService         │
       └──────────────────┬──────────────────┘
                          │
      ┌───────────┬───────┴───────┬──────────────┐
      ▼           ▼               ▼              ▼
  profile OK   NO_TENANT_    EMAIL_NOT_      other error
              ASSIGNMENT     VERIFIED         / timeout
      │           │               │              │
      ▼           ▼               ▼              ▼
      /       /no-tenant   /blocked-access?   /auth-error
                           reason=email-
                           not-verified
```

## Non-Goals

- **User-facing retry button** — the page is pure transition; errors lead to error pages that have their own retry affordances.
- **Manual token-exchange UI** — the OIDC library handles the code exchange.

## Edge Cases

- **Profile load is slow (E2E auto-provisioning)** → tolerated via 120s timeout; real users see ≤1-2s.
- **User navigates away mid-wait** → the initialization watcher stops and the component unmounts; one additional 100ms poll iteration may run but cannot cause navigation because the component is gone. Acceptable race.
- **`isInitialized$` never fires** — in theory blocks forever; in practice the OIDC library always resolves. Not currently guarded.
- **Multiple simultaneous callbacks (multi-tab)** — each tab runs its own loop; last one wins its own navigation. No cross-tab coordination.

## Permissions & Tenant/Institution

- **Required roles:** none (public-facing, but only meaningful after IdP redirect).
- **Institution context:** resolved after profile loads; not needed during callback.
- **Backend access checks:** profile load is the first authenticated call; its response determines the branching (success / `NO_TENANT_ASSIGNMENT` / `EMAIL_NOT_VERIFIED`).

## Notifications (Push / In-App)

- Not relevant to this flow — push-token registration happens later, as part of the bootstrap after `/` is reached (separate spec).

## i18n Keys

> User-facing strings remain in German.

- `login.processing` — "Anmeldung wird verarbeitet…" (or similar — confirm actual value)

## Offline Behavior

**Flutter-specific:**

- Without network: the token-exchange leg fails inside the OIDC library; callback should time out quickly (not wait 120s) and redirect to `/auth-error` with an offline hint.
- Flutter equivalent likely uses `flutter_appauth` — its callback is a deep-link into the app rather than a separate route. The "wait for profile" loop translates 1:1 via a `FutureBuilder` or a dedicated bootstrap route.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/components/auth-callback/auth-callback.component.ts`](../../../apps/tagea-frontend/src/app/components/auth-callback/auth-callback.component.ts)
- **Auth services consumed:** `AuthService` (from `@tagea/auth`), `UnifiedAuthService` (local)
- **E2E tests:** _(to be identified — likely covered transitively by any authenticated e2e test)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
