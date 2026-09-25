# Feature: Employee Profile (Own)

> **Status:** 🟢 Implemented in Angular; Flutter port 🚧 in progress (part 1: tremaze/tagea-next-flutter#95; part 2 = WP13b)
> **Owner:** ltoenjes
> **Last updated:** 2026-09-25 (WP13b „Mein Profil – Teil 2“: Datenauskunft tab (`dataSelfDisclosure`) specified; Outlook native return via app links on the `FRONTEND_URL` host (owner decision); account-deletion flow re-verified; backend gaps linked to Asana 1218853627782544. Earlier the same day, M2-Specs QA: owner decision „full scope in M2“ — Erreichbarkeit, Outlook calendar connection, runtime UI-language switch and account-deletion cleanup specified; password-change error shape corrected to the flat `GlobalExceptionFilter` envelope, Angular 2FA divergence documented)

## Vision (Elevator Pitch)

Self-service profile page at `/employee-profile` for staff to manage their own personal data (Stammdaten), profile picture, password, notification settings including their own availability („Erreichbarkeit“), personal preferences (calendar view / interface language / timezone), the Outlook calendar connection, to see and download the personal data Tagea stores about them (DSGVO „Datenauskunft“, Art. 15 / 20), and to delete their own account. Tabbed layout on desktop / stacked on mobile. Unsaved-changes guard protects against data loss.

**M2 scope (owner decision 2026-09-25):** Stammdaten, Bild, Passwort, Benachrichtigungen (incl. Erreichbarkeit), UI-Sprache, Konto löschen, Verfügbarkeiten and Outlook are **all in scope** for the Flutter port. **WP13b (owner decision 2026-09-25):** the full profile scope ships in the Flutter app — this adds the „Datenauskunft“ tab.

## User Stories

- As a **staff member** I want to update my personal data, so that my profile stays accurate.
- As a **staff member** I want to manage my notification settings, so that I only get the notifications I care about.
- As a **staff member** I want to upload a profile picture, so that colleagues can recognize me.
- As a **staff member** I want to change my password, so that I can maintain account security.
- As a **staff member** I want to change my interface language / calendar default view, so that the app fits my workflow.
- As a **staff member** I want to maintain the times when Tagea may notify me („Meine Erreichbarkeit“), so that „Nicht stören“ matches my real availability.
- As a **staff member** I want to connect my Outlook calendar, so that my Tagea appointments and Outlook events show up in both places.
- As a **staff member** I want to see which personal data Tagea stores about me and download it as PDF / machine-readable archive, so that I can exercise my DSGVO rights (Art. 15 / 20) without a formal request.
- As a **staff member** I want to delete my account, so that I can leave the tenant on my own.
- As a **staff member** I want the app to warn me before I lose unsaved changes, so that I don't accidentally discard edits.

## Acceptance Criteria

### Load & layout

- [ ] **Given** the page loads, **When** `GET /employees/me` resolves, **Then** `ProfileCardComponent` renders with basic info; a failure shows „Fehler beim Laden des Profils“.
- [ ] **Given** the user is on desktop, **When** the layout is wide enough, **Then** the page renders a tabbed layout; on mobile (`max-width: 768px`) the profile card opens via `ProfileBottomSheetComponent`.
- [ ] **Given** the user has unsaved changes in any form, **When** they attempt to navigate away, **Then** `UnsavedChangesGuard` (`canDeactivate`) opens `UnsavedChangesDialogComponent` with save/discard/cancel actions.

### Personal data

- [ ] Form: `first_name`, `last_name` (required), `email` (read-only), `phone_mobile`, `phone_landline`, visibility toggles `email_visible`, `phone_mobile_visible`, `phone_landline_visible`. **Flutter leaves out `date_of_birth` and `gender`** (owner decision 2026-09-25, see below); Angular shows both.
- [ ] Save → `PATCH /employees/me`; success „Deine Daten wurden erfolgreich gespeichert“, failure „Die Änderungen konnten nicht gespeichert werden. Bitte versuche es später erneut.“
- [ ] The backend persists only `first_name`, `last_name`, `phone_mobile`, `phone_landline` and the three visibility toggles; other keys are dropped silently. Angular shows `date_of_birth` and `gender` as editable and sends them, but they are not saved.
- [ ] **Decision (owner, 2026-09-25):** Flutter does **not** show `date_of_birth` or `gender` in the form, not even read-only, and never sends them, until the backend accepts them on `PATCH /employees/me`. Backend gap tracked in Asana [1218853627782544](https://app.asana.com/0/0/1218853627782544); when it is closed, the fields come back via a spec update.

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
- [ ] Error codes the client can meet: 401 (token already invalid → normal session-expired handling, no wipe of another user's data), 404 `Employee not found` / `User information is required` (treat like any failure: error message, stay on the page). There is no request body and no `code` in the error envelope.
- [ ] **Lost response:** if the request times out or the connection drops after sending, the account may already be gone. The client shows the failure message; a retry then answers 404 and the next token refresh fails, which leads to the regular session-expired flow. The client must not assume success without a 204.

> **Gap (backend, Asana [1218853627782544](https://app.asana.com/0/0/1218853627782544)):** `DELETE /employees/me` does **not** clean up the Outlook connection. `EmployeesService.removeFromTenant` leaves the encrypted Microsoft tokens, the Graph change subscription and the events exported from Tagea in the user's real Outlook calendar in place. The client does **not** work around this (it does not call `POST /outlook-auth/disconnect` before deleting — a failed disconnect would otherwise block or complicate the deletion); the fix belongs in the backend deletion path (run the same cleanup as disconnect). Until then the confirmation text stays as it is (no promise about Outlook).

### Erreichbarkeit (own availability windows) — „Verfügbarkeiten“

Lives in the notifications tab directly under the „Nicht stören außerhalb der Arbeitszeit“ toggle, because its only purpose is to feed that toggle (`ErreichbarkeitSectionComponent`, #3721). It is **not** gated by any tenant feature (no `timeTracking` / `pep` / contract required).

- [ ] **Given** the tab opens, **When** `GET /employees/me/availability-windows/erreichbarkeit` resolves, **Then** the windows are split by `herkunft`: `geplant` windows (planned working hours set by the employer) render as a **read-only** Mo–So grid „Geplante Arbeitszeit“ („Von Deiner Einrichtung geplant. Hier kannst Du sie nicht ändern.“) with the hint „Während Deiner geplanten Arbeitszeit bist Du immer erreichbar. Eigene Zeiten kommen hinzu – sie nehmen nichts weg.“ — shown only when at least one `geplant` window exists; `eigen` windows render as the editable grid „Meine Erreichbarkeit“ („Zusätzliche Zeiten, in denen Tagea Dich benachrichtigen darf.“). Empty days read „Frei“. Load failure → „Deine Erreichbarkeit konnte nicht geladen werden.“
- [ ] „Zeit hinzufügen“ lets the user pick one **or several** weekdays plus `start_time`/`end_time` (`HH:MM`); the client sends one `POST /employees/me/availability-windows` `{ weekday, start_time, end_time }` per weekday. „Zeit bearbeiten“ → `PATCH /employees/me/availability-windows/:id` `{ start_time, end_time }`. Delete asks „Zeit löschen“ / „Soll dieses Zeitfenster wirklich gelöscht werden?“ → `DELETE /employees/me/availability-windows/:id` (204).
- [ ] After **every** mutation — success or failure — the list is reloaded from `GET …/erreichbarkeit` (a multi-weekday create may have partially succeeded) and the client-side notification-suppression cache is invalidated so the new windows take effect without an app restart. Failures: create/update → „Das Zeitfenster konnte nicht gespeichert werden.“, delete → „Das Zeitfenster konnte nicht gelöscht werden.“
- [ ] Server rules the UI must expect: `start_time < end_time` on the same day (400 „Startzeit muss vor der Endzeit liegen“); no overlap with another own window on the same weekday (400 „Das Zeitfenster überschneidet sich mit einem bereits hinterlegten“); a foreign or unknown id → 404. `geplant` windows are never editable through this API.
- [ ] Erreichbarkeit windows are independent of the notifications form: they save immediately and do **not** mark the notifications form dirty.

> **Scope note — booking availability plans („Verfügbarkeit & Buchung“):** the profile also contains a booking-plan tab (`availabilityBooking`, `AvailabilityDialogComponent`, institution-scoped `/institutions/:institutionId/employee-availability`), but it is hard-disabled in Angular (`@if (false)`); booking plans are managed from the institution calendar (`ManageAvailabilityDialogComponent` in `calendar-page`), gated by the `clientPortal` feature and `appointments.*` permissions, and are not self-service endpoints. `GET /employees/me/availability/check` (see [employee-availability](../employee-availability/spec.md)) is a scheduling conflict check, not a profile surface. **Decision (owner, 2026-09-25):** „Verfügbarkeiten“ in the profile scope means the **Erreichbarkeit windows** (`/employees/me/availability-windows`), **not** the booking availability plans. The Flutter profile has no booking-plan tab.

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

- [ ] **Web (Flutter web):** open the authorize URL in the same tab. The route `/settings/outlook-sync` must exist and forward to `/employee-profile` with the *Kalender-Verbindungen* tab selected, reading `success` / `error` / `message` once: success → reload config and confirm the connection; error → reload config and show the mapped error (see *Result messages*), then strip the query parameters.
- [ ] **Result messages** (new strings, no Angular equivalent — Angular never handles the return): `success=true` → „Outlook-Kalender verbunden. Aktiviere „Sync aktiv“, um die Synchronisation zu starten.“; `error=invalid_state` → „Die Anmeldung bei Microsoft ist abgelaufen. Bitte verbinde dich erneut.“; `error=cleanup_in_progress` → „Die vorherige Verbindung wird noch getrennt. Bitte versuche es in ein paar Minuten erneut.“; `error=access_denied` (Microsoft: consent cancelled / not granted) → „Die Verbindung wurde bei Microsoft abgebrochen.“; any other `error` → „Verbindung mit Microsoft fehlgeschlagen“. The English `message` is logged (debug only), not shown. The result is consumed once: the query parameters are removed from the URL / router state, so reload, back navigation or a replayed app link does not show it again.
- [ ] **iOS / Android — app links on the `FRONTEND_URL` host (owner decision 2026-09-25):** open the authorize URL in the **system browser session** (`ASWebAuthenticationSession` on iOS, Custom Tabs on Android — never an embedded WebView, Microsoft blocks those for many tenants). The backend's 302 to `https://<FRONTEND_URL host>/settings/outlook-sync?…` is claimed by the app as a verified **universal link (iOS) / Android App Link** and routed into the app exactly like the web route above (calendar-connections tab, one-shot `success` / `error` / `message` handling, config reload). No backend change and no custom scheme are needed.
  - The link claim is **scoped to the path `/settings/outlook-sync`** only (AASA `components` / `paths`, Android intent filter `pathPrefix`) — every other URL on the web frontend host keeps opening in the browser.
  - Requirements outside the app: the `FRONTEND_URL` host serves `/.well-known/apple-app-site-association` (app ID with the `/settings/outlook-sync` path) and `/.well-known/assetlinks.json` (package name + release/Play signing certificate fingerprints), both as `application/json` without redirect. The app declares the host in its Associated Domains entitlement (`applinks:<host>`) and in an `android:autoVerify="true"` intent filter. Hosts are compiled into the build, so only deployments whose `FRONTEND_URL` host is known at build time get the direct return.
  - iOS: use the `https` callback of `ASWebAuthenticationSession` (host = `FRONTEND_URL` host, path `/settings/outlook-sync`, iOS 17.4+) so the session closes itself on the redirect; on older iOS the session ends on the web page and the fallback below applies.
  - **Fallback (always active):** when the auth session / Custom Tab closes without the app link firing (user cancels, app link not verified, unknown host, older iOS), re-fetch `GET /outlook-sync/config` on return to foreground and show the resulting state — the token exchange already happened server-side. A lost app link therefore never loses a connection; only the success/error message is missing.
- [ ] Whatever the platform, a successful connect leaves background sync **off** (`sync_enabled: false`) until the user turns on „Sync aktiv“.

> **Backend constraint:** the callback supports **only a web return URL** — a single global `FRONTEND_URL` + hard-coded path `/settings/outlook-sync`; there is no per-request `return_to`/`redirect_uri`, no tenant-specific frontend host and no custom-scheme support. This is why the native return relies on app links for that host (owner decision) plus the foreground re-fetch fallback; no backend change is planned for the Flutter port.
>
> **Gap (Angular, Asana [1218853627782544](https://app.asana.com/0/0/1218853627782544)):** Angular has **no route `/settings/outlook-sync`**. After the Microsoft consent the web user lands on the `**` catch-all (landing redirect), the `success` / `error` / `message` query parameters are ignored, the user is not taken back to the *Kalender-Verbindungen* tab and a failed connect is invisible (divergence, see parity.md). The Flutter web app implements the route as specified above; the Angular fix (add the route, forward to `/employee-profile` with the tab selected, show the result) is tracked in the same ticket.

### Datenauskunft (DSGVO self-disclosure) — „Meine Daten“

Tab „Datenauskunft“ (`employeeProfile.tabs.dataExport`), rendered only when the tenant feature `dataSelfDisclosure` is enabled (`SessionAuthz.isFeatureEnabled('dataSelfDisclosure')`); content is the shared `DataExportPageComponent` (`pages/data-export/`), which the client profile reuses for clients. Employees only on this page; the subject is **always** resolved server-side from the session — there is no id in the URL, so nobody can request another person's data. Nothing is *requested* in the sense of a ticket or approval: the export is generated live on every call.

**What the employee sees** (`GET /employees/me/data-export` → `DataExportDocument`, audience `employee-self`):

- [ ] **Given** the tab is opened for the first time, **When** the document loads, **Then** a loading state „Deine Daten werden geladen …“ is shown. Leaving and re-entering the tab shows the already loaded document (no new request — see *Rate limit*). *(Angular reloads on every tab visit because `matTabContent` recreates the component.)*
- [ ] **Header:** title „Meine Daten“, subtitle „Auskunft über die zu deiner Person gespeicherten Daten (Art. 15 DSGVO)“.
- [ ] **Meta row:** the subject name (first `firstName` / `lastName` found in the records, in practice the profile category), the persona „Mitarbeiter:in“, and „Erstellt am {{date}}“ from `generatedAt` (localized date + time).
- [ ] **Info banner:** „Diese Übersicht enthält die zu deiner Person gespeicherten Daten. Über **„Als ZIP-Archiv“** lädst du sie zusätzlich maschinenlesbar (JSON) samt deiner hochgeladenen Dokumente herunter (Art. 20 DSGVO).“ (see open question on the document wording for employees).
- [ ] **One card per category**, in server order, heading = translation of `labelKey`, a count badge when a category has more than one record. Employee categories (all collectors for `employee-self`):

  | `category` | Heading (`dataExport.category.*`) | Render mode | Content |
  |---|---|---|---|
  | `employee-profile` | „Profil“ | detail (key/value grid) | master data, visibility flags, notification settings, `preferences` JSON, `createdAt` |
  | `employee-assignments` | „Zuordnungen & Rollen“ | list | institution / teamspace / department / activity assignments (`type`, id, `role`, `source`, `assignedAt`) |
  | `employee-availability` | „Verfügbarkeiten“ | list | booking availability plans incl. `blocks` |
  | `employee-working-hours` | „Arbeitszeiten & Abwesenheiten“ | list | working-hours templates and absences |
  | `employee-workforce` | „Personaleinsatz“ | list | employment contracts, shift assignments, time-account entries |
  | `employee-time-tracking` | „Zeiterfassung“ | list | tracked times incl. `entries` |
  | `employee-custom-fields` | „Individuelle Felder“ | list | values of tenant-defined employee fields |
  | `employee-devices` | „Geräte“ | list | registered push devices (`provider`, `deviceName`, `lastUsedAt`) |
  | `employee-login-history` | „Anmeldeverlauf“ | list | the most recent 1000 logins (`loginType`, `status`, `userAgent`, `authTime`) |

  Not part of the employee export today (no collector): own Erreichbarkeit windows (`personal_availability_windows`), the Outlook connection (account, sync settings, cached Outlook events) and notifications — see *Open Questions* (4).

  Unknown future categories render as a list with the default field candidates (`title`/`name`/`type`/`id`; `status`/`description`; `createdAt`/`date`) and a humanised heading if no translation exists — the client must not break on a new category.
- [ ] **Detail cards** show every non-null field; labels come from `dataExport.field.<key>` or the German fallback map (`DETAIL_FIELD_LABELS_DE`, e.g. `firstName` „Vorname“, `phoneMobile` „Telefon (mobil)“, `emailVisible` „E-Mail sichtbar“), else the humanised key. Booleans → „Ja“ / „Nein“; ISO dates → localized date (+ time when the value has one); nested objects/arrays → compact JSON text.
- [ ] **List cards** show per record a primary line, an optional secondary line and a date on the trailing side, chosen from the per-category candidate fields (first non-empty wins, see [contracts.md](./contracts.md#datenauskunft-employeesmedata-export)); a record without any candidate falls back to `type` or „—“.
- [ ] An empty category shows „Keine Daten in dieser Kategorie.“. Category-level `notices` are shown under the card as text (translation of `messageKey`).
- [ ] **Partial failure:** a collector that throws does not fail the export; the server omits that category and adds a **document-level** notice `{ category, messageKey: 'dataExport.notice.categoryUnavailable' }`. The client shows it as a card for that category with „Diese Kategorie konnte nicht geladen werden.“ *(Angular renders only category-level notices and silently drops this one — divergence, see parity.md.)*
- [ ] The client-only card „Nicht in dieser Auskunft enthalten“ is **not** shown to employees.
- [ ] Footer: „Tagea · Datenauskunft nach Art. 15 DSGVO“.

**What the employee can download:**

- [ ] „Als PDF“ → `GET /employees/me/data-export/pdf` (`application/pdf`, Art. 15, printable). „Als ZIP-Archiv“ → `GET /employees/me/data-export/archive` (`application/zip`, Art. 20) containing `daten.json` (the same `DataExportDocument`, pretty-printed) plus files from audience-matching file providers — **for employees there are none today, so the ZIP holds only `daten.json`**.
- [ ] While a download runs, its button is disabled (per button, independent of each other). The file name is taken from the response `Content-Disposition` (`datenauskunft-employee-self-<YYYY-MM-DD>.pdf|zip`); fallback `datenauskunft.pdf` / `datenauskunft.zip`.
- [ ] **Web:** the browser downloads the blob. **iOS / Android:** the file is written to the app's cache/temporary directory and handed to the system share sheet (save to Files / Drive, print, mail); dismissing the share sheet is not an error. Files are removed from the cache on logout / account deletion (part of the local wipe).
- [ ] **Print:** Angular's „Drucken“ calls `window.print()` on the rendered page. **Flutter** does not print the widget tree; printing goes through the PDF (native: share sheet → print; web: the downloaded PDF). Flutter therefore shows only „Als PDF“ and „Als ZIP-Archiv“ *(pending product confirmation, see *Open Questions* (1))*.
- [ ] Download failure (any non-2xx, network, write error) → „Datei konnte nicht heruntergeladen werden.“; the page stays as it is. *(Angular shows this only on native; on web a failed download is silent — divergence.)*

**States & errors:**

- [ ] Load failure (any non-2xx or network) → error state with icon, „Deine Daten konnten nicht geladen werden.“ and the action „Erneut versuchen“ (re-runs the load). Pull-to-refresh on the loaded document also re-runs it.
- [ ] **Rate limit:** JSON, PDF and ZIP share **one** budget of 20 calls per user per hour (and 40 per IP per hour). Exceeding it → 429 `{ message: 'Rate limit exceeded. Max 20 requests per 3600s.', retryAfter: <seconds> }`. Flutter shows „Du hast deine Daten in kurzer Zeit zu oft abgerufen. Bitte versuche es in {{minutes}} Minuten erneut.“ (new string; `minutes` = `retryAfter` rounded up) — on load in the error state, on download as a message. Because the view itself costs a call, the client must not reload the document automatically (no reload on tab re-entry, resume or locale change); only explicit retry / pull-to-refresh reload it. 503 `Rate-limit service temporarily unavailable` is treated like any load failure.
- [ ] 403 (`This feature (dataSelfDisclosure) is not enabled for your tenant`, e.g. the feature was switched off while the page was open) → treat as load failure; on the next feature refresh the tab disappears. 403 for a non-employee principal cannot happen on this page.
- [ ] Every call (JSON, PDF, ZIP) is audited server-side (`data_export_downloaded`, with format and category count) — no client action needed, but the client must not prefetch the PDF/ZIP.
- [ ] Usage tracking (optional, as Angular): `settings.dataexport.print` / `.pdf` / `.archive` after a **successful** download only.

### UI language

- [ ] The preferences tab offers all 16 UI languages (`AVAILABLE_LANGUAGES`, native names): `de` Deutsch, `en` English, `fr` Français, `tr` Türkçe, `ro` Română, `ar` العربية (RTL), `ru` Русский, `uk` Українська, `it` Italiano, `pl` Polski, `hr` Hrvatski, `fa` فارسی (RTL), `ku` Kurdî, `bg` Български, `sr` Српски, `sq` Shqip — one translation file each under `assets/i18n/<code>.json`. Default and fallback: `de`.
- [ ] The language is persisted server-side as `interface_language` in the employee preferences via `PATCH /employees/me/preferences` (together with `calendar_default_view` and `timezone` on „Einstellungen speichern“) and restored after login from `GET /employees/me/preferences`; a local copy is kept so the app starts in the last language before the session is ready.
- [ ] **Flutter:** after a successful save the app switches locale **at runtime without a restart/reload**: the whole widget tree rebuilds with the new translations, text direction flips to RTL for `ar` / `fa`, date/number formats follow the locale, and server data that is delivered already translated (e.g. articles/news, events) is re-fetched / its caches invalidated. The preferences success message is shown in the new language.
- [ ] If the save fails, the language is **not** switched (Flutter) and „Fehler beim Speichern der Einstellungen“ is shown (same message as any preferences save failure).

> **Angular divergence (by design of the web app):** Angular applies the language and then calls `window.location.reload()` (component and `LanguageService.setLanguageAndPersist`) instead of showing the snackbar, to refresh server-translated content. Flutter must not reload.

### Source-based field locking

- [ ] **Given** the loaded employee has `source === 'vivendi-sync'`, **Then** stammdaten fields on the personal-data tab (`first_name`, `last_name`, `email`, `phone_mobile`, `phone_landline`, `date_of_birth`, `gender` — the last two only where shown, i.e. Angular) render as **disabled** with the Vivendi-managed hint (i18n key `employeeDialog.vivendiManagedHint`) — same convention as `EmployeeDialogComponent`.
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
| Datenauskunft loading | First visit of the tab, `GET /employees/me/data-export` in flight | „Deine Daten werden geladen …“ |
| Datenauskunft error | Load failed (network / 4xx / 5xx) | Error state „Deine Daten konnten nicht geladen werden.“ + „Erneut versuchen“; 429 shows the rate-limit text instead |
| Datenauskunft loaded | Document resolved | Header, meta row, banner, category cards, download buttons, footer |
| Datenauskunft downloading | PDF or ZIP request in flight | The pressed download button disabled; the other stays usable |
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
- **Formal DSGVO requests / DPO full disclosure** — the `dpo-full` audience is reserved server-side and has no endpoint; the tab only offers the self-service export. Data correction and erasure requests are not part of the tab (erasure = „Konto löschen“).

## Edge Cases

- **Concurrent edits across tabs** — last-write-wins (no optimistic locking on the form).
- **Language change** — Flutter switches locale at runtime (no reload); Angular reloads the page after save (see *UI language*). Unsaved edits in other tabs must be guarded before a Flutter locale rebuild discards them — or the rebuild must preserve form state.
- **OAuth abandoned** — user closes the Microsoft page / auth session: no callback happens, config stays 404 (or unchanged); the connect button becomes enabled again on return.
- **OAuth state expired** — returning after > 15 min → `error=invalid_state`; user retries connect.
- **Delete account while Outlook is connected** — the backend deletion does not disconnect Outlook (backend gap, Asana 1218853627782544); the client does not call disconnect itself.
- **Outlook app link arrives while logged out / other tenant** — the app stores the one-shot result, completes login / tenant selection, then opens the calendar-connections tab and reloads the config; the query parameters are never replayed after that.
- **Datenauskunft after many visits** — the view, PDF and ZIP share one hourly budget of 20; a user who opens the tab and downloads both formats repeatedly can hit 429. The message names the wait time from `retryAfter`.
- **Datenauskunft for a large account** — the ZIP / PDF are built in memory on the server and may take several seconds; the button stays disabled until the response arrives (no client timeout shorter than the app's standard download timeout).
- **Profile picture file validation** — rejects types other than JPEG/PNG/WebP/GIF and files > 10 MB before opening the cropper (shared `avatarImage` preset); the server re-checks and answers 400/413.
- **Password policy fallback** — if `GET /auth/password-policy` fails, a default policy (minLength 8, 1 upper / 1 lower / 1 digit) is used.
- **Source lock is UI-only** — `PATCH /employees/me` does not enforce the Vivendi lock server-side; a client that sends `first_name`/`last_name` for a `vivendi-sync` employee changes them.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated employee (no additional permission). `/employees/me*` (incl. `/employees/me/availability-windows`) is class-level `@Auth({ scope: 'authenticated' })`; `GET /auth/password-policy` is public.
- **Datenauskunft:** `/employees/me/data-export*` is `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` + `@RequireFeature('dataSelfDisclosure')` (403 when off) + `RateLimitGuard` (shared budget 20/h per user, 40/h per IP; 429). No permission beyond being an employee of the tenant; subject = the session's employee. Clients use the parallel `/client-portal/me/data-export*` (see [client-profile](../client-profile/spec.md)).
- **Outlook:** `/outlook-auth/*` and `/outlook-sync/*` are `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })`; most handlers additionally require the tenant feature `outlookCalendarSync` (403 otherwise). `GET /outlook-auth/callback` is `@Public()` (called by Microsoft, protected by the signed `state`).
- **`canDeactivate: [UnsavedChangesGuard]`** applied at route level.

## Open Questions

Product questions for WP13b (also filed in Asana, project „Tagea Flutter“, section „Entscheidungen offen“). Until decided, Flutter implements the stated default.

1. **„Drucken“ in Flutter?** Angular prints the rendered page (`window.print()`). Flutter cannot print its widget tree sensibly on web and has no browser print on iOS/Android. *Default:* no „Drucken“ button; printing goes through „Als PDF“ (share sheet → Drucken on native).
2. **Banner text for employees:** the shared banner promises the ZIP contains „deine hochgeladenen Dokumente“, but the employee archive only holds `daten.json` (file providers exist only for clients). *Default:* show the shared text unchanged (parity). Options: an employee-specific text without the document promise, or employee file providers (e.g. profile picture, Gehaltsnachweise).
3. **Raw ids in the overview:** list cards for „Zuordnungen & Rollen“, „Personaleinsatz“ and „Individuelle Felder“ show UUIDs (`institutionId`, `teamspaceId`, `fieldDefinitionId`) as their primary line, because the backend exports ids, not names. *Default:* show them as delivered. Should the backend resolve names (institution, teamspace, field label)?
4. **Coverage gaps:** own Erreichbarkeit windows, the Outlook connection (account, settings, cached Outlook events) and notifications are not part of the employee export. Should collectors be added (backend)?

**Decided (owner, 2026-09-25), no longer open:** „Verfügbarkeiten“ = Erreichbarkeit windows, not booking plans (see *Erreichbarkeit*); Flutter leaves out `date_of_birth` / `gender` until the backend accepts them (see *Personal data*).

Backend gaps with an existing ticket (Asana [1218853627782544](https://app.asana.com/0/0/1218853627782544)), not open questions: account deletion leaves the Outlook connection behind (see *Delete own account*); Angular has no `/settings/outlook-sync` route (see *OAuth return*); `PATCH /employees/me` drops `date_of_birth` / `gender`.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Sub-components:** `ProfileCardComponent`, `ProfileBottomSheetComponent`, `ErreichbarkeitSectionComponent` (`pages/employee-profile/components/erreichbarkeit/`), `OutlookSyncSettingsComponent` (`pages/settings/outlook-sync-settings/`), `DataExportPageComponent` + `DataExportService` (`pages/data-export/`, Datenauskunft tab), `AvailabilityPlanCardComponent` (disabled booking tab)
- **Dialogs:** `UnsavedChangesDialogComponent` (unsaved-changes guard), `SimpleConfirmationDialogComponent` (delete account), `MediaUploadFieldComponent` with round cropper (profile picture), `AvailabilityDialogComponent` (edit window, currently unreachable because the availability tab is disabled)
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **Related:** [client-profile](../client-profile/spec.md) (parallel pattern for clients)
- **Backend:** `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`, `apps/tagea-backend/src/auth/auth.controller.ts`, `apps/tagea-backend/src/personal-availability/personal-availability.controller.ts`, `apps/tagea-backend/src/outlook-sync/outlook-auth.controller.ts`, `apps/tagea-backend/src/outlook-sync/outlook-sync.controller.ts`, `apps/tagea-backend/src/data-export/controllers/employee-data-export.controller.ts` (+ `data-export.types.ts`, `data-export-orchestrator.service.ts`, `services/data-export-delivery.service.ts`, `services/data-export-archive.service.ts`, `collectors/employee/*`), error envelope `apps/tagea-backend/src/common/global-exception.filter.ts` — see [contracts.md](./contracts.md)
