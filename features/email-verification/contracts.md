# Contracts: Email Verification

## No direct endpoints

This page makes no backend calls. The verification itself happens server-side when the user clicks the email link; the backend then redirects the browser here with the result as a query param.

## Inputs

- Query param `success`:
  - `'true'` → success variant
  - any other value or missing → error variant

## Actions

### "Zur Anmeldung" (success variant)

- `UnifiedAuthService.login()` — kicks off the standard IdP redirect.

### "Zur Startseite" (error variant)

- `Router.navigate(['/welcome'])` — back to the public landing page.

> **Flutter port note:** receive the `success` flag via deep-link path parsing. Flutter equivalent of `login()` is the same as in [login/contracts.md](../login/contracts.md); `Router.navigate(['/welcome'])` becomes `context.go('/welcome')` or the equivalent in the chosen router.
