# Contracts: Landing Page

## Services

| Service                   | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `TenantResolutionService` | `tenantId()` signal + branding metadata lookup from current domain |
| `UnifiedAuthService`      | `login()` to kick off IdP flow                                     |

## Registration sub-forms

Rendered inline when the user chooses to register:

- `RegistrationFormComponent` — client self-registration (handoff to the [public-register](../public-register/contracts.md) flow)
- `EmployeeRegistrationFormComponent` — employee self-registration (separate backend endpoint)

> Exact service signatures and tenant-branding shape live inside `TenantResolutionService`. This landing page is web-centric; Flutter non-goal.
