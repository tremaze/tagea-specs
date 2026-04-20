# Feature: No Tenant

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Terminal page shown to an authenticated user whose account is not assigned to any tenant (Keycloak user exists but backend has no matching employee/tenant record). Explains the situation, shows the currently-logged-in email, and provides only a "Logout" action.

## User Stories

- As a **user whose account has no tenant link** I want to understand that the system recognizes me but can't route me to an organization, so that I know whom to contact.
- As a **user on this page** I want to log out cleanly, so that I can try with a different account if needed.

## Acceptance Criteria

- [ ] **Given** the profile load returned `NO_TENANT_ASSIGNMENT`, **When** the user lands on `/no-tenant`, **Then** a warning icon, title "Kein Mandant zugeordnet", explanatory text, and (if available) the authenticated email are shown.
- [ ] **Given** the `UnifiedAuthService.userEmail` signal has a value, **When** the page renders, **Then** a "Angemeldet als: <email>" info block appears.
- [ ] **Given** the `userEmail` signal is empty/null, **When** the page renders, **Then** the info block is hidden.
- [ ] **Given** the user clicks "Abmelden", **When** the click fires, **Then** `UnifiedAuthService.logout()` runs.

## UI States

| State         | When?                   | What does the user see?                | A11y notes |
| ------------- | ----------------------- | -------------------------------------- | ---------- |
| Without email | `userEmail()` is falsy  | Icon + title + message, no email block | —          |
| With email    | `userEmail()` has value | Same + "Angemeldet als: <email>" block | —          |

## Non-Goals

- **Request-access CTA** — no in-app path to request tenant assignment; user contacts admin out-of-band.
- **Retry** — unlike `/auth-error`, there is no useful retry path; only logout.

## Edge Cases

- **Email changes mid-session** — unlikely (requires re-login) but the signal-driven rendering handles it: page re-renders with the new value.
- **Direct deep-link access** — same rendering; no guard prevents reaching it without being authenticated.

## Permissions & Tenant/Institution

- **Required roles:** authenticated (reached via auth-callback redirect); no specific permission.
- **Institution context:** by definition, none — that's why the user is here.
- **Backend access checks:** the profile-load endpoint already returned `NO_TENANT_ASSIGNMENT`; no further calls on this page.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German. **This component currently has German strings hardcoded in the template** (no `transloco` pipe). Port should either add i18n keys or keep the German literals.

## Offline Behavior

**Flutter-specific:**

- Works offline once loaded. Logout button requires online (IdP logout redirect) — fail gracefully with a hint if offline.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/no-tenant/no-tenant.component.ts`](../../../apps/tagea-frontend/src/app/pages/no-tenant/no-tenant.component.ts)
- **Redirect source:** [`auth-callback spec`](../auth-callback/spec.md) branches here on `NO_TENANT_ASSIGNMENT`.
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
