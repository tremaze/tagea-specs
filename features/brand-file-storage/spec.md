# Feature: Brand File Storage

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-29

## Vision (Elevator Pitch)

Each brand in the brand-manager gets its own file area: a flat folder where admins can drag-and-drop arbitrary files for download, plus read-only system subfolders that surface the brand's existing assets (logos, Firebase config, notification icons) as downloadable entries. One place to find everything that belongs to a brand.

## User Stories

- As a **brand-manager admin** I want to drag files into a brand's storage so I can keep brand-related documents (mockups, contracts, build notes) next to the brand they belong to.
- As a **brand-manager admin** I want to download a brand's previously uploaded assets (google-services.json, icons, …) from the same browser so I don't have to re-upload to retrieve them.
- As a **brand-manager admin** I want the protected asset entries to be clearly read-only so I can't accidentally delete or overwrite a build-critical file.

## Acceptance Criteria

- [ ] **Given** the user opens a brand's edit page, **When** the "Dateien" section renders, **Then** the user sees a flat list of user-uploaded files plus the system subfolders defined in [System Subfolders](#system-subfolders).
- [ ] **Given** the user drags one or more files onto the drop zone (root only), **When** the upload finishes, **Then** the files appear in the user-file list and persist across reloads.
- [ ] **Given** the user clicks a user-uploaded file, **When** the action menu opens, **Then** "Herunterladen" and "Löschen" are available.
- [ ] **Given** the user opens a system subfolder, **When** the contents render, **Then** each entry shows only "Herunterladen" — no upload, rename, move, or delete affordance.
- [ ] **Given** the user attempts to drop a file onto a system subfolder, **When** the drop completes, **Then** the upload is rejected with a clear message ("Systemordner sind schreibgeschützt. Lade die Datei über den passenden Schritt im Brand-Editor hoch.").
- [ ] **Given** an asset for a system subfolder is missing (e.g. no `google-services.json` uploaded yet), **When** the subfolder is opened, **Then** the empty state explains where to upload it.
- [ ] **Given** a user-file name collides with an existing file, **When** the upload is attempted, **Then** the user is asked whether to overwrite or cancel (no silent overwrite).
- [ ] **Given** any storage operation fails, **When** the error returns, **Then** the UI surfaces a German error message and the list refreshes to its last consistent state.

## System Subfolders

The flat root contains user-uploaded files plus a fixed set of system subfolders. System subfolders are **virtual**: they do not own storage rows of their own — they project the existing asset endpoints (see [`assets.service.ts`](../../../apps/brand-manager/src/app/assets/assets.service.ts)) as read-only download entries.

### Subfolder names and asset mapping

System subfolders are organized **by platform**. iOS-specific assets live under `ios/`, Android-specific assets under `android/`. There are exactly two system subfolders.

| Subfolder   | Backed by asset type(s)                                                | File(s) shown                                                                                              |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ios`       | `google_service_info_plist`, `ios_icon`                                | `GoogleService-Info.plist`, `icon.png` _or_ `icon.jpg`                                                     |
| `android`   | `google_services_json`, `android_icon`, `android_notification_icon`    | `google-services.json`, `icon-foreground.png` _or_ `icon-foreground.jpg`, `notification-icon.png` _or_ `.jpg` |

Each subfolder shows only the files that have actually been uploaded for that asset type. Missing assets are not listed (the empty subfolder state explains that the file hasn't been uploaded yet, with a link to the relevant editor step).

### Behavior of system subfolders

- Always listed (even if every asset inside is missing) so the structure is predictable.
- Each entry's filename matches what the asset service stores (e.g. `google-services.json`, `icon.png`).
- Read-only: download is the only action. Uploads to these locations happen exclusively through the existing brand-editor steps (Icons step, Platform Assets step) — the file storage UI does not duplicate that flow.
- Folder names themselves are not localized (they map 1:1 to technical asset categories); on-screen labels next to the folder name may be localized.

## UI States

| State                  | When?                                              | What does the user see?                                                                          | A11y notes                                                          |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Initial / Loading      | Section first opens                                | Skeleton list + system subfolders shown immediately as static rows                               | `aria-busy` on list while loading                                   |
| Empty (root)           | No user files uploaded yet                         | Drop-zone message "Dateien hier ablegen oder klicken zum Auswählen" + system subfolders below    | Drop-zone is a labeled button with keyboard fallback                |
| Populated              | ≥ 1 user file or any system asset present          | User files at top, system subfolders at bottom with lock icon                                    | Lock icon has `aria-label="Schreibgeschützt"`                       |
| System subfolder open  | User entered a system subfolder                    | Read-only file list; if all assets missing → empty state with link back to the relevant editor step | Back button labeled "Zurück zur Dateiübersicht"                  |
| Upload in progress     | File(s) being uploaded                             | Per-file progress + cancel                                                                       | Live region announces completion / failure                          |
| Error                  | Upload, download, or delete failed                 | Inline error toast with retry; list reverts to last good state                                   | Toast role `alert`                                                  |

## Flows

```mermaid
flowchart TD
    A[Brand-Editor: Tab "Dateien"] --> B[Lade Liste]
    B --> C{Datei-Typ?}
    C -->|User-Datei| D[Aktionen: Download, Löschen]
    C -->|System-Ordner| E[Öffne Ordner]
    E --> F[Liste der gemappten Asset-Dateien]
    F --> G[Aktion: nur Download]
    A --> H[Drag & Drop auf Root]
    H --> I{Konflikt?}
    I -->|Nein| J[Upload → Liste aktualisiert]
    I -->|Ja| K[Bestätigung "Überschreiben?"]
    K -->|Ja| J
    K -->|Nein| L[Abbruch]
```

## Non-Goals

- **No nested user folders.** The user area is flat. If brands need hierarchy later, that's a follow-up.
- **No moving/renaming of system entries.** System subfolders are virtual projections of the asset service; renaming or deleting them is out of scope.
- **No per-file ACLs.** Anyone who can edit the brand can read/write all user files for that brand.
- **No quotas in v1.** A reasonable per-file size cap is enforced (see [contracts.md](./contracts.md)) but no aggregate brand quota.
- **No versioning / history** of user files. Overwrite replaces the previous file.
- **No migration of existing assets** into a new storage layout — the asset endpoints remain the source of truth and are merely surfaced read-only.

## Edge Cases

- Brand has no assets uploaded → all system subfolders open into empty states with a pointer to the right editor step.
- File name contains characters that S3 rejects → reject upload with a clear message before sending.
- User uploads a file whose name collides with a system filename (e.g. names a user file `google-services.json` at root) → allowed; user files live at root, system files in subfolders, no collision possible.
- Concurrent uploads from two admins → last-write-wins for same name; collision check is best-effort.
- Asset gets re-uploaded via the existing editor step while the file storage UI is open → next refresh shows the new version (no live updates required in v1).

## Permissions & Tenant/Institution

- **Required roles:** Brand-manager admin (whoever can edit the brand today). Same access level — no new role.
- **Institution context:** N/A. Brands are global to the brand-manager app.
- **Backend access checks:** Same JWT/OIDC guard already protecting brand CRUD. The new endpoints reject any caller without that auth.

## Notifications (Push / In-App)

Not applicable — file operations are foreground-only and don't notify anyone.

## i18n Keys

User-facing strings only (German), to be added under `brandManager.fileStorage.*`:

- `brandManager.fileStorage.title` → "Dateien"
- `brandManager.fileStorage.dropzone` → "Dateien hier ablegen oder klicken zum Auswählen"
- `brandManager.fileStorage.systemFolderReadonly` → "Systemordner sind schreibgeschützt. Lade die Datei über den passenden Schritt im Brand-Editor hoch."
- `brandManager.fileStorage.systemFolderEmpty` → "Diese Datei wurde noch nicht hochgeladen."
- `brandManager.fileStorage.confirmOverwrite` → "Datei mit gleichem Namen existiert bereits. Überschreiben?"
- `brandManager.fileStorage.confirmDelete` → "Datei wirklich löschen?"
- `brandManager.fileStorage.uploadFailed` → "Upload fehlgeschlagen."
- `brandManager.fileStorage.downloadFailed` → "Download fehlgeschlagen."

## Offline Behavior

Brand-manager is admin-only and assumed to run online. No offline support in v1.

## Architecture

- **Storage**: a new lightweight service inside `apps/brand-manager/src/app/file-storage/` that wraps the existing `StorageInterface` (S3 / local / dual). Keys: `brands/<brandId>/files/<filename>`. No folder rows in the DB — the user area is a flat namespace; system subfolders are computed at read time by delegating to `AssetsService`.
- **No code reuse from `tagea-backend`'s file-storage**: that system is hierarchical, has quotas, and is wired to a different DB. Porting would be disproportionate. We deliberately build a smaller, brand-specific service here.
- **Frontend**: a new component inside the brand editor (`apps/brand-manager-ui/src/app/brands/brand-editor/file-storage/`). Reuses the existing `FileDropZoneComponent` already used by the icons step.

## References

- **Brand-manager backend:** `apps/brand-manager/src/app/`
  - Existing assets service: `apps/brand-manager/src/app/assets/assets.service.ts`
  - Storage abstraction: `apps/brand-manager/src/app/storage/`
- **Brand-manager UI:** `apps/brand-manager-ui/src/app/brands/`
  - Brand editor: `brand-editor/brand-editor.component.ts`
  - Existing drop-zone: `brand-creation-wizard/steps/icons-step.component.ts` (uses `FileDropZoneComponent`)
- **Backend endpoints:** see [contracts.md](./contracts.md)
