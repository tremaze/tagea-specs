# Contracts: Public Register

## Service: `PublicRegistrationService`

Base URL: `${environment.apiUrl}/public/clients`. All calls are unauthenticated.

The page also calls `authService.login(options)` (from `UnifiedAuthService` / `@tagea/auth`) on the "Zur Anmeldung" buttons. The relevant option for this spec is `{ loginHint?: string }`, which is forwarded as the OIDC `login_hint` query parameter to Keycloak so the username field is pre-filled.

| Method                                | Endpoint                                   | Purpose                                                                               |
| ------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `register(data: RegistrationRequest)` | `POST /public/clients/register`            | Submit the registration                                                               |
| `getPasswordPolicy()`                 | `GET /public/clients/password-policy`      | Fetch password rules                                                                  |
| `resendVerification(email)`           | `POST /public/clients/resend-verification` | Re-send verification email (not wired in the register page, available on the service) |
| `getInstitutions()`                   | `GET /public/clients/institutions`         | List institutions (not used in this page)                                             |

## Tenant Context (HTTP)

The service attaches tenant context via one of two mechanisms:

```ts
// Source: public-registration.service.ts
private getTenantOptions() {
  const tenantId = this.tenantResolution.tenantId();
  if (tenantId) {
    return { headers: { 'X-Tenant-ID': tenantId } };
  }
  return { params: { domain: window.location.hostname } };
}
```

> **Flutter port note:** mirror both branches. In a Flutter-native build, `flutter_appauth` and the app likely already know the tenant (static config or deep link); use the header path. There is no `window.location.hostname` equivalent on mobile, so the domain fallback shouldn't be needed — but keep the header-based path.

## Data Models

```ts
// Source: public-registration.service.ts
interface RegistrationRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
  institutionId?: string;
}

interface RegistrationResponse {
  success: boolean;
  message: string;
}

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecialChar: boolean;
}

interface PublicInstitution {
  id: string;
  name: string;
  shortName?: string;
  city?: string;
}
```

> **Spelling note:** the password policy here uses `requireUppercase / requireLowercase / requireDigit / requireSpecialChar`. The separate password-reset endpoint uses `hasUppercase / hasLowercase / hasNumber / hasSymbol` (see [password-reset/contracts.md](../password-reset/contracts.md)). The two shapes are inconsistent — Flutter should normalize to one shape client-side while preserving the wire format per endpoint.

## Post-registration flow

1. `register()` returns success → UI shows "check your inbox" state.
2. Backend sends verification email.
3. User clicks the link → server-side verify → redirect to [/public/email-verified](../email-verification/spec.md) with `?success=true` or failure.
4. User presses "Zur Anmeldung" on the verification page → standard IdP flow.

## Institution persistence

The wire field `institutionId` is optional. When present, the backend persists the client's institution membership in the `client_institution_assignments` junction table — never on the client row. (The legacy `clients.institution_id` column was dropped in tenant migration `20260508100000-DropClientsInstitutionId`.) The same junction is written for both new registrations and reactivations of soft-deleted clients; reactivation is idempotent thanks to the unique `(client_id, institution_id)` index.
