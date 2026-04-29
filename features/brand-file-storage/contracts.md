# Contracts: Brand File Storage

> API endpoints, DTOs, events — everything that flows between frontend and backend for brand file storage.

All endpoints are mounted on the **brand-manager** NestJS app (not tagea-backend) and protected by the same JWT/OIDC guard as the existing brand CRUD routes.

## Endpoints

### `GET /api/brands/:brandId/files`

List the brand's file storage. Returns user-uploaded files at the root plus the two virtual system subfolders (`ios`, `android`) with their resolved entries.

**Response:**

```ts
interface BrandFileStorageResponse {
  userFiles: BrandStoredFile[];
  systemFolders: BrandSystemFolder[];
}

interface BrandStoredFile {
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

interface BrandSystemFolder {
  name: 'ios' | 'android';
  files: BrandSystemFile[];
}

interface BrandSystemFile {
  name: string;
  contentType: string;
  size: number;
  assetType:
    | 'google_services_json'
    | 'google_service_info_plist'
    | 'ios_icon'
    | 'android_icon'
    | 'android_notification_icon';
  readonly: true;
}
```

**Error codes:** 401, 403, 404 (brand)

---

### `POST /api/brands/:brandId/files`

Upload one or more files into the brand's user file area (root only). System subfolders cannot be targeted via this endpoint.

**Request:** `multipart/form-data` with field `files` (one or more), and optional `overwrite=true|false` (default: `false`).

**Response:**

```ts
interface BrandFileUploadResponse {
  uploaded: BrandStoredFile[];
  skippedConflicts: string[]; // filenames that were not overwritten
}
```

**Error codes:**
- `400` — invalid filename (empty, contains `/`, or matches a reserved system subfolder name)
- `401`, `403`, `404`
- `409` — filename collision and `overwrite=false`
- `413` — file too large (per-file cap configured via env, default 50 MB)

---

### `GET /api/brands/:brandId/files/:filename`

Download a user-uploaded file by its root filename.

**Response:** binary stream with `Content-Disposition: attachment; filename="<name>"`.

**Error codes:** 401, 403, 404 (brand or file)

---

### `DELETE /api/brands/:brandId/files/:filename`

Delete a user-uploaded file. Cannot target system files.

**Response:** `204 No Content`
**Error codes:** 401, 403, 404

---

### `GET /api/brands/:brandId/files/system/:folder/:filename`

Download a file from a system subfolder. `:folder` ∈ `{ios, android}`. Internally delegates to `AssetsService.downloadAsset(...)` for the matching asset type — there is no separate copy of the file.

**Response:** binary stream.
**Error codes:**
- `400` — unknown system folder
- `404` — asset has not been uploaded yet for that brand
- 401, 403

---

## System folder → asset mapping (server-side)

The mapping is fixed in code on the brand-manager backend. Frontend receives it indirectly via the `assetType` field on each `BrandSystemFile`.

```ts
// Source: apps/brand-manager/src/app/file-storage/system-folders.const.ts (new)
export const SYSTEM_FOLDER_MAP = {
  ios: ['google_service_info_plist', 'ios_icon'],
  android: ['google_services_json', 'android_icon', 'android_notification_icon'],
} as const;

export type BrandSystemFolderName = keyof typeof SYSTEM_FOLDER_MAP;
```

## Reserved filenames at root

User uploads cannot use the names `ios` or `android` (they would shadow system subfolders in URLs). The backend rejects with `400` and the frontend surfaces a German error.

## Storage keys

S3 / local-disk layout under the existing `StorageInterface`. The interface treats the brand id and the rest of the path as separate args; the layout below shows the resulting effective key.

```
brands/<brandId>/assets/<asset-filename>           # legacy asset paths (unchanged)
brands/<brandId>/assets/files/<user-filename>      # user files (this feature)
```

In code, user file operations call the storage with `filename = files/<userFilename>`. System subfolders are **not** materialized in storage. They are computed at read time from the existing asset paths.

The `StorageService` interface gains a single new method, `list(brandId, prefix)`, used by the new service to enumerate user files (S3: `ListObjectsV2`; local: `fs.readdir` + `stat`).

## Data Models (frontend)

```ts
// Source: apps/brand-manager-ui/src/app/brands/brand-editor/file-storage/file-storage.model.ts (new)
export type BrandSystemFolderName = 'ios' | 'android';

export interface BrandStoredFile {
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface BrandSystemFile {
  name: string;
  contentType: string;
  size: number;
  assetType: string;
  readonly: true;
}

export interface BrandSystemFolder {
  name: BrandSystemFolderName;
  files: BrandSystemFile[];
}

export interface BrandFileStorage {
  userFiles: BrandStoredFile[];
  systemFolders: BrandSystemFolder[];
}
```

## Events (WebSocket / Push)

None. File operations are request/response only.
