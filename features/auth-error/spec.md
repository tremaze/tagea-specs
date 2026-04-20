# Feature: Auth Error

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Terminal error page the app lands on when authentication fails, a token is invalid/expired, or the `/auth/callback` flow times out. Explains what happened, offers next steps, and provides a "Retry" action that performs a full logout so the user can start fresh.

## User Stories

- As a **user who hit an unrecoverable auth problem** I want a clear explanation, so that I know why I can't sign in.
- As a **user ready to try again** I want a one-tap retry action, so that I don't have to hunt for the login flow.

## Acceptance Criteria

- [ ] **Given** an auth failure has occurred, **When** the user lands on `/auth-error`, **Then** an error icon, title, explanation, and a numbered "what to do" list are shown.
- [ ] **Given** the user presses "Retry", **When** the action fires, **Then** `UnifiedAuthService.logout()` runs (which clears tokens and redirects through the public entry — effectively a clean restart).
- [ ] **Given** the viewport is `<= 600px`, **When** the page renders, **Then** the retry button becomes full-width and the support footer stacks vertically.

## UI States

| State   | When?  | What does the user see?                                                                     | A11y notes                         |
| ------- | ------ | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Default | Always | Error icon, title, main message, info box, instruction list, "Retry" button, support footer | `role="alert"` on the main message |

## Non-Goals

- **Auto-recovery** — the page is a dead end by design. If recovery were possible, the user would already have been redirected elsewhere.
- **Support chat widget** — the support footer is static text, not a live channel.

## Edge Cases

- **User opens the page directly** (deep link, bookmark) → same rendering; retry still logs them out and restarts.
- **Already logged out when reaching retry** → `logout()` is idempotent; subsequent login flow kicks in normally.

## Permissions & Tenant/Institution

- **Required roles:** none (public page, typically reached post-auth failure).
- **Institution context:** irrelevant on this page.
- **Backend access checks:** none.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German.

- `authError.title`, `.message`, `.explanation`
- `authError.whatToDo`, `.tryAgain`, `.checkCredentials`, `.contactSupport`
- `authError.retryButton`, `.supportFooter`

## Offline Behavior

**Flutter-specific:**

- Works offline (pure static UI). Retry button should gracefully fail if offline — show a transient hint rather than triggering the logout flow.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/auth-error/auth-error.component.ts`](../../../apps/tagea-frontend/src/app/pages/auth-error/auth-error.component.ts)
- **Auth service:** `UnifiedAuthService.logout()`
- **Redirect sources:** [`auth-callback spec`](../auth-callback/spec.md) (branches here on generic / timeout / non-specific errors)
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
