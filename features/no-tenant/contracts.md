# Contracts: No Tenant

## No direct endpoints

This page makes no backend calls. It is a destination reached via redirect from `/auth/callback` when the profile-load response signals `NO_TENANT_ASSIGNMENT`. A second redirect path exists: the `effect()` in `UnifiedAuthService` watches `_profileLoadError` and routes to `/no-tenant` whenever the error becomes `'NO_TENANT_ASSIGNMENT'` (see `unified-auth.service.ts` around lines 240–258 and 515–527, and [auth-callback/contracts.md](../auth-callback/contracts.md)).

## Signals consumed

- `UnifiedAuthService.userEmail` — Angular `computed` signal returning a `string`. Sourced from `employee.email` when the employee record is loaded; otherwise falls back to the OIDC `email` claim, then `preferred_username`. Returns `''` (empty string) when no source is available — never `null`/`undefined`. The template test `@if (userEmail())` therefore hides the info block on empty string.

## Actions

### "Abmelden"

- Bound via `(click)="logout()"` on the `<button mat-raised-button>` inside `<mat-card-actions>`.
- The component method `NoTenantComponent.logout()` calls `UnifiedAuthService.logout(): Promise<void>`, which clears all local auth state (employee, permissions, OIDC data, tenant context, push subscriptions, Matrix client), then delegates to `AuthService.logout()` from `@tagea/auth` (redirects the browser on web, navigates to `/welcome` on native).

> **Flutter port note:** the `userEmail` source in Flutter should be exposed via a provider fed by the decoded JWT claims. The logout call mirrors [`auth-error/contracts.md`](../auth-error/contracts.md).
