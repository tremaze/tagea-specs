# Contracts: Employee Profile

> Verified against `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`, `users/employee-profile.service.ts`, `auth/auth.controller.ts`, `auth/dto/change-password.dto.ts` and `apps/tagea-frontend/src/app/services/employee-self.service.ts` (2026-09-25).

## Services

Exact signatures live in the injected services. Verify during any port.

- `EmployeeSelfService` (`services/employee-self.service.ts`, injected as `employeesService`) — profile (`getCurrentEmployee`, `updateCurrentEmployee`, `deleteOwnAccount`), profile picture (`uploadProfilePicture`, `deleteProfilePicture`), password (`changePassword`, `getPasswordPolicy`), notification settings (`getNotificationSettings`, `updateNotificationSettings`), personal preferences (`getPersonalPreferences`, `updatePersonalPreferences`)
- `SessionLogout` — `logout()` after account deletion
- `SecureImageService` — `loadImage` / `revokeImageUrl` for authenticated profile-picture fetching
- `NotificationSuppressionService` — `load()` re-invoked after notification settings save
- `EmployeeAvailabilityService` — wired for availability read/write (`getByEmployee`, `delete`, `update`), but the owning tab is currently disabled in the component
- `AppointmentTemplatesService` — `getActiveTemplates` (only loaded when an institution context is active)
- `TenantFeaturesService` — feature flags (`isClientPortalEnabled`, `isOutlookCalendarSyncEnabled`)
- `InstitutionsHttpService` — `getCurrent` to resolve the institution address for the availability dialog
- `InstitutionContextService` — `institutionId()` signal gates optional loads
- `LanguageService` — `currentLanguage()` / `setLanguage(...)` used by the preferences form

## Route contract

> Documentation-only shape — actual registration lives in `app.routes.ts` as a sibling of the institution parent route (not inside it). `/einrichtung/:institutionId/employee-profile` redirects to `/employee-profile`.

```ts
// apps/tagea-frontend/src/app/app.routes.ts
{
  path: 'employee-profile',
  loadComponent: () => import('./pages/employee-profile/employee-profile.component').then(m => m.EmployeeProfileComponent),
  canDeactivate: [UnsavedChangesGuard],
}
```

## Backend endpoints

All mounted on the shared `/api` prefix. `EmployeeSelfServiceController` (`@Controller('employees/me')`) is class-level `@Auth({ scope: 'authenticated' })` — no permission beyond being logged in. Every handler answers **404** `User information is required` when the token carries no user id, and **404** `Employee not found` when no employee row matches the token's `authProviderUserId`. Unauthenticated → 401.

| Method + path | Request | Response | Notes |
|---|---|---|---|
| `GET /employees/me` | — | 200 `Employee` (entity, snake_case) | |
| `PATCH /employees/me` | JSON, see below | 200 `Employee` | whitelist in the controller |
| `DELETE /employees/me` | — | 204 | self-service hard delete |
| `GET /employees/me/notifications` | — | 200 `NotificationSettingsResponse` | |
| `PATCH /employees/me/notifications` | JSON, partial `NotificationSettingsResponse` | 200 `Employee` (not the settings shape) | |
| `GET /employees/me/preferences` | — | 200 preferences object with defaults | |
| `PATCH /employees/me/preferences` | JSON, partial preferences | 200 reduced preferences object | shallow merge |
| `POST /employees/me/profile-picture` | multipart, part `file` | 201 `{ url }` | |
| `GET /employees/me/profile-picture` | — | 200 image bytes | 404 when none |
| `DELETE /employees/me/profile-picture` | — | 204 | idempotent |
| `POST /auth/me/change-password` | JSON `ChangePasswordDto` | 201 `{ message, sessionsInvalidated }` | not under `/employees/me` |
| `GET /auth/password-policy` | — | 200 `PasswordPolicyResponse` | `@Public()` |

(`PATCH /employees/me/onboarding` and `GET|PATCH /employees/me/matrix` live on the same controller but are not used by this page.)

### `PATCH /employees/me`

The controller keeps only these keys and silently drops everything else (no 400 for unknown keys — the body is typed `Partial<UpdateEmployeeDto>`, so the global `ValidationPipe` does not validate it):

| Field | Type |
|---|---|
| `first_name` | string |
| `last_name` | string |
| `phone_mobile` | string \| null |
| `phone_landline` | string \| null |
| `email_visible` | boolean |
| `phone_mobile_visible` | boolean |
| `phone_landline_visible` | boolean |

The Angular page also sends `date_of_birth` (ISO date) and `gender`; the backend **drops** both, so they are not persisted through this endpoint. `email` cannot be changed here. There is no server-side `source === 'vivendi-sync'` lock — the lock exists in the UI only.

### `DELETE /employees/me`

Runs the same path as an admin deletion (`EmployeesService.removeFromTenant`, change source `SELF_DELETE`, no caller context → the Träger-Admin protection does not apply): the employee is soft-deleted (`status = deleted`), in-app notifications for the recipient are removed, a Träger-Admin assignment is stripped, and the tenant mapping is removed. The Keycloak user is deleted when the person belongs to no other Träger (the e-mail can register again); otherwise only this tenant's mapping goes and the Keycloak sessions are invalidated.

### Notification settings

```ts
// apps/tagea-frontend/src/app/services/employee-self.service.ts
interface NotificationSettingsResponse {
  email_notifications: boolean;
  appointment_reminders: boolean;
  suppress_on_absence: boolean;
  suppress_outside_working_hours: boolean;
  chat_notifications: boolean;
  notification_channel_preferences: NotificationChannelPreferences; // Record<category, {push?, email?, in_app?}>
  notification_role_overrides: NotificationRoleOverrides;           // Record<role, {ignore_absence_suppression?}>
  in_app_hidden_categories: NotificationCategory[];
}
```

`NotificationCategory`: `submissions`, `approvals`, `appointments`, `articles`, `article_comments`, `tasks`, `events`, `support_tickets`, `support_ticket_mentions`, `messages`, `client_inquiries`. Context roles for overrides: `creator`, `processor`, `supervisor`, `participant`, `mentioned`.

`PATCH` is a partial update without DTO validation (body `Record<string, unknown>`). `notification_channel_preferences`, `notification_role_overrides` and `in_app_hidden_categories` are sanitised server-side (unknown categories/roles/channels dropped); an absent field keeps its stored value. Side effects: a changed `chat_notifications` is synced to the push gateway (mute/unmute); changed `suppress_on_absence` / `suppress_outside_working_hours` recalculate the suppression schedules (fire-and-forget).

What the Angular page sends on save: `suppress_on_absence`, `suppress_outside_working_hours`, `email_notifications: true` (legacy flag kept on), `appointment_reminders` (= Termine push or e-mail on), `chat_notifications` (= Nachrichten push on), `notification_channel_preferences`, `in_app_hidden_categories`. `notification_role_overrides` is omitted.

### Personal preferences

`GET` returns (with defaults): `calendar_default_view` (`'timeGridWeek'`), `interface_language` (`'de'`), `timezone` (`'Europe/Berlin'`), `calendar_selected_employee_ids` (`[]`, deprecated), `calendar_selected_employee_ids_by_institution` (`{}`), `attendance_filter_case_template_id_by_institution` (`{}`), `attendance_view_by_institution` (`{}`), and the `submissions_filter_*`, `submissions_view_mode`, `redaktion_filter_*` keys (`null`).

`PATCH` shallow-merges the body into the stored JSONB (no validation; unknown keys are stored). The response contains only `calendar_default_view`, `interface_language`, `timezone`, `calendar_selected_employee_ids`, `calendar_selected_employee_ids_by_institution`, `attendance_filter_case_template_id_by_institution`, `attendance_view_by_institution`. Documented value sets (Swagger, not enforced): `calendar_default_view` ∈ `dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listWeek`, `listMonth`, `listDay`; `interface_language` ∈ `de`, `en`, `fr`, `tr`, `ro`, `ar`, `ru`, `uk`, `it`, `pl`, `hr`, `fa`, `ku`, `bg`, `sr`, `sq`. The page sends `calendar_default_view`, `interface_language`, `timezone`.

### Profile picture

`POST /employees/me/profile-picture` — `FileInterceptor('file', multerOptionsFor(MEDIA_UPLOAD_PRESETS.avatarImage))`: one file, JPEG/PNG/WebP/GIF, max 10 MB. Wrong type → 400; larger than 10 MB → 413 (multer); missing file → **404** `No file provided`. Raster images are converted to WebP and downscaled to max 400 px; GIFs keep their bytes. Response 201 `{ url }`. The Angular client uploads with `reportProgress` (`HttpEvent`).

`GET` streams the image with `Content-Type` of the stored file and `Cache-Control: private, max-age=3600`; 404 `No profile picture found`. `DELETE` → 204, also when no picture is stored.

### `POST /auth/me/change-password`

> Documentation-only shape — backend DTO `apps/tagea-backend/src/auth/dto/change-password.dto.ts`.

```ts
// documentation-only
class ChangePasswordDto {
  currentPassword: string; // @IsString()
  newPassword: string;     // @IsString() — policy checked in the handler
  totp?: string;           // @IsOptional() @IsString() @Matches(/^\d{6,8}$/)
}
```

Available to employees and clients. Order of checks:

1. `newPassword` against the **effective** policy (Keycloak realm policy + tenant override) → 400 with the joined English violation messages.
2. User has 2FA and no `totp` → 400 `{ code: 'OTP_REQUIRED', message }`.
3. Current password (and TOTP) verified via Keycloak ROPC → 400 `Current password is incorrect`, or with 2FA `{ code: 'INVALID_CREDENTIALS_OR_OTP', message }`.
4. Password set in Keycloak, then **all sessions of the user are invalidated**.

Response 201 `{ message: 'Password changed successfully', sessionsInvalidated: true }`. Any other failure → 400 `Failed to change password`. Nest wraps object errors as `{ statusCode, message: { code, message } }`; the Angular page reads `error.error.message.code`.

### `GET /auth/password-policy`

`@Public()`. Returns the parsed **Keycloak realm** policy only (no tenant override); 400 `Failed to fetch password policy` when Keycloak is unreachable.

> Documentation-only shape — backend `PasswordPolicyResponse` in `apps/tagea-backend/src/auth/services/user-management.service.ts` (the Angular client types it as `Record<string, unknown>`).

```ts
// documentation-only
interface PasswordPolicyResponse {
  minLength?: number;
  minUpperCase?: number;
  minLowerCase?: number;
  minDigits?: number;
  minSpecialChars?: number;
  hashIterations?: number;
  passwordExpireDays?: number;
  notUsername?: boolean;
  notEmail?: boolean;
  notRecentlyUsed?: number;
  rawPolicy: string;
}
```

> **Flutter port note:** send `currentPassword`/`newPassword`/`totp` in camelCase; on `OTP_REQUIRED` reveal the TOTP field and resend. After success the refresh token is dead (sessions invalidated) — the app must expect a re-login.

## Related

Structurally similar to [client-profile](../client-profile/contracts.md). Shares:

- `UnsavedChangesGuard` pattern
- `ProfileCardComponent`
- Profile-picture upload field + secure-image loader pipeline
