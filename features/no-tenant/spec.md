# Feature: No Tenant

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Terminal page shown to an authenticated user whose backend employee record exists but has no `tenantId` assignment (Keycloak authentication succeeds, profile load throws `NO_TENANT_ASSIGNMENT`). Explains the situation, shows the currently-logged-in email, and provides only a "Logout" action.

## User Stories

- As a **user whose account has no tenant link** I want to understand that the system recognizes me but can't route me to an organization, so that I know whom to contact.
- As a **user on this page** I want to log out cleanly, so that I can try with a different account if needed.

## Acceptance Criteria

- [ ] **Given** the profile load returned `NO_TENANT_ASSIGNMENT`, **When** the user lands on `/no-tenant`, **Then** a warning icon, title "Kein Mandant zugeordnet", two explanatory paragraphs ("Ihr Benutzerkonto ist keinem Mandanten zugeordnet." and "Bitte wenden Sie sich an Ihren Administrator, um Zugriff zu erhalten."), and (if available) the authenticated email are shown.
- [ ] **Given** the `UnifiedAuthService.userEmail` computed signal has a non-empty value, **When** the page renders, **Then** a "Angemeldet als: <email>" info block appears.
- [ ] **Given** `userEmail()` is the empty string (no employee and no OIDC email/preferred_username claim), **When** the page renders, **Then** the info block is hidden.
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
- **Direct deep-link access** — same rendering; the path is listed in `redirectIfAuthenticatedGuard`'s `EXCLUDED_PATHS`, so no redirect is applied regardless of auth state.

## Permissions & Tenant/Institution

- **Required roles:** none. The route lives in `PUBLIC_ROUTES` and is listed in `redirectIfAuthenticatedGuard`'s `EXCLUDED_PATHS`, so both authenticated and unauthenticated visitors render the page.
- **Institution context:** by definition, none — that's why the user is here.
- **Backend access checks:** none on this page. The upstream `NO_TENANT_ASSIGNMENT` is set inside `UnifiedAuthService.loadUserProfile` when the loaded `employee.tenantId` is falsy (see `unified-auth.service.ts` around line 517).

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
