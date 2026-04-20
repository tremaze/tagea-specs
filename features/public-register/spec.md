# Feature: Public Register

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Public self-registration form for new clients. Collects first name, last name, email, and a confirmed password, validates against the tenant's password policy, submits to the public registration endpoint, and on success shows a confirmation state telling the user to check their email for verification.

## User Stories

- As a **prospective client** I want to create my account directly from the public site, so that I can start using the service without waiting for an admin to invite me.
- As a **user coming in via an institution-specific link** I want my registration to be scoped to that institution, so that I'm routed to the right organization.
- As a **user** I want server-side password policy enforced in the form, so that I don't submit and bounce back.

## Acceptance Criteria

### Page load + form setup

- [ ] **Given** the page loads, **When** `ngOnInit` runs, **Then** the form is built with validators: firstName/lastName required + min 2 chars, email required + email format, password required + min 8 chars (placeholder until policy loads), passwordConfirm required.
- [ ] **Given** the page loads, **When** `getPasswordPolicy()` resolves, **Then** the password field validators are updated to use `policy.minLength`.
- [ ] **Given** `getPasswordPolicy()` fails, **When** the error callback runs, **Then** the form remains functional with its placeholder `minLength: 8` validator.
- [ ] **Given** the URL carries `?tenantId=…` and/or `?institutionId=…`, **When** query params resolve, **Then** `tenantId` is captured (for backend tenant resolution) and `institutionId` is forwarded with the registration payload.

### Password match

- [ ] **Given** the user fills `password` and `passwordConfirm`, **When** they differ, **Then** a group-level `passwordMismatch` error appears.

### Submit

- [ ] **Given** the form is valid and not already submitting, **When** Submit fires, **Then** `submitting()` flips true, `errorMessage` clears, and `PublicRegistrationService.register(payload)` runs.
- [ ] **Given** `register()` succeeds, **When** the response resolves, **Then** `submitted()` flips true and the success state renders (telling the user to verify their email).
- [ ] **Given** `register()` errors, **When** the catch branch runs, **Then** `submitting()` resets and the backend message (or the default German error) is shown.

### Navigation

- [ ] **Given** the user clicks "Back", **When** the action fires, **Then** navigate to `/booking`.
- [ ] **Given** the user clicks "Already have an account" (or equivalent), **When** `navigateToLogin()` fires, **Then** `this.router.navigate(['/login'])` runs. `/login` is defined in `PUBLIC_ROUTES` as a `redirectTo: 'auth/callback'` entry, so the effective destination is `/auth/callback` (no `LoginComponent` renders — see the [login spec routing note](../login/spec.md)).

### Tenant resolution (sent to backend)

- [ ] **Given** `TenantResolutionService.tenantId()` has a value, **When** any public-registration call fires, **Then** the request carries the `X-Tenant-ID` header.
- [ ] **Given** no resolved tenant, **When** the call fires, **Then** `?domain=<window.location.hostname>` is sent as a query param instead.

## UI States

| State          | When?                           | What does the user see?                                 | A11y notes      |
| -------------- | ------------------------------- | ------------------------------------------------------- | --------------- |
| Form (default) | `!submitted() && !submitting()` | Name/email/password form + submit button                | —               |
| Submitting     | `submitting() === true`         | Submit button disabled, inline spinner                  | `aria-busy`     |
| Success        | `submitted() === true`          | Confirmation screen with "check your inbox" instruction | `role="status"` |
| Error          | `errorMessage()` has value      | Inline error banner above the form                      | `role="alert"`  |

## Non-Goals

- **Institution picker UI** — the service has `getInstitutions()` but this page only consumes `institutionId` from the URL. Showing a picker is a separate feature.
- **Captcha / bot protection** — handled elsewhere (or not present); not in this spec.
- **OAuth signup via social providers** — not supported.

## Edge Cases

- **Email already registered** → backend 4xx with message; caught and surfaced via `errorMessage()`.
- **Password policy update mid-session** — only fetched once on load; users opening the form before a tenant-admin tightens the policy may see stale validators (backend re-validates on submit).
- **User submits with stale policy that passes client-side but server rejects** → same error pathway; surface the backend message.
- **Tenant resolution unavailable (non-browser env? SSR?)** → falls back to `window.location.hostname` domain param. Fine for the web case.

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth).
- **Institution context:** optional via `?institutionId=…`; forwarded to the backend.
- **Tenant context:** resolved client-side via `TenantResolutionService` and propagated via `X-Tenant-ID` header or `?domain=` param.

## Notifications (Push / In-App)

- Not relevant to this page. A verification email is sent server-side on successful registration; the user then lands on [email-verification](../email-verification/spec.md) after clicking the link.

## i18n Keys

> User-facing strings remain in German. **Default error fallback text is hardcoded** (`'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.'`). The rest of the strings live in the external template (`public-register-page.component.html`).

## Offline Behavior

**Flutter-specific:**

- Offline: form stays interactable, submit fails with a transient offline hint.
- Verification email obviously requires online delivery; no local queue.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.ts)
- **Template:** [`public-register-page.component.html`](../../../apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.html)
- **Service:** [`PublicRegistrationService`](../../../apps/tagea-frontend/src/app/services/public-registration.service.ts)
- **Tenant resolution:** [`TenantResolutionService`](../../../apps/tagea-frontend/src/app/core/tenant-resolution.service.ts)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
