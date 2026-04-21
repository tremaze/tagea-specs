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

- [ ] **Given** the page loads, **When** `GET /api/clients/me` resolves, **Then** a `ProfileCardComponent` shows the user's current profile data. The edit form binds `first_name`, `last_name`, `email` (disabled), and `phone` — additional fields like address / date of birth live on the `Client` model but are not exposed in the current form.
- [ ] **Given** the user edits fields in the profile form, **When** validation passes and Save is pressed, **Then** `PATCH /api/clients/me` is called with `{ first_name, last_name, phone }` and a success snackbar is shown.
- [ ] **Given** the user toggles the chat-notifications switch, **When** it changes, **Then** `PATCH /api/clients/me` is called with `{ chat_notifications: boolean }` and a confirmation snackbar is shown.
- [ ] **Given** the user has unsaved changes (`profileForm.dirty`), **When** they attempt to navigate away, **Then** the `UnsavedChangesGuard` (`CanComponentDeactivate`) shows a confirmation dialog via `MatDialog`.
- [ ] **Given** the user confirms discard, **When** they proceed, **Then** the form is reset and `markAsPristine()` is called on return.
- [ ] **Given** the user chooses "Konto löschen", **When** confirmed via `SimpleConfirmationDialogComponent`, **Then** `DELETE /api/clients/me` is called, the user is logged out via `UnifiedAuthService.logout()`, and navigation goes to `/`.

### Password Change

- [ ] **Given** a password policy is fetched from `GET /api/auth/password-policy`, **When** the form renders, **Then** input validation enforces min length, upper/lower case, digits, and special characters per the policy. If the fetch fails, a fallback policy `{ minLength: 8, minUpperCase: 1, minLowerCase: 1, minDigits: 1, minSpecialChars: 1 }` is used.
- [ ] **Given** current password + new password + confirmation are entered and match, **When** the form is submitted, **Then** `POST /api/auth/me/change-password` is called with `{ currentPassword, newPassword }`, a success snackbar is shown, and sign-out is _not_ forced.
- [ ] **Given** validation fails, **When** the user types, **Then** inline errors indicate which rule is violated and a live strength meter (`getPasswordStrength()`) updates color + label.

### Custom Fields

> **Status note:** In the current build, the Custom Fields tab is gated out — `loadCustomFields()` is present but **commented out in `ngOnInit`** pending the `visible_in_client_portal` / `editable_in_client_portal` flags on `CustomFieldDefinition`. The criteria below describe the intended behavior once re-enabled.

- [ ] **Given** the tenant has custom fields configured, **When** the page loads, **Then** field groups render via `TageaCustomFieldsComponent` with their current values.
- [ ] **Given** custom field values change, **When** Save is pressed for that section, **Then** the update is persisted (via `bulkUpdateCustomFieldsV2`) independently of the basic profile.

### Managed Clients ("Verwaltete Personen")

- [ ] **Given** the user has any `client_relationships` row with `can_manage: true` and `is_deleted: false`, **When** the page loads, **Then** `GET /api/client-portal/managed-clients` returns those entries and a section lists each via `ManagedClientCardComponent`.
- [ ] **Given** the response carries `relationship_type`, **When** rendered, **Then** the value is shown verbatim (free-form string from the tenant's `relationship_types` table — e.g. `"Kind"`, `"Ehepartner"`). It represents the **reverse** relationship — what the managed client is _to the viewer_ (a parent sees their child as `"Kind"`, not their own role as `"Erziehungsberechtigte/r"`). See [contracts.md](./contracts.md) for the backend logic.
- [ ] **Given** a managed client has `email` or `phone`, **When** rendered, **Then** the card exposes quick-action buttons that open `mailto:` / `tel:` links (via `ManagedClientCardComponent.onEmailClick` / `onPhoneClick`).
- [ ] **Given** the load fails, **When** the catch branch runs, **Then** the section silently shows the empty state (no error toast — `loadManagedClients()` sets `managedClients = []` and only logs to console).

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

- **Avatar upload** — not implemented in the Angular page (only initials-based avatar rendering in `ManagedClientCardComponent`).
- **Two-factor auth setup** — out of scope for this spec.
- **Language preference change** — `interface_language` exists on the `Client` model but is not editable from this page in the current build.
- **Address / date-of-birth editing** — backing fields exist on `Client`, but the profile form only exposes name, email (read-only), and phone.
- **In-page navigation from managed-client cards** — the card emits `cardClick`, but the host template does not bind to it. Context-switching to another client is not wired on this page.

## Edge Cases

- **Password policy change between loads:** policy is fetched per-load; a cached stale form doesn't re-validate against a new policy until reload.
- **Managed clients with pending approval:** status is shown on the card (verify).
- **Custom fields with required validation:** saving the basic profile should _not_ block because required custom fields aren't filled — the sections save independently.

## Permissions & Tenant/Institution

- **Route:** `/client-portal/profil` — registered in `CLIENT_PORTAL_CHILD_ROUTES` and protected at the parent by `clientPortalGuard` (`canActivate`). Angular does **not** inherit a sibling's `canActivate` onto this route itself — the guard is enforced via the parent route. `canDeactivate: [UnsavedChangesGuard]` runs on leave.
- **Backend authorization:** `@Auth({ scope: 'authenticated', permissions: [PROFILE_VIEW_OWN | PROFILE_EDIT_OWN | PROFILE_DELETE_OWN], allowedUserTypes: [UserType.CLIENT], allowPendingApproval: true })` on `ClientPortalController` (clients module). Protected fields (`status`, `category`, `login_enabled`, `email_verified`, `authProviderUserId`) are stripped server-side even if submitted.
- **Institution context:** not required — `/clients/me` operates on the principal's own record.

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
- **Route:** [`routes/client-portal.routes.ts`](../../../apps/tagea-frontend/src/app/routes/client-portal.routes.ts) (path `profil`, `canDeactivate: [UnsavedChangesGuard]`)
- **Components:** `ProfileCardComponent`, `TageaCustomFieldsComponent`, `ManagedClientCardComponent`, `SimpleConfirmationDialogComponent`
- **Services:** `UnifiedAuthService`, `CustomFieldsService`, `CustomFieldsV2Service`, `FieldGroupingService`, `ApiConfigService`, `ResponsiveNavigationService`
- **Guard:** `UnsavedChangesGuard` implementing `CanDeactivate<CanComponentDeactivate>`
- **Backend controllers:** `ClientPortalController` in [`apps/tagea-backend/src/clients/client-portal.controller.ts`](../../../apps/tagea-backend/src/clients/client-portal.controller.ts); password endpoints in [`apps/tagea-backend/src/auth/auth.controller.ts`](../../../apps/tagea-backend/src/auth/auth.controller.ts); managed-clients in [`apps/tagea-backend/src/client-portal/client-portal.controller.ts`](../../../apps/tagea-backend/src/client-portal/client-portal.controller.ts).
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
