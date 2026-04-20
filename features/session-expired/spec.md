# Feature: Session Expired

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

A dedicated landing page the app lands on when a user's session has expired or their auth token was rejected. Provides a clear explanation plus two actions: log in again (primary) or return to the public landing page (secondary).

## User Stories

- As a **returning user whose session expired** I want a clear explanation that my session ran out, so that I don't wonder why I was logged out.
- As a **user ready to continue** I want a one-tap "log in again" button, so that I can get back to my workspace quickly.
- As a **user who doesn't want to log in right now** I want to reach the public landing page, so that I can leave without committing.

## Acceptance Criteria

- [ ] **Given** the user's session has expired (auth token rejected or token TTL reached), **When** the app redirects, **Then** they land on `/session-expired`.
- [ ] **Given** the user is on `/session-expired`, **When** the page renders, **Then** a lock icon, title, and explanation text are visible, plus two actions ("log in again" and "home").
- [ ] **Given** the user clicks "log in again", **When** `login()` runs, **Then** the OIDC login flow starts (`AuthService.login()`).
- [ ] **Given** the IdP login completes (native platforms: same page continues; web: page redirects externally), **When** `isAuthenticated` becomes true, **Then** navigate to `/{institutionId}/dashboard` with `replaceUrl: true`.
- [ ] **Given** the user clicks "home", **When** the link resolves, **Then** navigate to `/welcome`.

## UI States

| State   | When?                         | What does the user see?                                                                                  | A11y notes                                              |
| ------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Default | Always (purely informational) | Lock-clock icon, title, explanation text, primary "Neu anmelden" button, secondary "Zur Startseite" link | `role="status"` on the explanation block is appropriate |

## Flows

```
(session expires, e.g. 401 from backend)
          │
          ▼
  /session-expired
          │
   ┌──────┴──────┐
   │             │
   ▼             ▼
login btn     home link
   │             │
   ▼             ▼
AuthService    /welcome
.login()
   │
   ▼
(if isAuthenticated)
   │
   ▼
/{institutionId}/dashboard
```

## Non-Goals

- **Silent token refresh** — handled elsewhere (auth service + HTTP interceptor). This page exists for the unrecoverable case.
- **Saving the pre-expiry route** to deep-link back after re-login — not implemented; user lands on dashboard after re-login.
- **Automatic re-login on page load** — intentional: surface the expiry to the user rather than silently re-auth.

## Edge Cases

- **Login succeeds but `institutionId()` is null** → `institutionRoute(null, 'dashboard')` is called; target route may be malformed. Worth verifying in the auth service that the post-login bootstrap finishes before navigation fires.
- **Native platform cancels login** — after `login()` resolves, `isAuthenticated` is false → user stays on `/session-expired` (acceptable; they can retry).
- **User reloads `/session-expired` after a successful re-login elsewhere** — page still renders. `PUBLIC_ROUTES` is wrapped by `redirectIfAuthenticatedGuard`, but that guard's `EXCLUDED_PATHS` list contains `/session-expired` explicitly. Intentional: handles the case where the session was already renewed in another tab and the user wants to consciously re-authenticate.

## Permissions & Tenant/Institution

- **Required roles:** none (public-facing page, similar to `/login`).
- **Institution context:** on successful re-login, post-login navigation uses `UnifiedAuthService.institutionId()`.
- **Backend access checks:** none on the page itself; the backend enforcement that rejected the previous session is what brings the user here.

## Notifications (Push / In-App)

- Not relevant to this page.

## i18n Keys

> User-facing strings remain in German.

- `sessionExpired.title` — "Sitzung abgelaufen" (or similar — confirm actual value)
- `sessionExpired.message` — explanatory text
- `sessionExpired.loginButton` — "Neu anmelden"
- `sessionExpired.homeLink` — "Zur Startseite"

## Offline Behavior

**Flutter-specific:**

- Without network: "log in again" will fail inside `flutter_appauth`. Catch and show a transient offline hint under the button; do not replace the page.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/session-expired/session-expired.component.ts`](../../../apps/tagea-frontend/src/app/pages/session-expired/session-expired.component.ts)
- **Auth services consumed:** `AuthService` (from `@tagea/auth`), `UnifiedAuthService` (local)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
