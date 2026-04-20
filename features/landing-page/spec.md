# Feature: Welcome / Landing Page

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Public landing page at `/welcome` (with `/landing` redirect). Shown to unauthenticated users visiting a custom tenant domain — renders tenant branding (logo, colors) via `TenantResolutionService`, plus login + self-registration entry points.

## User Stories

- As a **visitor on a custom tenant domain** I want to see the tenant's branding immediately, so that I know I'm in the right place.
- As an **unauthenticated user** I want one-tap "Anmelden", so that I can start the IdP flow.
- As a **prospective client or employee** I want self-registration options, so that I can onboard without an invite.

## Acceptance Criteria

- [ ] **Given** the user opens `/welcome`, **When** `TenantResolutionService.tenantId()` resolves, **Then** tenant-specific logo, colors, and copy render.
- [ ] **Given** the user presses "Anmelden", **When** the action fires, **Then** the IdP redirect kicks off (via `UnifiedAuthService.login()`).
- [ ] **Given** the tenant allows client self-registration, **When** the "Registrieren" button is pressed, **Then** `RegistrationFormComponent` renders.
- [ ] **Given** the tenant allows employee self-registration, **When** the relevant action fires, **Then** `EmployeeRegistrationFormComponent` renders.
- [ ] **Given** `rootRedirectGuard` brought an authenticated-but-unassigned user here (edge case), **When** the page loads, **Then** the branding + actions still render — guard did its job, user now chooses.

## UI States

| State             | When?                       | Rendering                                          |
| ----------------- | --------------------------- | -------------------------------------------------- |
| Resolving         | Tenant resolution in-flight | Spinner                                            |
| Loaded (default)  | Tenant branding ready       | Logo + copy + "Anmelden" + optional "Registrieren" |
| Registration form | User chose register         | Form inline (client or employee)                   |
| No tenant         | Tenant resolution failed    | Generic tagea branding + login-only                |

## Non-Goals

- **Marketing content** — not a CMS page.
- **Contact forms** — separate.

## Edge Cases

- **Unknown domain** — `TenantResolutionService` returns null; fallback to generic tagea branding.
- **Registration feature disabled** — registration buttons hidden even if the form components exist.
- **User already authenticated** — `redirectIfAuthenticatedGuard` on `PUBLIC_ROUTES` routes them away (this page is NOT in `EXCLUDED_PATHS`).

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth).
- **Tenant resolution:** `TenantResolutionService.tenantId()` from domain / subdomain.
- **`redirectIfAuthenticatedGuard`** applies — authenticated users are redirected to the dashboard.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German. May be tenant-overridden.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal. Landing is a web-centric feature (custom-domain branding); Flutter app has its own onboarding flow.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts)
- **Sub-components:** `RegistrationFormComponent`, `EmployeeRegistrationFormComponent` (under `landing-page/`)
- **Services:** `TenantResolutionService`, `UnifiedAuthService`
- **Related:** [login](../login/spec.md), [public-register](../public-register/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)
