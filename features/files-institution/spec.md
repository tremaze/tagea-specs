# Feature: Files (Institution)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Institution-scoped file browser at `/einrichtung/:institutionId/dateien`. Renders the same `FilesPageComponent` used by [files-global](../files-global/spec.md) but scoped to the institution's file storage. Browse, upload, download, and (where permitted) delete files.

## User Stories

- As a **staff member** I want to see files stored in my institution's workspace, so that I can access them quickly.
- As a **staff member** I want to upload / download files, so that I can collaborate.

## Acceptance Criteria

- [ ] **Given** the user opens `/einrichtung/:institutionId/dateien`, **When** `FilesPageComponent` loads, **Then** the file tree + actions render (identical to the global mount).
- [ ] **Given** the URL is institution-scoped, **When** the component resolves its context, **Then** all fetches are scoped to `institutionId` from the URL.

## Permissions & Tenant/Institution

- **Feature guard:** `fileStorageFeatureGuard`.
- **Institution context:** URL param (`:institutionId`).
- **No `permissionGuard`** is declared at route level — feature flag is the sole gate.

## References

- **Route definition:** `apps/tagea-frontend/src/app/routes/institution.routes.ts` (lines 268-275)
- **Component:** `FilesPageComponent` at [`apps/tagea-frontend/src/app/pages/files/files-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/files/files-page.component.ts)
- **Shared with:** [files-global](../files-global/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)

## UI States / Flows / i18n / Offline

All owned by `FilesPageComponent` — see [files-global/spec.md](../files-global/spec.md) for behavior (the two mounts share the same component; institution mount simply adds URL-scoped context).

## Non-Goals / Edge Cases

Identical to [files-global](../files-global/spec.md).
