# Contracts: Password Reset

## Endpoints

| Method | Path                                                | Purpose                           |
| ------ | --------------------------------------------------- | --------------------------------- |
| `GET`  | `/public/password-reset/validate?userId=…&code=…`   | Validate the reset token          |
| `GET`  | `/public/password-reset/:userId/:code/requirements` | Load tenant password requirements |
| `POST` | `/public/password-reset/:userId/:code/set-password` | Submit the new password           |

All endpoints are unauthenticated (public). Base URL is `environment.apiUrl`.

> Path param naming: the backend controller (`apps/tagea-backend/src/public-api/onboarding.controller.ts`) uses `:userId/:code`. The Angular route definition (`public/password-reset/:userId/:token`) names the second segment `:token` but passes the same value into the backend's `code` slot. Spec uses `:code` to match the backend (authoritative).

### Validation response

> Documentation-only shape. Reflects the backend response body; the Angular component's local `TokenValidationResponse` is narrower.

```ts
// Backend wire shape (from OnboardingService.validateToken)
interface TokenValidationResponseWire {
  valid: boolean;
  reason?: string; // typed as string on the server; known values below
  email?: string; // present when valid === true
  expiresAt?: Date; // present when valid === true
}
```

Known `reason` values emitted by the backend: `'invalid_code'`, `'already_used'`, `'expired'`.

The Angular client ignores `email` and `expiresAt` (surface-only) and narrows `reason` to the following mapping:

| `valid` | `reason`                         | Frontend state |
| ------- | -------------------------------- | -------------- |
| `true`  | —                                | `valid`        |
| `false` | `'already_used'`                 | `already_used` |
| `false` | `'expired'`                      | `expired`      |
| `false` | `'invalid_code'` / anything else | `invalid`      |

### Requirements response

```ts
interface PasswordRequirements {
  minLength: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}
```

Fallback used on error:

```ts
{ minLength: 8, hasUppercase: true, hasLowercase: true, hasNumber: true, hasSymbol: false }
```

### Submit request / response

Request body:

```ts
{
  password: string;
}
```

Successful response:

```ts
{
  success: boolean;
  redirectUrl: string;
}
```

Error response: the backend wraps service errors in `BadRequestException`, producing `{ statusCode: 400, message: string, error: 'Bad Request' }`. The client detects the specific reason by lowercasing `error.error.message` and substring-matching:

- Contains `"already used"` / `"already_used"` → map to `already_used` (backend raises `'Code already used'`)
- Contains `"expired"` → map to `expired` (backend raises `'Code expired'` or `'Invalid or expired code'`)
- Otherwise → generic `errorMessage`

## Local types

```ts
type TokenState = 'loading' | 'valid' | 'already_used' | 'expired' | 'invalid' | 'error';

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Client-side password validation

Mirrors the server rules to give immediate feedback:

```ts
// All checks ANDed; any failure → invalid
password.length >= requirements.minLength;
!requirements.hasUppercase || /[A-Z]/.test(password);
!requirements.hasLowercase || /[a-z]/.test(password);
!requirements.hasNumber || /[0-9]/.test(password);
!requirements.hasSymbol || /[^A-Za-z0-9]/.test(password);
```

> **Flutter port note:** client-side validation is advisory UX; backend re-validates on submit. Mirror the regex checks verbatim.

## Post-success navigation

- Hard-navigate to `response.redirectUrl` via `window.location.href` after a 2s delay (to let the user see the snackbar).
- Flutter equivalent: `launchUrl(Uri.parse(redirectUrl))` via `url_launcher`, or in-app navigation if the URL is an app route.
