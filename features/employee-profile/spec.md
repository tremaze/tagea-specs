# Feature: Employee Profile (Own)

> **Status:** 🟢 Implemented in Angular; Flutter port planned (M2)
> **Owner:** ltoenjes
> **Last updated:** 2026-09-25 (M2-Specs QA: owner decision „full scope in M2“ — Erreichbarkeit, Outlook calendar connection, runtime UI-language switch and account-deletion cleanup specified; password-change error shape corrected to the flat `GlobalExceptionFilter` envelope, Angular 2FA divergence documented)

## Vision (Elevator Pitch)

Self-service profile page at `/employee-profile` for staff to manage their own personal data (Stammdaten), profile picture, password, notification settings including their own availability („Erreichbarkeit“), personal preferences (calendar view / interface language / timezone), the Outlook calendar connection, and to delete their own account. Tabbed layout on desktop / stacked on mobile. Unsaved-changes guard protects against data loss.

**M2 scope (owner decision 2026-09-25):** Stammdaten, Bild, Passwort, Benachrichtigungen (incl. Erreichbarkeit), UI-Sprache, Konto löschen, Verfügbarkeiten and Outlook are **all in scope** for the Flutter port.

## User Stories

- As a **staff member** I want to update my personal data, so that my profile stays accurate.
- As a **staff member** I want to manage my notification settings, so that I only get the notifications I care about.
- As a **staff member** I want to upload a profile picture, so that colleagues can recognize me.
- As a **staff member** I want to change my password, so that I can maintain account security.
- As a **staff member** I want to change my interface language / calendar default view, so that the app fits my workflow.
- As a **staff member** I want to maintain the times when Tagea may notify me („Meine Erreichbarkeit“), so that „Nicht stören“ matches my real availability.
- As a **staff member** I want to connect my Outlook calendar, so that my Tagea appointments and Outlook events show up in both places.
- As a **staff member** I want to delete my account, so that I can leave the tenant on my own.
- As a **staff member** I want the app to warn me before I lose unsaved changes, so that I don't accidentally discard edits.

## Acceptance Criteria

### Load & layout

- [ ] **Given** the page loads, **When** `GET /employees/me` resolves, **Then** `ProfileCardComponent` renders with basic info; a failure shows „Fehler beim Laden des Profils“.
- [ ] **Given** the user is on desktop, **When** the layout is wide enough, **Then** the page renders a tabbed layout; on mobile (`max-width: 768px`) the profile card opens via `ProfileBottomSheetComponent`.
- [ ] **Given** the user has unsaved changes in any form, **When** they attempt to navigate away, **Then** `UnsavedChangesGuard` (`canDeactivate`) opens `UnsavedChangesDialogComponent` with save/discard/cancel actions.

### Personal data

- [ ] Form: `first_name`, `last_name` (required), `email` (read-only), `phone_mobile`, `phone_landline`, `date_of_birth`, `gender`, visibility toggles `email_visible`, `phone_mobile_visible`, `phone_landline_visible`.
- [ ] Save → `PATCH /employees/me`; success „Deine Daten wurden erfolgreich gespeichert“, failure „Die Änderungen konnten nicht gespeichert werden. Bitte versuche es später erneut.“
- [ ] The backend persists only `first_name`, `last_name`, `phone_mobile`, `phone_landline` and the three visibility toggles; other keys are dropped silently. **Current behaviour:** `date_of_birth` and `gender` are editable in the form and sent, but not saved *(open product question — a Flutter port should not offer them as editable until resolved)*.

### Profile picture

- [ ] **Given** the user picks a picture, **When** it passes the shared `avatarImage` rules (JPEG/PNG/WebP/GIF, ≤ 10 MB), **Then** a round 1:1 cropper opens; on confirm the cropped image is uploaded via `POST /employees/me/profile-picture` (part `file`) and the avatar refreshes. Invalid files are rejected with a message before the cropper opens.
- [ ] Removing the picture calls `DELETE /employees/me/profile-picture` (204).
- [ ] The picture is always loaded through the authenticated `GET /employees/me/profile-picture` (`SecureImageService`), never as a public URL.

### Notification settings

- [ ] The tab shows the two „do not disturb“ toggles (`suppress_on_absence`, `suppress_outside_working_hours`) and a per-topic channel grid (push / e-mail / in-app per `NotificationCategory`) loaded from `GET /employees/me/notifications`.
- [ ] Save → `PATCH /employees/me/notifications` with the toggles, the channel grid (`notification_channel_preferences`), hidden in-app categories, `email_notifications: true`, `appointment_reminders` (= Termine push or e-mail on) and `chat_notifications` (= Nachrichten push on); success „Benachrichtigungseinstellungen wurden gespeichert“ and the suppression state is reloaded; failure „Fehler beim Speichern der Einstellungen“.

### Personal preferences

- [ ] Fields `calendar_default_view`, `interface_language`, `timezone` (from `GET /employees/me/preferences`, defaults `timeGridWeek` / `de` / `Europe/Berlin`).
- [ ] Save → `PATCH /employees/me/preferences` (partial merge); success „Persönliche Einstellungen wurden gespeichert“, failure „Fehler beim Speichern der Einstellungen“. A changed `interface_language` is applied at runtime (see *UI language*).

### Change password

- [ ] Form: current password, new password, confirmation (must match), optional 2FA code (6–8 digits). The new password is validated live against the policy from `GET /auth/password-policy` (min length, upper/lower case, digits, special characters) with a strength indicator („Schwach“ / „Mittel“ / „Stark“) and the requirement list („Passwort-Anforderungen:“).
- [ ] If loading the policy fails, the fallback is min length 8, 1 upper case, 1 lower case, 1 digit, 0 special characters.
- [ ] Submit → `POST /auth/me/change-password` `{ currentPassword, newPassword, totp? }`. The server validates against the **effective** policy (realm + tenant override), which may be stricter than the policy shown.
- [ ] The 2FA field is hidden until the server asks for it. Error handling reads the **top-level `code`** of the flat error body (`{ statusCode, message: '<string>', code?, timestamp, path, method }` — see [contracts.md](./contracts.md#error-envelope)):
  - `code === 'OTP_REQUIRED'` → the 2FA field („2FA-Code“) appears and becomes required (6–8 digits), the hint „Zwei-Faktor-Authentifizierung ist für dein Konto aktiviert. Bitte gib den aktuellen Code aus deiner Authenticator-App ein.“ is shown under it and „Bitte gib zusätzlich deinen aktuellen 2FA-Code ein.“ is announced; the user resubmits with `totp`.
  - `code === 'INVALID_CREDENTIALS_OR_OTP'` → „Das aktuelle Passwort oder der 2FA-Code ist falsch“; the 2FA field stays visible.
  - no `code` and `message === 'Current password is incorrect'` → „Das aktuelle Passwort ist falsch“.
  - anything else (policy violation — `message` is the comma-joined English violation list —, DTO validation, `Failed to change password`, network) → „Fehler beim Ändern des Passworts“.
- [ ] Cancelling resets the form, hides the 2FA field again and drops its `required` rule.

> **Angular divergence (bug):** `EmployeeProfileComponent.extractErrorBody` (`employee-profile.component.ts` ~l. 1187, called from `handlePasswordChangeError` ~l. 1143) only looks for an **object** in `error.error.message`. The backend's `GlobalExceptionFilter` always flattens `message` to a string and puts `code` at the top level, so `extractErrorBody` returns `{ message }` without `code`. Result: the `OTP_REQUIRED` and `INVALID_CREDENTIALS_OR_OTP` branches are dead code — a user with 2FA only ever sees „Fehler beim Ändern des Passworts“, the 2FA field (rendered only when `otpRequired`) never appears, and **users with 2FA cannot change their password in the web app**. The wrong-password case without 2FA works (string match on `message`). Flutter implements the target behaviour above; see the divergence row in [parity.md](./parity.md).
- [ ] Success → „Passwort wurde erfolgreich geändert“, form reset. The backend invalidates **all** sessions of the user, so the next token refresh fails and the user has to log in again.

### Delete own account

- [ ] The danger zone „Konto löschen“ („Wenn du dein Konto löschst, kannst du dich nicht mehr anmelden.“) opens a confirmation („Konto löschen?“ / „Bist du sicher, dass du dein Konto löschen möchtest? Du wirst abgemeldet und kannst dich nicht mehr anmelden.“ / „Ja, Konto löschen“ / „Abbrechen“).
- [ ] The destructive button is styled as an error action; „Abbrechen“ or dismissing the dialog does nothing.
- [ ] Confirm → `DELETE /employees/me` (204). While the request is in flight the confirm action is disabled (no double submit). Failure (any non-2xx / network) → „Fehler beim Löschen des Kontos. Bitte versuche es erneut.“ and the user stays logged in on the page.
- [ ] On 204 the client ends the session **locally and completely**, in this order, each step best-effort (a failing step never aborts the rest):
  1. Unregister the device's push subscription (while the access token is still usable) and disconnect the chat (Matrix) client.
  2. Wipe all per-user local state: tokens and refresh token in secure storage (Keychain / Keystore / web storage), the session snapshot, tenant/institution selection, cached API data and images (incl. the profile picture), offline caches/databases, chat keys and local drafts belonging to this user.
  3. End the OIDC session (Keycloak `end_session`; on web this is a full-page redirect and the client must **not** race it with an in-app navigation). If the IdP call fails (e.g. the Keycloak user was already deleted), still finish locally.
  4. Land on the logged-out entry (`/welcome`). Flutter shows no success snackbar (`employeeProfile.deleteAccount.success` „Dein Konto wurde erfolgreich gelöscht.“ exists but is unused in Angular; showing it on the welcome screen is optional).
- [ ] After deletion the old refresh token is dead; the app must not attempt a silent re-login with it.
- [ ] Server effect: the employee is soft-deleted in this Träger and loses the tenant mapping; if the person belongs to no other Träger the Keycloak account is deleted (the e-mail can register again), otherwise the Keycloak account stays for the other Träger. No additional permission is needed and the Träger-Admin protection does not block deleting oneself.

### Erreichbarkeit (own availability windows) — „Verfügbarkeiten“

Lives in the notifications tab directly under the „Nicht stören außerhalb der Arbeitszeit“ toggle, because its only purpose is to feed that toggle (`ErreichbarkeitSectionComponent`, #3721). It is **not** gated by any tenant feature (no `timeTracking` / `pep` / contract required).

- [ ] **Given** the tab opens, **When** `GET /employees/me/availability-windows/erreichbarkeit` resolves, **Then** the windows are split by `herkunft`: `geplant` windows (planned working hours set by the employer) render as a **read-only** Mo–So grid „Geplante Arbeitszeit“ („Von Deiner Einrichtung geplant. Hier kannst Du sie nicht ändern.“) with the hint „Während Deiner geplanten Arbeitszeit bist Du immer erreichbar. Eigene Zeiten kommen hinzu – sie nehmen nichts weg.“ — shown only when at least one `geplant` window exists; `eigen` windows render as the editable grid „Meine Erreichbarkeit“ („Zusätzliche Zeiten, in denen Tagea Dich benachrichtigen darf.“). Empty days read „Frei“. Load failure → „Deine Erreichbarkeit konnte nicht geladen werden.“
- [ ] „Zeit hinzufügen“ lets the user pick one **or several** weekdays plus `start_time`/`end_time` (`HH:MM`); the client sends one `POST /employees/me/availability-windows` `{ weekday, start_time, end_time }` per weekday. „Zeit bearbeiten“ → `PATCH /employees/me/availability-windows/:id` `{ start_time, end_time }`. Delete asks „Zeit löschen“ / „Soll dieses Zeitfenster wirklich gelöscht werden?“ → `DELETE /employees/me/availability-windows/:id` (204).
- [ ] After **every** mutation — success or failure — the list is reloaded from `GET …/erreichbarkeit` (a multi-weekday create may have partially succeeded) and the client-side notification-suppression cache is invalidated so the new windows take effect without an app restart. Failures: create/update → „Das Zeitfenster konnte nicht gespeichert werden.“, delete → „Das Zeitfenster konnte nicht gelöscht werden.“
- [ ] Server rules the UI must expect: `start_time < end_time` on the same day (400 „Startzeit muss vor der Endzeit liegen“); no overlap with another own window on the same weekday (400 „Das Zeitfenster überschneidet sich mit einem bereits hinterlegten“); a foreign or unknown id → 404. `geplant` windows are never editable through this API.
- [ ] Erreichbarkeit windows are independent of the notifications form: they save immediately and do **not** mark the notifications form dirty.

> **Scope note — booking availability plans („Verfügbarkeit & Buchung“):** the profile also contains a booking-plan tab (`availabilityBooking`, `AvailabilityDialogComponent`, institution-scoped `/institutions/:institutionId/employee-availability`), but it is hard-disabled in Angular (`@if (false)`); booking plans are managed from the institution calendar (`ManageAvailabilityDialogComponent` in `calendar-page`), gated by the `clientPortal` feature and `appointments.*` permissions, and are not self-service endpoints. `GET /employees/me/availability/check` (see [employee-availability](../employee-availability/spec.md)) is a scheduling conflict check, not a profile surface. This spec therefore reads the owner's „Verfügbarkeiten“ as **Erreichbarkeit**; whether booking plans should additionally appear in the Flutter profile is an open product question (see parity.md).

### Calendar connections (Outlook)

Tab „Kalender-Verbindungen“ (`employeeProfile.tabs.calendarConnections`), rendered only when the tenant feature `outlookCalendarSync` is enabled (`SessionAuthz.isFeatureEnabled('outlookCalendarSync')`); content is `OutlookSyncSettingsComponent`. Employees only (clients get 403 from the endpoints).

- [ ] **Load:** `GET /outlook-sync/config`. 404 = never connected → *not connected* state (expected, not an error). While loading: „Lade Einstellungen...“. When connected and not `needs_reconnect`, the calendar list is loaded from `GET /outlook-sync/calendars`.
- [ ] **Not connected:** heading „Outlook-Kalender verbinden“, text „Verbinde dein Microsoft-Konto, um Outlook-Termine in Tagea zu sehen und Tagea-Termine in Outlook anzuzeigen.“, button „Mit Microsoft anmelden“, privacy note „Deine Tagea-Termine werden nur mit Zeit und Kategorie exportiert. Klientennamen und sensible Daten werden nicht übertragen.“
- [ ] **Connect:** `GET /outlook-auth/authorize` → `{ url }` (Microsoft authorize URL with a signed `state`, valid 15 min) → open it (see *OAuth return* below). Errors: 409 (a previous disconnect is still cleaning up) → show the backend `message`; 403 (feature off) / 503 (Microsoft OAuth not configured on the server) / other → backend message or „Verbindung konnte nicht gestartet werden“. The button shows a spinner and is disabled while connecting.
- [ ] **Connected — status:** heading „Outlook-Kalender“ / „Synchronisiere deinen Outlook-Kalender mit Tagea“; status pill derived from the config: `needs_reconnect` → „Reconnect nötig“ (warning), else `sync_enabled` → „Sync aktiv“, else „Sync aus“. „Letzter Sync:“ shows `last_sync_at` (localized date+time) or „Nie“; a non-null `last_error_message` is shown verbatim.
- [ ] **Reconnect needed** (`needs_reconnect`: token expired or legacy SSO row without refresh token): shows „Deine Microsoft-Verbindung muss erneuert werden, damit die Synchronisation wieder funktioniert.“ and „Neu verbinden“ (same flow as connect); the sync toggle, calendar picker, direction toggles and „Jetzt synchronisieren“ are hidden/disabled.
- [ ] **Background sync opt-in:** toggle „Sync aktiv“ („Synchronisiert deinen Kalender automatisch im Hintergrund. Verbinden allein startet noch keinen Sync.“) → `PUT /outlook-sync/sync-enabled` `{ sync_enabled }`; optimistic, reverts to the server value on failure („Synchronisierungsstatus konnte nicht geändert werden“); success „Hintergrund-Synchronisation aktiviert“ / „… deaktiviert“. Enabling while reconnect is needed → 409.
- [ ] **Calendar picker** „Outlook-Kalender“ (hint „Wähle den Kalender für die Synchronisation“, default calendar marked „(Standard)“) → `PUT /outlook-sync/config` `{ selected_calendar_id, selected_calendar_name }` (server forces a full resync); „Kalender aktualisiert“ / „Kalender konnte nicht aktualisiert werden“.
- [ ] **Directions:** „Outlook-Termine importieren“ („Zeigt Outlook-Termine im Tagea-Kalender an (nur lesen)“) and „Tagea-Termine exportieren“ („Erstellt Tagea-Termine in Outlook (nur Zeit & Kategorie)“) → `PUT /outlook-sync/config` with both `sync_outlook_to_tagea` and `sync_tagea_to_outlook`; „Einstellungen gespeichert“ / „Einstellungen konnten nicht gespeichert werden“.
- [ ] **Manual sync** „Jetzt synchronisieren“ → `POST /outlook-sync/trigger`; then reload the config. `success: true` → „Sync erfolgreich: {{imported}} importiert, {{exported}} exportiert“; `success: false` → the joined `errors` or „Sync fehlgeschlagen“.
- [ ] **Disconnect:** warning „Verbindung trennen entfernt die Microsoft-Verbindung, alle gecachten Daten und die aus Tagea nach Outlook exportierten Termine aus deinem echten Outlook-Kalender.“ → confirmation („Verbindung trennen“ / „Möchtest du die Microsoft-Verbindung wirklich trennen? Dabei werden auch deine aus Tagea exportierten Termine aus dem echten Outlook-Kalender entfernt.“ / „Verbindung trennen“ / „Abbrechen“) → `POST /outlook-auth/disconnect` → back to *not connected*; show the server `message` (e.g. „Microsoft-Konto getrennt. Exportierte Termine werden im Hintergrund aus Outlook entfernt.“) or „Verbindung getrennt“; failure „Trennen fehlgeschlagen“. Until the background cleanup finishes, a new connect answers 409.

#### OAuth return (target behaviour)

The backend runs the authorization-code exchange itself: Microsoft redirects to the **backend** callback `GET /outlook-auth/callback` (the single, server-configured `MICROSOFT_REDIRECT_URI`), which stores the tokens and then answers **302** to a fixed web URL: `${FRONTEND_URL}/settings/outlook-sync?success=true` or `?error=<code>&message=<text>` (`error` ∈ Microsoft's error code, `invalid_request`, `invalid_state`, `cleanup_in_progress`, `token_exchange_failed`). The client never sees the code or tokens; it only needs to notice that the user came back and re-read `GET /outlook-sync/config`.

- [ ] **Web (Flutter web):** open the authorize URL in the same tab. The route `/settings/outlook-sync` must exist and forward to `/employee-profile` with the *Kalender-Verbindungen* tab selected, reading `success` / `error` / `message` once: success → reload config and confirm the connection; error → show an error with the (English) `message` (or a German text mapped from `error`), then strip the query parameters.
- [ ] **iOS / Android:** open the authorize URL in the **system browser session** (`ASWebAuthenticationSession` on iOS, Custom Tabs on Android — never an embedded WebView, Microsoft blocks those for many tenants). The return must hand control back to the app: target is an app link / universal link (`https://<frontend-host>/settings/outlook-sync…`, verified via `apple-app-site-association` / `assetlinks.json`) or a custom scheme, which the app routes to the calendar-connections tab and handles like web. **Fallback that works with today's backend:** when the auth session is dismissed (user closes it, or the flow ends on the web page), re-fetch `GET /outlook-sync/config` on return to foreground and show the resulting state — the token exchange already happened server-side.
- [ ] Whatever the platform, a successful connect leaves background sync **off** (`sync_enabled: false`) until the user turns on „Sync aktiv“.

> **Gap (backend):** the callback supports **only a web return URL** — a single global `FRONTEND_URL` + hard-coded path `/settings/outlook-sync`; there is no per-request `return_to`/`redirect_uri`, no tenant-specific frontend host and no custom-scheme support. Native apps therefore depend on (a) app links for `FRONTEND_URL` being configured, or (b) the foreground re-fetch fallback. Also flagged: **Angular has no route `/settings/outlook-sync`** — the redirect lands on the `**` catch-all (landing redirect), the `success`/`error` query parameters are ignored and the user is not taken back to the profile tab (divergence, see parity.md).

### UI language

- [ ] The preferences tab offers all 16 UI languages (`AVAILABLE_LANGUAGES`, native names): `de` Deutsch, `en` English, `fr` Français, `tr` Türkçe, `ro` Română, `ar` العربية (RTL), `ru` Русский, `uk` Українська, `it` Italiano, `pl` Polski, `hr` Hrvatski, `fa` فارسی (RTL), `ku` Kurdî, `bg` Български, `sr` Српски, `sq` Shqip — one translation file each under `assets/i18n/<code>.json`. Default and fallback: `de`.
- [ ] The language is persisted server-side as `interface_language` in the employee preferences via `PATCH /employees/me/preferences` (together with `calendar_default_view` and `timezone` on „Einstellungen speichern“) and restored after login from `GET /employees/me/preferences`; a local copy is kept so the app starts in the last language before the session is ready.
- [ ] **Flutter:** after a successful save the app switches locale **at runtime without a restart/reload**: the whole widget tree rebuilds with the new translations, text direction flips to RTL for `ar` / `fa`, date/number formats follow the locale, and server data that is delivered already translated (e.g. articles/news, events) is re-fetched / its caches invalidated. The preferences success message is shown in the new language.
- [ ] If the save fails, the language is **not** switched (Flutter) and „Fehler beim Speichern der Einstellungen“ is shown (same message as any preferences save failure).

> **Angular divergence (by design of the web app):** Angular applies the language and then calls `window.location.reload()` (component and `LanguageService.setLanguageAndPersist`) instead of showing the snackbar, to refresh server-translated content. Flutter must not reload.

### Source-based field locking

- [ ] **Given** the loaded employee has `source === 'vivendi-sync'`, **Then** stammdaten fields on the personal-data tab (`first_name`, `last_name`, `email`, `phone_mobile`, `phone_landline`, `date_of_birth`, `gender`) render as **disabled** with the Vivendi-managed hint (i18n key `employeeDialog.vivendiManagedHint`) — same convention as `EmployeeDialogComponent`.
- [ ] **Given** the employee has `source === 'manual'` (or undefined), **Then** all stammdaten fields remain editable; `email` stays read-only because the address is owned by Keycloak, not the source-lock.
- [ ] **Given** the locks apply, **Then** the visibility toggles (`email_visible`, `phone_mobile_visible`, `phone_landline_visible`), profile picture upload, notification settings, Erreichbarkeit, personal preferences, calendar connections, password change and account deletion remain available — they are personal preferences, not stammdaten.

## UI States

| State         | When?                                | Rendering                                                                            |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Loading       | Initial fetch                        | Spinner                                                                              |
| Loaded        | Profile resolved                     | Tabs: Persönliche Daten (incl. picture, delete account) · Sicherheit · Benachrichtigungen (incl. Erreichbarkeit) · Persönliche Einstellungen · Kalender-Verbindungen (only with `outlookCalendarSync`) · Datenauskunft (only with `dataSelfDisclosure`) |
| Changing password | Password change in-flight        | Submit disabled (`changingPassword`)                                                 |
| OTP required  | Server answered top-level `code: 'OTP_REQUIRED'` | 2FA code field visible + required, hint shown (Angular never reaches this state — see divergence) |
| Outlook not connected | `GET /outlook-sync/config` → 404 | Connect call-to-action + privacy note |
| Outlook connecting | Authorize URL requested / browser open | Connect button spinner, disabled |
| Outlook reconnect needed | `needs_reconnect: true` | Warning pill „Reconnect nötig“ + „Neu verbinden“; sync controls hidden |
| Deleting account | `DELETE /employees/me` in flight | Confirm disabled; then local wipe + logout |
| Saving        | Save in-flight                       | Disabled form + `saving` flag                                                        |
| Uploading     | Profile picture upload in-flight     | Upload field shows its own progress state (`MediaUploadFieldComponent`)              |
| Unsaved guard | Navigation attempted with dirty form | `UnsavedChangesDialogComponent` (save / discard / cancel)                            |
| Error         | Save failure                         | Snackbar with `error-snackbar` panel class                                           |

## Non-Goals

- **Another user's profile** — this is self-only. Admin view of other employees happens via other routes.
- **Institution assignment changes** — admin-only, not self-service.
- **Custom fields (tenant-defined)** — the profile card surfaces role/status/member-since as fixed display rows only; editable tenant-defined custom fields are out of scope for this page.
- **Editing planned working hours** — they belong to the employer (contract / Dienstplanung) and are read-only here; working time and absences live on „Meine Arbeitszeit“ ([my-working-time](../my-working-time/spec.md), #2904).
- **Other calendar providers** (Google, CalDAV) — only Microsoft Outlook exists.

## Edge Cases

- **Concurrent edits across tabs** — last-write-wins (no optimistic locking on the form).
- **Language change** — Flutter switches locale at runtime (no reload); Angular reloads the page after save (see *UI language*). Unsaved edits in other tabs must be guarded before a Flutter locale rebuild discards them — or the rebuild must preserve form state.
- **OAuth abandoned** — user closes the Microsoft page / auth session: no callback happens, config stays 404 (or unchanged); the connect button becomes enabled again on return.
- **OAuth state expired** — returning after > 15 min → `error=invalid_state`; user retries connect.
- **Delete account while Outlook is connected** — the backend deletion does not disconnect Outlook (see open questions in parity.md); the client does not call disconnect itself.
- **Profile picture file validation** — rejects types other than JPEG/PNG/WebP/GIF and files > 10 MB before opening the cropper (shared `avatarImage` preset); the server re-checks and answers 400/413.
- **Password policy fallback** — if `GET /auth/password-policy` fails, a default policy (minLength 8, 1 upper / 1 lower / 1 digit) is used.
- **Source lock is UI-only** — `PATCH /employees/me` does not enforce the Vivendi lock server-side; a client that sends `first_name`/`last_name` for a `vivendi-sync` employee changes them.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated employee (no additional permission). `/employees/me*` (incl. `/employees/me/availability-windows`) is class-level `@Auth({ scope: 'authenticated' })`; `GET /auth/password-policy` is public.
- **Outlook:** `/outlook-auth/*` and `/outlook-sync/*` are `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })`; most handlers additionally require the tenant feature `outlookCalendarSync` (403 otherwise). `GET /outlook-auth/callback` is `@Public()` (called by Microsoft, protected by the signed `state`).
- **`canDeactivate: [UnsavedChangesGuard]`** applied at route level.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Sub-components:** `ProfileCardComponent`, `ProfileBottomSheetComponent`, `ErreichbarkeitSectionComponent` (`pages/employee-profile/components/erreichbarkeit/`), `OutlookSyncSettingsComponent` (`pages/settings/outlook-sync-settings/`), `AvailabilityPlanCardComponent` (disabled booking tab)
- **Dialogs:** `UnsavedChangesDialogComponent` (unsaved-changes guard), `SimpleConfirmationDialogComponent` (delete account), `MediaUploadFieldComponent` with round cropper (profile picture), `AvailabilityDialogComponent` (edit window, currently unreachable because the availability tab is disabled)
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **Related:** [client-profile](../client-profile/spec.md) (parallel pattern for clients)
- **Backend:** `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`, `apps/tagea-backend/src/auth/auth.controller.ts`, `apps/tagea-backend/src/personal-availability/personal-availability.controller.ts`, `apps/tagea-backend/src/outlook-sync/outlook-auth.controller.ts`, `apps/tagea-backend/src/outlook-sync/outlook-sync.controller.ts`, error envelope `apps/tagea-backend/src/common/global-exception.filter.ts` — see [contracts.md](./contracts.md)
