# Feature: Files (Global)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Global (non-institution-scoped) file browser at `/dateien`. Lazy-loaded via `FILES_ROUTES`. Same `FilesPageComponent` as the institution mount — provides browse / upload / download / share on the tenant's file storage.

## User Stories

- As a **staff member** I want a single global files area, so that I can find documents not tied to a specific institution.
- As a **staff member** I want upload / download / share actions, so that the file area functions like a shared drive.

## Acceptance Criteria

- [ ] **Given** the user opens `/dateien`, **When** `FilesPageComponent` loads (lazy-loaded via `FILES_ROUTES`), **Then** the file browser renders.
- [ ] **Given** the fetch scopes to the tenant level (not institution), **When** files load, **Then** only tenant-level files appear.
- [ ] **Given** the user uploads a file, **When** the upload completes, **Then** it appears in the list and is accessible to other tenant users per their permissions.

## UI States

| State     | When?         | Rendering                     |
| --------- | ------------- | ----------------------------- |
| Loading   | Initial fetch | Spinner                       |
| Populated | Files visible | Tree + actions toolbar        |
| Empty     | No files      | "Empty" state + upload prompt |
| Error     | Fetch failure | Error panel + retry           |

## Non-Goals

- **Permission management UI** — tenant-level permissions set elsewhere.
- **Version history** — verify; may be implicit or absent.

## Edge Cases

- **Very large files** — upload progress UI; verify chunked upload behavior.
- **MIME-type handling** — preview vs. download-only split.
- **Trashed files** — verify whether a trash bucket exists.

## Permissions & Tenant/Institution

- **Feature guard:** `fileStorageFeatureGuard`.
- **Required permission:** none at route level — access purely feature-flag driven.
- **Tenant context:** implicit from the auth session.

## Notifications (Push / In-App)

- Not a primary push target.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter-specific:**

- ❌ P2 non-goal.

## References

- **Route file:** [`apps/tagea-frontend/src/app/pages/files/files.routes.ts`](../../../apps/tagea-frontend/src/app/pages/files/files.routes.ts)
- **Component:** [`apps/tagea-frontend/src/app/pages/files/files-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/files/files-page.component.ts)
- **Shared with:** [files-institution](../files-institution/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)
