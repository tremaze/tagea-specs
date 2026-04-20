# Feature: Employee Profile (Own)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Self-service profile page at `/employee-profile` for staff to manage their own personal data, availability, custom fields, and password. Tabbed layout on desktop / stacked on mobile. Unsaved-changes guard protects against data loss.

## User Stories

- As a **staff member** I want to update my personal data, so that my profile stays accurate.
- As a **staff member** I want to set my availability (working hours), so that the calendar reflects when I'm bookable.
- As a **staff member** I want to change my password, so that I can maintain account security.
- As a **staff member** I want the app to warn me before I lose unsaved changes, so that I don't accidentally discard edits.

## Acceptance Criteria

- [ ] **Given** the page loads, **When** profile data resolves, **Then** `ProfileCardComponent` renders with basic info.
- [ ] **Given** the availability tab is active, **When** data resolves, **Then** `AvailabilityCardComponent` shows weekly availability with editable slots.
- [ ] **Given** the user has unsaved changes, **When** they attempt to navigate away, **Then** `UnsavedChangesGuard` (`canDeactivate`) shows `SimpleConfirmationDialogComponent`.
- [ ] **Given** the user uploads an avatar, **When** `HttpEventType.UploadProgress` events fire, **Then** a progress bar renders until complete.
- [ ] **Given** mobile view, **When** tab UI is constrained, **Then** `ProfileBottomSheetComponent` replaces the tab bar.

## UI States

| State         | When?                                | Rendering                                                            |
| ------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Loading       | Initial fetch                        | Spinner                                                              |
| Loaded        | Profile resolved                     | Tabbed layout with profile + availability + custom fields + password |
| Saving        | Save in-flight                       | Progress bar + disabled form                                         |
| Unsaved guard | Navigation attempted with dirty form | Confirmation dialog                                                  |
| Error         | Save failure                         | Snackbar                                                             |

## Non-Goals

- **Another user's profile** — this is self-only. Admin view of other employees happens via other routes.
- **Institution assignment changes** — admin-only, not self-service.

## Edge Cases

- **Concurrent edits across tabs** — last-write-wins (no optimistic locking on the form).
- **Avatar upload mid-save** — avatar upload is a separate call; verify ordering.
- **Custom fields required but empty** — blocks save on the custom-fields tab only, not on the basic profile tab.

## Permissions & Tenant/Institution

- **Required roles:** any authenticated employee (no additional permission).
- **`canDeactivate: [UnsavedChangesGuard]`** applied at route level.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Sub-components:** `ProfileCardComponent`, `ProfileBottomSheetComponent`, `AvailabilityCardComponent`
- **Dialogs:** `SimpleConfirmationDialogComponent`
- **Guard:** `UnsavedChangesGuard` via `CanComponentDeactivate`
- **Related:** [client-profile](../client-profile/spec.md) (parallel pattern for clients)
- **Backend endpoints:** see [contracts.md](./contracts.md)
