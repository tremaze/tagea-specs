# Contracts: Employee Profile

> Verified against `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`, `users/employee-profile.service.ts`, `auth/auth.controller.ts`, `auth/dto/change-password.dto.ts`, `common/global-exception.filter.ts` + `main.ts` (error envelope, `ValidationPipe`), `personal-availability/personal-availability.controller.ts` + `dto/personal-availability.dto.ts`, `outlook-sync/outlook-auth.controller.ts`, `outlook-sync/outlook-sync.controller.ts` + `dto/outlook-sync-config.dto.ts`, and the Angular services `employee-self.service.ts`, `personal-availability.service.ts`, `outlook-sync.service.ts`, `language.service.ts` (2026-09-25).

## Services

Exact signatures live in the injected services. Verify during any port.

- `EmployeeSelfService` (`services/employee-self.service.ts`, injected as `employeesService`) — profile (`getCurrentEmployee`, `updateCurrentEmployee`, `deleteOwnAccount`), profile picture (`uploadProfilePicture`, `deleteProfilePicture`), password (`changePassword`, `getPasswordPolicy`), notification settings (`getNotificationSettings`, `updateNotificationSettings`), personal preferences (`getPersonalPreferences`, `updatePersonalPreferences`)
- `SessionLogout` — `logout()` after account deletion
- `SecureImageService` — `loadImage` / `revokeImageUrl` for authenticated profile-picture fetching
- `NotificationSuppressionService` — `load()` re-invoked after notification settings save
- `PersonalAvailabilityService` (`services/personal-availability.service.ts`) — Erreichbarkeit: `getMeineErreichbarkeit`, `create`, `update`, `remove` (used by `ErreichbarkeitSectionComponent`, which also calls `NotificationSuppressionService.invalidate()` after each reload)
- `OutlookSyncService` (`services/outlook-sync.service.ts`) — used by `OutlookSyncSettingsComponent`: `getConnectionStatus`, `getConfig`, `getCalendars`, `getAuthorizationUrl`, `disconnect`, `updateConfig`, `setSyncEnabled`, `triggerSync`
- `ConfirmationService` (`@tagea/ui`) — `confirm$` for the Outlook disconnect confirmation
- `EmployeeAvailabilityService` — booking-plan read/write (`getByEmployee`, `delete`, `update`), institution-scoped; the owning tab is hard-disabled (`@if (false)`) in the component
- `AppointmentTemplatesService` — `getActiveTemplates` (only loaded when an institution context is active)
- `SessionAuthz` — feature flags via `isFeatureEnabled('outlookCalendarSync' | 'clientPortal' | 'dataSelfDisclosure')` (exposed on the component as `isOutlookCalendarSyncEnabled`, `isClientPortalEnabled`, `isDataSelfDisclosureEnabled`)
- `InstitutionsHttpService` — `getCurrent` to resolve the institution address for the availability dialog
- `InstitutionContext` — `institutionId()` signal gates optional loads
- `LanguageService` — `currentLanguage()` / `setLanguage(...)` used by the preferences form (language list: `AVAILABLE_LANGUAGES` in `core/i18n/languages.config.ts`); `setLanguageAndPersist` is the equivalent used by the language switcher elsewhere — both reload the page in Angular

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

Erreichbarkeit — `PersonalAvailabilityController` (`@Controller('employees/me/availability-windows')`, `@Auth({ scope: 'authenticated' })`, **no feature gate**):

| Method + path | Request | Response | Notes |
|---|---|---|---|
| `GET /employees/me/availability-windows/erreichbarkeit` | — | 200 `MeineErreichbarkeit` | both layers + effective union; what the profile uses |
| `GET /employees/me/availability-windows` | — | 200 `PersonalAvailabilityWindow[]` | own windows only (not used by the page) |
| `POST /employees/me/availability-windows` | `CreatePersonalAvailabilityDto` | 201 `PersonalAvailabilityWindow` | 400 invalid / start ≥ end / overlap |
| `PATCH /employees/me/availability-windows/:id` | `UpdatePersonalAvailabilityDto` | 200 `PersonalAvailabilityWindow` | 404 when not own; `:id` must be a UUID (400) |
| `DELETE /employees/me/availability-windows/:id` | — | 204 | 404 when not own |

(`GET /employees/me/availability/check` on `EmployeeAvailabilitySelfServiceController` is the scheduling conflict check of [employee-availability](../employee-availability/contracts.md) — not used by this page.)

Outlook — `OutlookAuthController` (`@Controller('outlook-auth')`) and `OutlookSyncController` (`@Controller('outlook-sync')`), both `@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.EMPLOYEE] })`:

| Method + path | Request | Response | Notes |
|---|---|---|---|
| `GET /outlook-auth/status` | — | 200 `{ is_connected, feature_enabled }` | no feature check (reports it) |
| `GET /outlook-auth/authorize` | — | 200 `{ url }` | 403 feature off; 409 disconnect cleanup running; 503 OAuth not configured |
| `GET /outlook-auth/callback` | query `code`, `state`, `error`, `error_description` | 302 → `${FRONTEND_URL}/settings/outlook-sync?…` | `@Public()`, called by Microsoft only |
| `POST /outlook-auth/disconnect` | `{}` | 201 `{ success, message }` | revokes tokens, queues removal of exported events |
| `GET /outlook-sync/config` | — | 200 `OutlookSyncConfigResponseDto` | **404 = not connected**; 403 feature off |
| `PUT /outlook-sync/config` | `UpdateOutlookSyncConfigDto` | 200 `OutlookSyncConfigResponseDto` | 404 not connected; changing the calendar clears the delta link (full resync) |
| `PUT /outlook-sync/sync-enabled` | `SetSyncEnabledDto` | 200 `OutlookSyncConfigResponseDto` | 409 when enabling while `needs_reconnect` |
| `GET /outlook-sync/calendars` | — | 200 `OutlookCalendarResponseDto[]` | 401 when no usable Microsoft token |
| `POST /outlook-sync/trigger` | `{}` | 201 `TriggerSyncResponseDto` | runs a full sync synchronously |
| `DELETE /outlook-sync/config` | — | 200 `{ success, message }` | same cleanup as disconnect; not used by the page |

(`GET /outlook-sync/status`, `/events`, `/conflicts` are used by the calendars, not by this page.)

<a id="error-envelope"></a>
### Error envelope (all endpoints)

Every error leaves the backend through `GlobalExceptionFilter` (`common/global-exception.filter.ts`, registered in `main.ts` via `app.useGlobalFilters`). It **flattens** the body — `message` is always a string, a machine `code` is **top-level**:

> Documentation-only shape — built in `GlobalExceptionFilter.catch`.

```ts
// documentation-only
interface ApiErrorBody {
  statusCode: number;
  timestamp: string;      // ISO
  path: string;           // request URL
  method: string;
  message: string;        // string; array messages (ValidationPipe) are joined with ', '
  code?: string;          // only when the thrown HttpException body had a `code` (or a mapped DB invariant)
  // + any other non-reserved keys of the thrown body, spread top-level
  // + `error` and `stack` only when NODE_ENV=development
}
```

- `throw new BadRequestException('text')` → `{ statusCode: 400, message: 'text', … }` — no `code`.
- `throw new BadRequestException({ code: 'X', message: 'text' })` → `{ statusCode: 400, message: 'text', code: 'X', … }`.
- `ValidationPipe` (global, `whitelist` + `forbidNonWhitelisted`) → 400, `message` = joined class-validator messages (unknown properties are rejected, e.g. `property foo should not exist`).

**Clients must read `body.code` (top-level) and treat `body.message` as a display/debug string.** There is no `message.code`.

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

Runs the same path as an admin deletion (`EmployeesService.removeFromTenant`, change source `SELF_DELETE`, no caller context → the Träger-Admin protection does not apply): the employee is soft-deleted (`status = deleted`), in-app notifications for the recipient are removed, a Träger-Admin assignment is stripped, and the tenant mapping is removed. The Keycloak user is deleted when the person belongs to no other Träger (the e-mail can register again); otherwise only this tenant's mapping goes and the Keycloak sessions are invalidated. Not touched by the deletion: the Outlook connection (tokens, Graph subscription, exported events — `removeFromTenant` has no Outlook cleanup), own Erreichbarkeit windows, push-gateway registrations. The client is responsible for unregistering push before its local logout; the Outlook leftover is an open backend question.

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

0. DTO validation (`ValidationPipe`): missing/non-string fields, `totp` not 6–8 digits, unknown keys → 400, joined messages, no `code`.
1. `newPassword` against the **effective** policy (Keycloak realm policy + tenant override) → 400, `message` = comma-joined English violation messages, no `code`.
2. User has 2FA and no `totp` → 400 with top-level `code: 'OTP_REQUIRED'`.
3. Current password (and TOTP) verified via Keycloak ROPC → without 2FA: 400 `message: 'Current password is incorrect'`, no `code`; with 2FA: 400 `code: 'INVALID_CREDENTIALS_OR_OTP'`.
4. Password set in Keycloak, then **all sessions of the user are invalidated**.

Response 201 `{ message: 'Password changed successfully', sessionsInvalidated: true }`. Any other failure (Keycloak errors etc.) → 400 `message: 'Failed to change password'`, no `code`. `NotFoundException` / `UnauthorizedException` from missing principal pass through as 404 / 401.

Wire bodies after the `GlobalExceptionFilter` (production; `timestamp` / `path` / `method` elided as `…`):

```json
{ "statusCode": 400, "message": "Two-factor authentication is enabled. Provide the current TOTP code.", "code": "OTP_REQUIRED", "timestamp": "…", "path": "/api/auth/me/change-password", "method": "POST" }
{ "statusCode": 400, "message": "Current password or TOTP code is incorrect", "code": "INVALID_CREDENTIALS_OR_OTP", "timestamp": "…", "path": "…", "method": "POST" }
{ "statusCode": 400, "message": "Current password is incorrect", "timestamp": "…", "path": "…", "method": "POST" }
{ "statusCode": 400, "message": "<violation 1>, <violation 2>", "timestamp": "…", "path": "…", "method": "POST" }
```

> **Angular bug:** `EmployeeProfileComponent.extractErrorBody` (`employee-profile.component.ts` ~l. 1187) expects the code in `error.error.message.code` (an object `message`). Because `message` is always a string, it returns `{ message }` only — the `OTP_REQUIRED` / `INVALID_CREDENTIALS_OR_OTP` branches of `handlePasswordChangeError` never run and 2FA users cannot change their password on web. Fix: read `error.error.code`.

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

> **Flutter port note:** send `currentPassword`/`newPassword`/`totp` in camelCase; branch on the **top-level** `code` of the error body (`OTP_REQUIRED` → reveal the TOTP field and resend; `INVALID_CREDENTIALS_OR_OTP` → wrong password or code), fall back to `message == 'Current password is incorrect'` only when `code` is absent. After success the refresh token is dead (sessions invalidated) — the app must expect a re-login.

### Erreichbarkeit (`/employees/me/availability-windows`)

```ts
// apps/tagea-frontend/src/app/services/personal-availability.service.ts
interface Zeitfenster {
  weekday: number;     // ISO 1 = Monday … 7 = Sunday
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
}
interface ErreichbarkeitsFenster extends Zeitfenster {
  id: string;
  herkunft: 'geplant' | 'eigen'; // geplant = active WorkingHoursTemplate (read-only), eigen = own window
}
interface MeineErreichbarkeit {
  fenster: ErreichbarkeitsFenster[]; // both layers, sorted by weekday, start_time
  wirksam: Zeitfenster[];            // effective union, overlap-free — what „Nicht stören“ evaluates
}
interface PersonalAvailabilityWindow extends Zeitfenster {
  id: string;
  employee_id: string;
  is_active: boolean;
}
```

> Documentation-only shape — backend `CreatePersonalAvailabilityDto` / `UpdatePersonalAvailabilityDto` in `apps/tagea-backend/src/personal-availability/dto/personal-availability.dto.ts`.

```ts
// documentation-only
class CreatePersonalAvailabilityDto {
  weekday: number;    // @IsInt @Min(1) @Max(7)
  start_time: string; // @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  end_time: string;   // same pattern
}
type UpdatePersonalAvailabilityDto = Partial<CreatePersonalAvailabilityDto>;
```

No `employee_id` and no `is_active` on the wire: the row always belongs to the caller and is always active. The Angular `CreatePersonalAvailabilityDto` type declares an optional `is_active`, but sending it is rejected with 400 by `forbidNonWhitelisted` — do not send it. Server errors (German `message`): `Startzeit muss vor der Endzeit liegen` (400), `Das Zeitfenster überschneidet sich mit einem bereits hinterlegten` (400, same weekday overlap with another own window), `Erreichbarkeitsfenster wurde nicht gefunden` (404, also for foreign ids), `Mitarbeiter:in wurde nicht gefunden` (404). Each mutation recomputes the caller's notification-suppression schedule server-side.

### Outlook (`/outlook-auth`, `/outlook-sync`)

```ts
// apps/tagea-frontend/src/app/services/outlook-sync.service.ts
interface OutlookSyncConfig {
  id: string;
  is_connected: boolean;
  uses_sso_token: boolean;
  sync_enabled: boolean;      // per-user background-sync opt-in; false right after connect
  needs_reconnect: boolean;   // token_expired or no refresh token
  selected_calendar_id: string | null;
  selected_calendar_name: string | null;
  sync_outlook_to_tagea: boolean;
  sync_tagea_to_outlook: boolean;
  sync_status: 'active' | 'paused' | 'error' | 'token_expired' | 'disconnecting';
  last_sync_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}
interface UpdateOutlookSyncConfig {
  selected_calendar_id?: string;
  selected_calendar_name?: string;
  sync_outlook_to_tagea?: boolean;
  sync_tagea_to_outlook?: boolean;
}
interface OutlookCalendar {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
  can_edit: boolean;
}
interface SyncResult {
  success: boolean;
  events_imported: number;
  events_exported: number;
  events_updated: number;
  events_deleted: number;
  errors?: string[];
  synced_at: string;
}
interface ConnectionStatus {
  is_connected: boolean;
  feature_enabled: boolean;
}
```

Backend DTOs (`outlook-sync/dto/outlook-sync-config.dto.ts`): `UpdateOutlookSyncConfigDto` (all optional; `selected_calendar_id` / `selected_calendar_name` strings ≤ 255, direction flags booleans), `SetSyncEnabledDto { sync_enabled: boolean }` (required), response shapes as above (`OutlookSyncConfigResponseDto`, `OutlookCalendarResponseDto`, `TriggerSyncResponseDto`).

**OAuth flow (server-side code exchange):**

1. Client → `GET /outlook-auth/authorize` → `{ url }` = `https://login.microsoftonline.com/<MICROSOFT_TENANT_ID>/oauth2/v2.0/authorize?client_id=…&response_type=code&redirect_uri=<MICROSOFT_REDIRECT_URI>&response_mode=query&scope=User.Read Calendars.Read Calendars.ReadWrite offline_access&state=<signed>`. No `prompt=consent`. `state` is HMAC-signed (`OutlookOAuthStateService`) with `employeeId` + `tenantId` and a 15-minute TTL.
2. Microsoft → `GET /outlook-auth/callback` on the backend (`redirect_uri` = env `MICROSOFT_REDIRECT_URI`, one value per deployment). The backend verifies `state`, exchanges the code, stores the encrypted tokens.
3. Backend → **302** to `${FRONTEND_URL}/settings/outlook-sync` with `?success=true`, or `?error=<code>&message=<url-encoded English text>` where `code` ∈ Microsoft's `error` value, `invalid_request` (missing code/state), `invalid_state` (forged/expired state), `cleanup_in_progress` (disconnect still running), `token_exchange_failed`.

`FRONTEND_URL` is a single global env var (required in production); the path is hard-coded. There is **no** client-supplied return URL, no tenant-specific host and no custom-scheme / app-link variant — a native client can only (a) register app links for the `FRONTEND_URL` host, or (b) re-read `GET /outlook-sync/config` when the auth session closes. Angular defines **no** `/settings/outlook-sync` route, so on web the redirect falls through to the `**` landing redirect and the query parameters are ignored.

Disconnect (`POST /outlook-auth/disconnect`) message: `Microsoft-Konto getrennt. Exportierte Termine werden im Hintergrund aus Outlook entfernt.` when exported events are queued for removal, else `Microsoft-Konto erfolgreich getrennt`. Until that background cleanup ends (`sync_status: 'disconnecting'`), `authorize` and the callback answer 409 / `cleanup_in_progress`.

### UI language

Persisted as `interface_language` inside the employee `preferences` JSONB via `PATCH /employees/me/preferences` (see *Personal preferences*; not validated server-side — the client must only send one of the 16 codes). Supported codes = `ALL_LANGUAGE_CODES` in `core/i18n/languages.config.ts` = the files in `apps/tagea-frontend/src/assets/i18n/`: `de`, `en`, `fr`, `tr`, `ro`, `ar`, `ru`, `uk`, `it`, `pl`, `hr`, `fa`, `ku`, `bg`, `sr`, `sq`. RTL: `ar`, `fa`. Default / fallback `de`. Angular also caches the choice in `localStorage` (`app-language`).

## Related

Structurally similar to [client-profile](../client-profile/contracts.md). Shares:

- `UnsavedChangesGuard` pattern
- `ProfileCardComponent`
- Profile-picture upload field + secure-image loader pipeline
