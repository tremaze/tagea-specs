# Feature: Password Reset

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Public page reached via an emailed reset link (`/public/password-reset/:userId/:token`). Validates the token server-side, loads tenant-specific password requirements, shows a two-field form with live strength indicator, submits the new password, and redirects the user back to a URL returned by the backend.

## User Stories

- As a **user who forgot their password** I want to open the reset link from my email and set a new password, so that I can log in again.
- As a **user** I want immediate feedback on password strength against tenant requirements, so that I know when my password is acceptable.
- As a **user with a stale link** I want a clear error message, so that I know whether the link was already used, expired, or invalid.

## Acceptance Criteria

### Token validation

- [ ] **Given** the URL carries `:userId` and `:token` path params, **When** the page loads, **Then** the token state starts as `loading` and `GET /public/password-reset/validate?userId=…&code=…` is called.
- [ ] **Given** the validation returns `valid: true`, **When** the check completes, **Then** the token state becomes `valid` and password requirements are fetched.
- [ ] **Given** the validation returns `valid: false`, **When** the reason is read, **Then** the token state becomes `already_used`, `expired`, or `invalid` (default) — each renders a distinct explanation.
- [ ] **Given** either `:userId` or `:token` is missing from the URL, **When** `ngOnInit` runs, **Then** the state becomes `invalid` immediately (no API call).
- [ ] **Given** the validation call throws, **When** the catch branch runs, **Then** the state becomes `invalid`.

### Requirements load

- [ ] **Given** the token is valid, **When** `GET /public/password-reset/:userId/:code/requirements` is called, **Then** a `PasswordRequirements` payload is returned (derived from the Keycloak password policy; see `OnboardingController.requirements`).
- [ ] **Given** the requirements call fails, **When** the catch branch runs, **Then** a sensible default is applied (`minLength: 8, hasUppercase: true, hasLowercase: true, hasNumber: true, hasSymbol: false`) and the form still renders. (The backend applies the same fallback when reading the Keycloak policy fails, so the client fallback is a belt-and-braces measure.)

### Strength indicator

- [ ] **Given** the user types a password, **When** each required constraint is checked, **Then** a requirements list shows each rule with a `done` or `circle` icon depending on fulfilment.
- [ ] **Given** the password changes, **When** fulfilment recomputes, **Then** a progress bar updates with color: `warn` (<50%), `accent` (<100%), `primary` (100%).

### Submit

- [ ] **Given** the form is valid, **When** Submit is pressed, **Then** `POST /public/password-reset/:userId/:code/set-password` is called with `{ password }`.
- [ ] **Given** the response is `{ success: true, redirectUrl }`, **When** the response resolves, **Then** a success snackbar appears for 3s and after 2s the browser hard-navigates to `redirectUrl` (`window.location.href = redirectUrl`).
- [ ] **Given** the response indicates the token is now consumed (error message includes "already used"), **When** the error is parsed, **Then** the token state flips to `already_used` and the error snackbar explains it.
- [ ] **Given** the response indicates the token has expired, **When** the error is parsed, **Then** the token state flips to `expired`.
- [ ] **Given** any other error, **When** the submit fails, **Then** a generic error snackbar shows with the translated message.

## UI States

| State             | When?                                            | What the user sees                                                     | A11y notes            |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------------------------- | --------------------- |
| Loading (initial) | token-state is `loading` or requirements loading | Spinner + "Loading requirements"                                       | `role="status"`       |
| Form visible      | token-state is `valid` + requirements loaded     | Two password fields + requirements list + progress bar + submit button | —                     |
| Already-used      | token-state is `already_used`                    | Success-style icon + explanation + "Go to login" link                  | —                     |
| Expired           | token-state is `expired`                         | Schedule icon + explanation (no action)                                | —                     |
| Invalid           | token-state is `invalid`                         | Error icon + generic notice                                            | `role="alert"`        |
| Error             | token-state is `error` + `error()` has value     | Error icon + specific error text                                       | `role="alert"`        |
| Submitting        | `submitting()` is true                           | Submit button shows inline spinner + "Saving" label                    | `aria-busy` on button |

## Non-Goals

- **Password-reset request flow** (entering an email to receive a link) — handled inside Keycloak or admin tooling; this spec only covers the landing page after the user clicks the link.
- **Password policy editing** — tenant-admin configures requirements; this page only consumes them.
- **Rate-limit UI** — backend enforces; frontend trusts.

## Edge Cases

- **Requirements endpoint 200 but malformed body** — the catchError maps to the hardcoded default; the user can still submit.
- **`redirectUrl` missing/unexpected** — `window.location.href = undefined` would stringify to `"undefined"`. Verify backend contract guarantees the field. Flutter port should validate the URL before navigating.
- **Submit flips token to `already_used` inside the catch** — the user may see both a snackbar and a state change; visually coherent because the form hides under the new state.
- **Concurrent double-submit** — button disabled while `submitting()` is true.
- **Browser back after success navigation** — goes back to the reset page, which will now fail validation (token used).

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth). Controller is decorated with `@Public()` in `apps/tagea-backend/src/public-api/onboarding.controller.ts`.
- **Institution context:** the backend looks up the token by `authUserId + code` in the meta database (`OnboardingToken` entity). The token row carries the `tenantId` used for post-activation side-effects.
- **Backend access checks:** token validity and single-use enforcement live in `OnboardingService.complete`. On success the service also (a) sets the password via Keycloak, (b) marks the Keycloak user `enabled + emailVerified`, (c) marks the token `consumedAt`, and (d) flips the matching `Employee` (if `PENDING_ACTIVATION`) and/or `Client` record to `ACTIVE` in the tenant DB. The `redirectUrl` points to the Keycloak login page with `login_hint=<email>`.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German.

- `passwordSetup.title`, `.subtitle`, `.loadingRequirements`
- `passwordSetup.{newPassword,confirmPassword,passwordRequired,confirmRequired,passwordsMismatch}`
- `passwordSetup.{alreadyUsedTitle,alreadyUsedMessage,goToLogin,expiredTitle,expiredMessage,notice,invalidToken}`
- `passwordSetup.{passwordStrength,fulfilledOf,minCharacters,uppercaseLetter,lowercaseLetter,number,specialCharacter}`
- `passwordSetup.{setPassword,saving,successMessage,errorMessage,loadError,tokenAlreadyUsedError,tokenExpiredError}`
- `passwordSetup.{minLengthError,uppercaseError,lowercaseError,numberError,specialCharError}`
- `common.close` — shared snackbar dismiss

## Offline Behavior

**Flutter-specific:**

- Offline: validation + submit fail; show offline hint instead of the generic error.
- Deep-linking: if the reset URL is opened via the OS (email app), ensure Flutter deep-link routing forwards `:userId` and `:token` path params intact.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/password-setup/public-password-setup.component.ts`](../../../apps/tagea-frontend/src/app/pages/password-setup/public-password-setup.component.ts)
- **Angular route:** [`apps/tagea-frontend/src/app/routes/public.routes.ts`](../../../apps/tagea-frontend/src/app/routes/public.routes.ts) — `public/password-reset/:userId/:token`
- **Environment:** `environment.apiUrl` (base URL for `/public/password-reset/*`)
- **Backend controller:** [`apps/tagea-backend/src/public-api/onboarding.controller.ts`](../../../apps/tagea-backend/src/public-api/onboarding.controller.ts)
- **Backend service:** [`apps/tagea-backend/src/public-api/onboarding.service.ts`](../../../apps/tagea-backend/src/public-api/onboarding.service.ts)
- **Token entity:** [`apps/tagea-backend/src/auth/entities/onboarding-token.entity.ts`](../../../apps/tagea-backend/src/auth/entities/onboarding-token.entity.ts)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
