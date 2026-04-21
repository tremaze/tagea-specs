# Contracts: Blocked Access

## No direct endpoints

This page makes no backend calls. It is a destination reached via redirect from:

- `/auth/callback` with `?reason=email-not-verified` on `EMAIL_NOT_VERIFIED` error (see [auth-callback/contracts.md](../auth-callback/contracts.md))
- Route guards that redirect authenticated users with no institution assignment:
  - `permissionGuard` (`apps/tagea-frontend/src/app/guards/permission.guard.ts`)
  - `defaultModeRedirectGuard` (`apps/tagea-frontend/src/app/guards/default-mode-redirect.guard.ts`)
  - `teamspaceFeatureGuard` (`apps/tagea-frontend/src/app/guards/teamspace-feature.guard.ts`)
  - `tenantPermissionGuard` (`apps/tagea-frontend/src/app/guards/tenant-permission.guard.ts`)
  - `institutionUrlGuard` (`apps/tagea-frontend/src/app/guards/institution-url.guard.ts`)

## Actions

### "Zu Teamspace wechseln" (blocked-access variant only)

- `Router.navigate(['/teamspace'])` — reaches the teamspace home (which has its own feature-guard handling).

### "Abmelden" (both variants)

- `UnifiedAuthService.logout()` — mirrors the auth-error logout flow.

## Mode resolution

```ts
// Component logic
readonly isEmailNotVerified = signal(false);
ngOnInit() {
  const reason = this.route.snapshot.queryParamMap.get('reason');
  this.isEmailNotVerified.set(reason === 'email-not-verified');
}
```

> **Flutter port note:** pass the `reason` as a route parameter (GoRouter query param) and branch the widget tree on a local `BlockedAccessMode` enum.
