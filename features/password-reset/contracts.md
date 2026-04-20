# Contracts: Password Reset

## Endpoints

| Method | Path                                                 | Purpose                           |
| ------ | ---------------------------------------------------- | --------------------------------- |
| `GET`  | `/public/password-reset/validate?userId=…&code=…`    | Validate the reset token          |
| `GET`  | `/public/password-reset/:userId/:token/requirements` | Load tenant password requirements |
| `POST` | `/public/password-reset/:userId/:token/set-password` | Submit the new password           |

All endpoints are unauthenticated (public). Base URL is `environment.apiUrl`.

### Validation response

```ts
interface TokenValidationResponse {
  valid: boolean;
  reason?: 'invalid_code' | 'already_used' | 'expired';
}
```

Token state mapping:

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

Error response (detected by string match in `error.error.message`):

- Contains `"already used"` / `"already_used"` → map to `already_used`
- Contains `"expired"` → map to `expired`

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
