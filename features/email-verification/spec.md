# Feature: Email Verification

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Landing page shown after the user clicks the verification link in an email. The backend redirects here with `?success=true` (or missing/other value on failure). The page renders a success or error variant and offers a single action each: proceed to login on success, or back to `/welcome` on failure.

## User Stories

- As a **newly-registered user** I want a clear confirmation that my email was verified, so that I know my account is ready.
- As a **user whose verification link was invalid** I want to understand why and have a safe way back, so that I'm not stuck.

## Acceptance Criteria

### Success variant

- [ ] **Given** the page URL carries `?success=true`, **When** the page loads, **Then** a green `check_circle` icon, success title, message, and a primary "Zur Anmeldung" button render.
- [ ] **Given** "Zur Anmeldung" is pressed, **When** the click fires, **Then** `UnifiedAuthService.login()` starts the IdP flow.

### Error variant

- [ ] **Given** the page URL has no `?success` param, or the value is anything other than `'true'`, **When** the page loads, **Then** a red `error` icon, error title, instruction text, and a secondary "Zur Startseite" button render.
- [ ] **Given** "Zur Startseite" is pressed, **When** the click fires, **Then** `Router.navigate(['/welcome'])` runs.

## UI States

| State   | When?           | What does the user see?                          | A11y notes                     |
| ------- | --------------- | ------------------------------------------------ | ------------------------------ |
| Success | `?success=true` | Green check icon + success copy + primary button | `role="status"` on the message |
| Error   | default         | Red error icon + error copy + secondary button   | `role="alert"`                 |

## Non-Goals

- **Self-service email re-verification** — backend handles sending/resending; frontend only renders the result.
- **Auto-login after success** — button press required (so the user consciously initiates the flow).

## Edge Cases

- **Query param with unexpected casing** (`?success=TRUE`) → strict `=== 'true'` check means it falls through to the error variant. Document that the backend must lowercase the param.
- **User already logged in when opening the link** — `redirectIfAuthenticatedGuard` applies to `PUBLIC_ROUTES` but its `EXCLUDED_PATHS` list contains `/public/` as a prefix (matched via `startsWith`). Since this route is `public/email-verified` (matches), authenticated users are **not** redirected away and the page renders normally. Intentional.

## Permissions & Tenant/Institution

- **Required roles:** none (public-facing).
- **Institution context:** not relevant.
- **Backend access checks:** verification is performed server-side before redirect; this page does not call the backend.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German.

- `emailVerification.{successTitle,successMessage,successInstruction,goToLogin}`
- `emailVerification.{errorTitle,errorMessage,errorInstruction,backToHome}`

## Offline Behavior

**Flutter-specific:**

- Pure static UI — works offline.
- "Zur Anmeldung" requires online (triggers IdP flow).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/email-verification/email-verification.component.ts`](../../../apps/tagea-frontend/src/app/pages/email-verification/email-verification.component.ts)
- **Auth service:** `UnifiedAuthService.login()`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
