# Contracts: No Tenant

## No direct endpoints

This page makes no backend calls. It is a destination reached via redirect from `/auth/callback` when the profile-load response signals `NO_TENANT_ASSIGNMENT` (see [auth-callback/contracts.md](../auth-callback/contracts.md)).

## Signals consumed

- `UnifiedAuthService.userEmail` — reactive signal (not observable) carrying the Keycloak `email` claim. Can be `null` if the claim was missing from the token.

## Actions

### "Abmelden"

- Calls `UnifiedAuthService.logout()` — clears session and restarts the login flow.

> **Flutter port note:** the `userEmail` source in Flutter should be exposed via a provider fed by the decoded JWT claims. The logout call mirrors [`auth-error/contracts.md`](../auth-error/contracts.md).
