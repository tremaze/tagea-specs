# Feature: Duplicate Brand

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-29

## Vision (Elevator Pitch)

A brand-manager admin can duplicate an existing brand from the brand list as a one-click deep clone. The new brand carries over **everything** from the source — full configuration, all S3 storage files (assets, icons, Firebase configs, secret files), and secret-tracking metadata — so the admin only needs to pick a new brand ID, then edit whatever needs to differ in the new brand's editor afterwards.

## User Stories

- As a **brand-manager admin** I want to duplicate an existing brand with a single click so I can use it as a starting point without re-entering or re-uploading anything.
- As a **brand-manager admin** I want stored files (icons, Firebase configs, secret keys, user-uploaded files) to be carried over so I don't have to track them down and re-upload them.
- As a **brand-manager admin** I want the new brand's identity-critical IDs (bundle IDs, app IDs) carried over too so I see exactly what needs to be changed when I open the new brand for editing.

## Acceptance Criteria

- [ ] **Given** the brand list is open, **When** the user opens the row's overflow menu, **Then** a "Duplicate" action is shown alongside the existing Edit/Export actions.
- [ ] **Given** the user clicks "Duplicate" on a brand row, **When** the duplicate dialog opens, **Then** the dialog shows two inputs: new brand ID (empty) and display name (prefilled with `<source.displayName> Copy`).
- [ ] **Given** the duplicate dialog is open, **When** the user confirms with a valid new ID (matches `^[a-z0-9-]+$`, not equal to source ID, not already in use), **Then** the backend deep-copies the source brand per [Copy Policy](#copy-policy) and the user is navigated to the new brand's edit page.
- [ ] **Given** the user enters a new brand ID that already exists, **When** they submit, **Then** the dialog shows the German error "Eine Brand mit dieser ID existiert bereits." and stays open.
- [ ] **Given** the user enters a new brand ID matching the source's ID, **When** they try to submit, **Then** the submit button is disabled with a hint "Die neue ID muss sich von der Quell-Brand unterscheiden."
- [ ] **Given** the user enters a brand ID that violates the format rule, **When** they try to submit, **Then** the submit button is disabled with a hint "Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt."
- [ ] **Given** the duplicate succeeds, **When** the new brand is opened, **Then** every storage file under the source brand exists under the new brand (assets at the root prefix and user files under `files/`).
- [ ] **Given** the source has secret files stored (e.g. `asc-api-key.p8`, `play-store-service-account.json`), **When** the duplicate finishes, **Then** the corresponding `BrandSecret` rows on the new brand reflect `isStoredLocally: true` for the secrets that were copied.
- [ ] **Given** the duplicate succeeds, **When** the new brand is opened, **Then** its `syncStatuses` are all `pending` — sync state is per-brand and never carried over (the new brand has not actually been synced to push gateway / capgo / iOS provisioning yet).
- [ ] **Given** the user cancels the dialog, **When** the dialog closes, **Then** no brand is created and no files are copied.
- [ ] **Given** the duplicate API call fails partway through file copy, **When** the error returns, **Then** the new brand row is rolled back (no partial brand left in the database) and the dialog surfaces a German error message.

## UI States

| State             | When?                            | What does the user see?                                                                       | A11y notes                                |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Idle (list)       | Default                          | Brand list with "Duplicate" entry in each row's overflow menu                                 | Menu item reachable via keyboard          |
| Dialog open       | After clicking Duplicate         | Modal with two inputs (new ID, display name) and a hint reminding the user that bundle IDs are copied as-is and need to be edited afterwards | Focus trapped; new-ID field auto-focused |
| Dialog invalid    | Required field empty/format wrong | Submit button disabled; field-level hint visible                                              | Errors announced via `aria-describedby`   |
| Dialog submitting | After submit, before response    | Submit button shows spinner; fields disabled (file copy may take a few seconds)                | `aria-busy="true"` on dialog              |
| Dialog error      | Server returns conflict / 500    | Inline error message at top of dialog; form re-enabled                                        | Error in `role="alert"` region            |
| Success           | Server returns 201               | Dialog closes, browser navigates to `/brands/<new-id>`                                        | Snackbar "Brand dupliziert" optional      |

## Flows

```
brand list  →  row overflow menu  →  "Duplicate"
                                        ↓
                          duplicate dialog opens
                                        ↓
                    user enters new ID, clicks "Duplicate"
                                        ↓
              POST /brands/<sourceId>/duplicate { id, displayName }
                                        ↓
                    backend deep-copies brand + storage:
                      1. Insert new Brand row (all fields copied)
                      2. Initialize fresh sync statuses
                      3. List + copy storage files (root + files/)
                      4. Update BrandSecret rows for any secret files copied
                      5. On any failure: rollback (delete new brand)
                                        ↓
                  navigate to /brands/<new-id> (edit page)
```

## Copy Policy

The duplicate runs **on the backend** via a dedicated `POST /brands/:id/duplicate` endpoint, because it copies S3 storage files in addition to database rows — that operation cannot be expressed through the existing `POST /brands` create endpoint.

### Brand row — copied from source

Every column on the `brands` table is copied verbatim from the source, **except**:

- `id` — replaced with the user-supplied new ID
- `displayName` — replaced with the user-supplied display name (defaults to `<source>.displayName + " Copy"`)
- `name` — set to the new `displayName` (or kept identical to source if user did not change `displayName`)
- `createdAt`, `updatedAt` — auto-populated by TypeORM

Identity-critical fields like `iosBundleId`, `androidApplicationId`, `iosUrlScheme`, `androidUrlScheme`, `firebaseIosAppId`, `firebaseAndroidAppId`, `tenantIds`, `cloudGroupId` are **carried over as-is**. The user is responsible for editing them in the new brand's editor afterwards (the dialog displays a hint about this).

### Storage files — copied from source

All files under the source brand's storage prefix are copied to the new brand's prefix. The two known sub-prefixes to enumerate are:

- root (`''`) — top-level assets: `google-services.json`, `GoogleService-Info.plist`, `ios-icon.png`, `android-icon.png`, `notification-icon.png`, secret files (`asc-api-key.p8`, `play-store-service-account.json`)
- `files/` — user-uploaded files (see [brand-file-storage](../brand-file-storage/spec.md))

Implementation: the backend lists each prefix on the source, downloads each file, and uploads it to the new brand under the same filename. The storage backend (S3 or local) is opaque to the duplicate logic.

### BrandSecret rows — initialized to reflect copied files

The duplicate creates fresh `BrandSecret` rows for the new brand (one per secret type). For each secret type, if the corresponding secret file existed under the source brand's storage and was copied, the new `BrandSecret` row is set to `isStoredLocally: true` and inherits the `localFileName`. Otherwise the row is initialized as `isStoredLocally: false`.

### SyncStatus rows — initialized fresh

`SyncStatus` rows are **not** copied. The new brand has never been synced to push gateway / capgo / iOS provisioning, so it gets fresh `pending` rows just like any newly created brand. Copying `synced` would be a lie about external state.

### Build counters

`iosBuildNumber`, `iosVersionString`, `androidVersionCode`, `androidVersionName`, `lastIosBuildAt`, `lastAndroidBuildAt` are copied. They reflect the source brand's build history; the new brand's first build will increment from those values. This is consistent with "deep clone": if the user wants to start build numbers fresh, they edit them in the brand editor.

## Prefill Rules (dialog defaults)

| Field        | Prefilled value             |
| ------------ | --------------------------- |
| New brand ID | empty (force conscious choice) |
| Display name | `<source.displayName> Copy` |

## Non-Goals

- No bulk duplication (one brand at a time)
- No cross-environment duplicate (duplication happens within one brand-manager instance)
- No template / "save as preset" feature (users can duplicate any existing brand if they need a starting point)
- No automatic mutation of identity-critical IDs — bundle IDs / app IDs are copied verbatim and the user must edit them post-duplication if they intend to ship the new brand to stores

## Edge Cases

- Source brand has no iOS or Android bundle ID set: copied verbatim (new brand also has them empty)
- Source brand has no storage files: duplicate succeeds with empty storage (no files to copy, no error)
- Source brand has only a subset of secrets stored (e.g. iOS signing only): the corresponding `BrandSecret` rows on the new brand reflect the partial state
- File copy fails partway: the backend rolls back by deleting the partially-created brand row + any files already copied
- Race: two admins duplicate to the **same** new ID — second request gets a 409 from the duplicate-ID check; dialog shows the German error and the user picks a different ID
- Very large user file storage: the duplicate request may take several seconds; the dialog shows a spinner. Streaming or background-job orchestration is out of scope (real brand-manager users are admin-internal and rarely have multi-GB brand storage)

## Permissions & Tenant/Institution

- **Required roles:** brand-manager admin (same role as Edit / Export)
- **Institution context:** N/A — brand-manager is a tooling app, not tenant-scoped
- **Backend access checks:** existing `POST /brands` auth applies; no new permission

## Notifications (Push / In-App)

None.

## Open Questions

None — the user explicitly chose deep clone semantics ("alles kopieren, auch die Dateien auf S3") on 2026-04-29.
