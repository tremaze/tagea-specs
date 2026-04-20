# Feature: Client Profile

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Clients manage their own profile: personal data, custom fields defined by the tenant, password change, and (when configured) view of managed clients (e.g., parent/guardian relationship). A tabbed layout on desktop collapses into a stacked/bottom-sheet layout on mobile.

## User Stories

- As a **client** I want to view and update my personal info, so that my caseworker has accurate data.
- As a **client** I want to change my password, so that I can maintain account security.
- As a **guardian/parent** I want to see the clients I manage, so that I can switch context or book appointments for them.
- As a **client with custom fields** I want to see and edit fields my tenant defines for me, so that additional required information can be captured.

## Acceptance Criteria

### Basic Profile

- [ ] **Given** the page loads, **When** fetches complete, **Then** a `ProfileCardComponent` shows current profile data (name, email, phone, address, etc.).
- [ ] **Given** the user edits fields in a form, **When** validation passes and Save is pressed, **Then** the profile update is persisted and a success snackbar is shown.
- [ ] **Given** the user has unsaved changes, **When** they attempt to navigate away, **Then** the `UnsavedChangesGuard` (`CanComponentDeactivate`) shows a confirmation dialog.
- [ ] **Given** the user confirms discard, **When** they proceed, **Then** form state is reset on return.

### Password Change

- [ ] **Given** a password policy (`PasswordPolicy`) is fetched from the backend, **When** the form renders, **Then** input validation enforces min length, upper/lower case, digits, and special characters per the policy.
- [ ] **Given** current password + new password + confirmation are entered, **When** the form is submitted, **Then** the change is persisted; show a success snackbar; sign-out + re-login is _not_ forced (verify policy).
- [ ] **Given** validation fails, **When** the user types, **Then** inline errors indicate which rule is violated.

### Custom Fields

- [ ] **Given** the tenant has custom fields configured, **When** the page loads, **Then** field groups render via `TageaCustomFieldsComponent` with their current values.
- [ ] **Given** custom field values change, **When** Save is pressed for that section, **Then** the update is persisted independently of the basic profile.

### Managed Clients

- [ ] **Given** the user is a guardian/manager of other clients, **When** the page loads, **Then** a "Managed Clients" section lists each via `ManagedClientCardComponent`.
- [ ] **Given** a managed client is tapped, **When** navigation happens, **Then** the user is taken to the correct client's view (verify target route).

### Mobile

- [ ] **Given** `isMobileView()` is true, **When** the layout renders, **Then** tabs collapse into stacked sections and/or a bottom-sheet menu (`MatBottomSheet`) replaces the tab row.

## UI States

| State          | When?            | What does the user see?        | A11y notes                          |
| -------------- | ---------------- | ------------------------------ | ----------------------------------- |
| Loading        | Initial fetch    | Spinner                        | `role="status"`                     |
| Saving         | Save in-flight   | Progress bar + disabled form   | —                                   |
| Edit mode      | Form dirty       | Save / Discard buttons enabled | —                                   |
| Password error | Policy violation | Inline form errors             | `aria-invalid` + `aria-describedby` |
| Success        | Save succeeded   | Snackbar                       | `role="status"`                     |

## Non-Goals

- **Avatar upload** — verify in the Angular implementation; may or may not be scoped in.
- **Two-factor auth setup** — out of scope for this spec.
- **Language preference change** — may be part of the form; verify during port.

## Edge Cases

- **Password policy change between loads:** policy is fetched per-load; a cached stale form doesn't re-validate against a new policy until reload.
- **Managed clients with pending approval:** status is shown on the card (verify).
- **Custom fields with required validation:** saving the basic profile should _not_ block because required custom fields aren't filled — the sections save independently.

## Permissions & Tenant/Institution

- **Required roles:** Client (via `clientPortalGuard`).
- **Institution context:** server-resolved.
- **Backend access checks:** client can only update own profile; password changes may trigger audit log entries.

## Notifications (Push / In-App)

- Password change may trigger an email confirmation (server-side) — no in-app notification.
- No push notifications specific to this page.

## i18n Keys

> User-facing strings remain in German.

- `clientProfile.*` — owned by component template (verify full set)

## Offline Behavior

**Flutter-specific:**

- Profile view works offline from cache.
- Saving requires network — queue or block during port.
- Password change requires online always.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.ts)
- **Template:** [`client-profile.component.html`](../../../apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.html)
- **Components:** `ProfileCardComponent`, `TageaCustomFieldsComponent`, `ManagedClientCardComponent`
- **Services:** `UnifiedAuthService`, `CustomFieldsService`, `CustomFieldsV2Service`, `FieldGroupingService`, `ApiConfigService`
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
