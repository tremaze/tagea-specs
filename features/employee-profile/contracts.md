# Contracts: Employee Profile

## Services

Exact signatures live in the injected services. Verify during any port.

- `EmployeesService` — profile CRUD (`getCurrentEmployee`, `updateCurrentEmployee`, `deleteOwnAccount`), profile picture (`uploadProfilePicture`, `deleteProfilePicture`), password (`changePassword`, `getPasswordPolicy`), notification settings (`getNotificationSettings`, `updateNotificationSettings`), personal preferences (`getPersonalPreferences`, `updatePersonalPreferences`)
- `CurrentEmployeeService` — `refreshCurrentEmployee` after profile updates
- `UnifiedAuthService` — `logout` on account deletion
- `SecureImageService` — `loadImage` / `revokeImageUrl` for authenticated profile-picture fetching
- `NotificationSuppressionService` — `load()` re-invoked after notification settings save
- `EmployeeAvailabilityService` — wired for availability read/write (`getByEmployee`, `delete`, `update`), but the owning tab is currently disabled in the component
- `AppointmentTemplatesService` — `getActiveTemplates` (only loaded when an institution context is active)
- `TenantFeaturesService` — feature flags (`isClientPortalEnabled`, `isOutlookCalendarSyncEnabled`)
- `InstitutionsHttpService` — `getCurrent` to resolve the institution address for the availability dialog
- `InstitutionContextService` — `institutionId()` signal gates optional loads
- `LanguageService` — `currentLanguage()` / `setLanguage(...)` used by the preferences form

## Route contract

> Documentation-only shape — actual registration lives in `app.routes.ts` under the institution-parented tree; the excerpt below omits the wrapping parent route.

```ts
// apps/tagea-frontend/src/app/app.routes.ts
{
  path: 'employee-profile',
  loadComponent: () => import('./pages/employee-profile/employee-profile.component').then(m => m.EmployeeProfileComponent),
  canDeactivate: [UnsavedChangesGuard],
}
```

## Backend endpoints (consumed)

All mounted on the shared `/api` prefix.

- `GET    /employees/me` — current employee
- `PATCH  /employees/me` — update own profile
- `DELETE /employees/me` — self-service account deletion
- `POST   /employees/me/change-password` — password change (Keycloak-backed)
- `GET    /employees/me/password-policy` — Keycloak password policy for the current realm
- `GET    /employees/me/notification-settings`, `PATCH /employees/me/notification-settings`
- `GET    /employees/me/personal-preferences`, `PATCH /employees/me/personal-preferences`
- `POST   /employees/me/profile-picture` (multipart, emits `HttpEvent`), `DELETE /employees/me/profile-picture`, `GET /employees/me/profile-picture` (binary via `SecureImageService`)

## Related

Structurally similar to [client-profile](../client-profile/contracts.md). Shares:

- `UnsavedChangesGuard` pattern
- `ProfileCardComponent`
- Profile-picture cropper + secure-image loader pipeline
