# Contracts: Blocked Access

## How users get here

`SessionBootstrap.fetchSession()` maps a failed `GET /session/v2` to
`/blocked-access?reason=…` (see [spec.md](./spec.md#reason-resolution)).

### 403 body of `GET /session/v2` (account blocked)

Built by `blocked()` in
`apps/tagea-backend/src/auth/account-usability/account-usability.ts` and
flattened onto the top level by `GlobalExceptionFilter`:

> Documentation-only shape.

```ts
{
  statusCode: 403,
  code: 'ACCOUNT_BLOCKED',
  reason: AccountBlockReason, // account-deleted | account-suspended |
                              // account-pending-approval |
                              // account-pending-activation |
                              // email-not-verified | email-domain-not-allowed
  message: string,
  principalType?: 'employee' | 'client',
  enrollment: { state: 'blocked' | 'needs_approval' | …, detail?: { code?, reason? } },
  timestamp: string, path: string, method: string,
}
```

Other structured 403 codes: `NO_TENANT_CONTEXT` (→ `/join`), `VIVENDI_*`
(→ `vivendi-provisioning`).

## Endpoints

### `POST /auth/resend-email-change-verification`

- Auth: `@Auth({ scope: 'authenticated', allowEmailUnverified: true })`.
- Body: `{}`.
- 200: `{ retryAfterSeconds: number }` (cooldown, 5 minutes).
- 400: `{ message, retryAfterSeconds }` while rate limited.
- 404: no pending e-mail change.

## Actions

- **Bestätigungs-E-Mail erneut senden** — the endpoint above.
- **Zu Teamspace wechseln** — `Router.navigate(['/teamspace'])`.
- **Neu registrieren** — clears the rejection marker, then logs out.
- **Abmelden** — `SessionLogout.logout()`.

> **Flutter port note:** `AccountBlockReason.fromDenialBody` (teamspace_core)
> parses the 403 body; `EmailVerificationApi` / `EmailVerificationResendCubit`
> implement the resend with its cooldown.
