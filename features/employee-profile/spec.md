# Feature: Employee Profile (Own)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

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

- [ ] **Given** the page loads, **When** `employeesService.getCurrentEmployee()` resolves, **Then** `ProfileCardComponent` renders with basic info.
- [ ] **Given** the user is on desktop, **When** the layout is wide enough, **Then** the page renders a tabbed layout; on mobile (`max-width: 768px`) the profile card opens via `ProfileBottomSheetComponent`.
- [ ] **Given** the user has unsaved changes in any form, **When** they attempt to navigate away, **Then** `UnsavedChangesGuard` (`canDeactivate`) opens `UnsavedChangesDialogComponent` with save/discard/cancel actions.
- [ ] **Given** the user selects a profile picture, **When** the file type and size validate, **Then** `ImageCropperDialogComponent` opens; on crop confirm the cropped blob is uploaded via `employeesService.uploadProfilePicture()` and a boolean `uploadingProfilePicture` flag disables the button until the `HttpEventType.Response` event arrives.
- [ ] **Given** the user fills the password form, **When** the Keycloak policy from `employeesService.getPasswordPolicy()` validates, **Then** `employeesService.changePassword()` is called.
- [ ] **Given** the user clicks delete account, **When** they confirm in `SimpleConfirmationDialogComponent`, **Then** `employeesService.deleteOwnAccount()` runs and the user is logged out.

### Source-based field locking

- [ ] **Given** the loaded employee has `source === 'vivendi-sync'`, **Then** stammdaten fields on the personal-data tab (`first_name`, `last_name`, `email`, `phone_mobile`, `phone_landline`, `date_of_birth`, `gender`) render as **disabled** with the Vivendi-managed hint (i18n key `employeeDialog.vivendiManagedHint`) — same convention as `EmployeeDialogComponent`.
- [ ] **Given** the employee has `source === 'manual'` (or undefined), **Then** all stammdaten fields remain editable; `email` stays read-only because the address is owned by Keycloak, not the source-lock.
- [ ] **Given** the locks apply, **Then** the visibility toggles (`email_visible`, `phone_mobile_visible`, `phone_landline_visible`), profile picture upload, notification settings, personal preferences, and password change remain editable — they are personal preferences, not stammdaten.

## UI States

| State         | When?                                | Rendering                                                                            |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Loading       | Initial fetch                        | Spinner                                                                              |
| Loaded        | Profile resolved                     | Tabbed layout with profile + notifications + preferences + password + delete account |
| Saving        | Save in-flight                       | Disabled form + `saving` flag                                                        |
| Uploading     | Profile picture upload in-flight     | Disabled upload control (`uploadingProfilePicture`)                                  |
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
- **Profile picture file validation** — rejects non-`image/jpeg|png|webp` and files > 10 MB with a snackbar before opening the cropper.
- **Password policy fallback** — if `getPasswordPolicy()` fails, a default policy (minLength 8, 1 upper / 1 lower / 1 digit) is used.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated employee (no additional permission).
- **`canDeactivate: [UnsavedChangesGuard]`** applied at route level.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Sub-components:** `ProfileCardComponent`, `ProfileBottomSheetComponent`, `WorkingHoursTabComponent`, `AvailabilityCardComponent`, `OutlookSyncSettingsComponent`
- **Dialogs:** `UnsavedChangesDialogComponent` (unsaved-changes guard), `SimpleConfirmationDialogComponent` (delete account), `ImageCropperDialogComponent` (profile picture), `AvailabilityDialogComponent` (edit window, currently unreachable because the availability tab is disabled)
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **Related:** [client-profile](../client-profile/spec.md) (parallel pattern for clients)
- **Backend endpoints:** see [contracts.md](./contracts.md)
