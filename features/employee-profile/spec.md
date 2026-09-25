# Feature: Employee Profile (Own)

> **Status:** 🟢 Implemented in Angular; Flutter port planned (M2)
> **Owner:** ltoenjes
> **Last updated:** 2026-09-25 (M2-Specs: endpoint contracts verified against the backend — `/employees/me*`, `POST /auth/me/change-password`, `GET /auth/password-policy`; delete-own-account and password-change behaviour added)

## Vision (Elevator Pitch)

Self-service profile page at `/employee-profile` for staff to manage their own personal data, notification settings, personal preferences (calendar view / interface language / timezone), profile picture, and password. Tabbed layout on desktop / stacked on mobile. Unsaved-changes guard protects against data loss.

## User Stories

- As a **staff member** I want to update my personal data, so that my profile stays accurate.
- As a **staff member** I want to manage my notification settings, so that I only get the notifications I care about.
- As a **staff member** I want to upload a profile picture, so that colleagues can recognize me.
- As a **staff member** I want to change my password, so that I can maintain account security.
- As a **staff member** I want to change my interface language / calendar default view, so that the app fits my workflow.
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
- [ ] Save → `PATCH /employees/me/preferences` (partial merge); success „Persönliche Einstellungen wurden gespeichert“. When `interface_language` changed, the page applies the language and reloads instead of showing the snackbar.

### Change password

- [ ] Form: current password, new password, confirmation (must match), optional 2FA code (6–8 digits). The new password is validated live against the policy from `GET /auth/password-policy` (min length, upper/lower case, digits, special characters) with a strength indicator („Schwach“ / „Mittel“ / „Stark“) and the requirement list („Passwort-Anforderungen:“).
- [ ] If loading the policy fails, the fallback is min length 8, 1 upper case, 1 lower case, 1 digit, 0 special characters.
- [ ] Submit → `POST /auth/me/change-password` `{ currentPassword, newPassword, totp? }`. The server validates against the **effective** policy (realm + tenant override), which may be stricter than the policy shown.
- [ ] Response `OTP_REQUIRED` → the 2FA field becomes required and „Bitte gib zusätzlich deinen aktuellen 2FA-Code ein.“ is shown; the user resubmits with the code.
- [ ] Wrong current password → „Das aktuelle Passwort ist falsch“; with 2FA (`INVALID_CREDENTIALS_OR_OTP`) → „Das aktuelle Passwort oder der 2FA-Code ist falsch“; any other error (incl. a policy violation) → „Fehler beim Ändern des Passworts“.
- [ ] Success → „Passwort wurde erfolgreich geändert“, form reset. The backend invalidates **all** sessions of the user, so the next token refresh fails and the user has to log in again.

### Delete own account

- [ ] The danger zone „Konto löschen“ („Wenn du dein Konto löschst, kannst du dich nicht mehr anmelden.“) opens a confirmation („Konto löschen?“ / „Bist du sicher, dass du dein Konto löschen möchtest? Du wirst abgemeldet und kannst dich nicht mehr anmelden.“ / „Ja, Konto löschen“ / „Abbrechen“).
- [ ] Confirm → `DELETE /employees/me` (204) → local logout → navigate to `/`. Failure → „Fehler beim Löschen des Kontos. Bitte versuche es erneut.“
- [ ] Server effect: the employee is soft-deleted in this Träger and loses the tenant mapping; if the person belongs to no other Träger the Keycloak account is deleted (the e-mail can register again), otherwise the Keycloak account stays for the other Träger. No additional permission is needed and the Träger-Admin protection does not block deleting oneself.

### Source-based field locking

- [ ] **Given** the loaded employee has `source === 'vivendi-sync'`, **Then** stammdaten fields on the personal-data tab (`first_name`, `last_name`, `email`, `phone_mobile`, `phone_landline`, `date_of_birth`, `gender`) render as **disabled** with the Vivendi-managed hint (i18n key `employeeDialog.vivendiManagedHint`) — same convention as `EmployeeDialogComponent`.
- [ ] **Given** the employee has `source === 'manual'` (or undefined), **Then** all stammdaten fields remain editable; `email` stays read-only because the address is owned by Keycloak, not the source-lock.
- [ ] **Given** the locks apply, **Then** the visibility toggles (`email_visible`, `phone_mobile_visible`, `phone_landline_visible`), profile picture upload, notification settings, personal preferences, and password change remain editable — they are personal preferences, not stammdaten.

## UI States

| State         | When?                                | Rendering                                                                            |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Loading       | Initial fetch                        | Spinner                                                                              |
| Loaded        | Profile resolved                     | Tabbed layout with profile + notifications + preferences + password + delete account |
| Changing password | Password change in-flight        | Submit disabled (`changingPassword`)                                                 |
| OTP required  | Server answered `OTP_REQUIRED`       | 2FA code field required + hint snackbar                                              |
| Saving        | Save in-flight                       | Disabled form + `saving` flag                                                        |
| Uploading     | Profile picture upload in-flight     | Upload field shows its own progress state (`MediaUploadFieldComponent`)              |
| Unsaved guard | Navigation attempted with dirty form | `UnsavedChangesDialogComponent` (save / discard / cancel)                            |
| Error         | Save failure                         | Snackbar with `error-snackbar` panel class                                           |

## Non-Goals

- **Another user's profile** — this is self-only. Admin view of other employees happens via other routes.
- **Institution assignment changes** — admin-only, not self-service.
- **Custom fields (tenant-defined)** — the profile card surfaces role/status/member-since as fixed display rows only; editable tenant-defined custom fields are out of scope for this page.
- **Editable availability windows on this page** — availability read/write UI is currently disabled in the component (see `// Availability tab temporarily disabled` in source). Working hours management lives in the separate `WorkingHoursTabComponent`.

## Edge Cases

- **Concurrent edits across tabs** — last-write-wins (no optimistic locking on the form).
- **Language change** — changing `interface_language` in preferences triggers `window.location.reload()` after save.
- **Profile picture file validation** — rejects types other than JPEG/PNG/WebP/GIF and files > 10 MB before opening the cropper (shared `avatarImage` preset); the server re-checks and answers 400/413.
- **Password policy fallback** — if `GET /auth/password-policy` fails, a default policy (minLength 8, 1 upper / 1 lower / 1 digit) is used.
- **Source lock is UI-only** — `PATCH /employees/me` does not enforce the Vivendi lock server-side; a client that sends `first_name`/`last_name` for a `vivendi-sync` employee changes them.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated employee (no additional permission). `/employees/me*` is class-level `@Auth({ scope: 'authenticated' })`; `GET /auth/password-policy` is public.
- **`canDeactivate: [UnsavedChangesGuard]`** applied at route level.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Sub-components:** `ProfileCardComponent`, `ProfileBottomSheetComponent`, `WorkingHoursTabComponent`, `AvailabilityCardComponent`, `OutlookSyncSettingsComponent`
- **Dialogs:** `UnsavedChangesDialogComponent` (unsaved-changes guard), `SimpleConfirmationDialogComponent` (delete account), `MediaUploadFieldComponent` with round cropper (profile picture), `AvailabilityDialogComponent` (edit window, currently unreachable because the availability tab is disabled)
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **Related:** [client-profile](../client-profile/spec.md) (parallel pattern for clients)
- **Backend:** `apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`, `apps/tagea-backend/src/auth/auth.controller.ts` — see [contracts.md](./contracts.md)
