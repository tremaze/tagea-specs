# Feature: Client Dokumente

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Clients can view, download, upload, and sign their documents. Pending signature tasks are surfaced prominently; other documents live in a filterable grid. Tapping a document opens a preview dialog with signature, download, and (in the future) detail actions.

## User Stories

- As a **client** I want to see all documents shared with me, so that I can access important records whenever I need them.
- As a **client with pending signatures** I want those documents highlighted at the top, so that I don't miss them.
- As a **client** I want to preview a document before downloading, so that I don't waste bandwidth on the wrong file.
- As a **client** I want to upload documents (e.g. medical certificates, IDs), so that my caseworker has what they need.

## Acceptance Criteria

### List (`/client-portal/dokumente`)

- [ ] **Given** the page loads, **When** data fetches, **Then** documents are rendered as cards in a responsive grid.
- [ ] **Given** the client has pending signature documents, **When** the page renders, **Then** a separate "Pending signatures" section is shown at the top with a count.
- [ ] **Given** a pending-signature card is clicked or its "Sign" button pressed, **When** the action fires, **Then** the preview dialog opens with signature UI.
- [ ] **Given** filter chips are shown, **When** a chip is selected (single-select), **Then** the grid filters by document category.
- [ ] **Given** a document is an image type, **When** the card renders, **Then** a thumbnail is shown (lazy-loaded) instead of the generic file icon.
- [ ] **Given** a document is signed, **When** the card renders, **Then** a "signed" badge overlays the thumbnail with a tooltip showing the signing timestamp.
- [ ] **Given** "Download" is pressed, **When** the request resolves, **Then** the file downloads to the platform default location.
- [ ] **Given** a document was uploaded by the client (`doc.uploaded_by === 'client'`), **When** the card renders, **Then** a "Delete" action is available; pressing it shows a confirmation, and on confirm the document is deleted, the list refreshes, and a snackbar confirms success.
- [ ] **Given** the mobile FAB is pressed, **When** activated, **Then** the upload dialog opens.

### Preview (dialog, not a route)

- [ ] **Given** a document card is clicked, **When** the dialog opens, **Then** the file is rendered inline (PDF in iframe, image inline, generic types as "download to view").
- [ ] **Given** the document requires a signature, **When** the signature step is reached, **Then** a drawable signature pad is shown; submitting completes the signature and marks the document as signed.

### Upload (dialog)

- [ ] **Given** the upload dialog is open, **When** the user picks a file, **Then** its name, size, and a category selector are shown.
- [ ] **Given** a category is chosen and the upload button is pressed, **When** the upload succeeds, **Then** close the dialog, refresh the list, and show a success snackbar.
- [ ] **Given** the upload fails, **When** the error returns, **Then** show an error snackbar and keep the dialog open.

### Detail Route (`/client-portal/dokumente/:id`)

- [ ] **Status:** placeholder — detail route exists but currently renders a stub. **This is an intentional non-goal for the MVP spec.** The preview dialog fulfills the "view document" use case.

## UI States

| State                           | When?                              | What does the user see?                                       | A11y notes      |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------- | --------------- |
| Loading                         | Initial fetch                      | Spinner + loading label                                       | `role="status"` |
| Error                           | Fetch failure                      | Error icon + localized text                                   | `role="alert"`  |
| Empty (no docs + no filter hit) | `filteredDocuments().length === 0` | Folder icon + empty explanation                               | —               |
| Populated                       | Any cards                          | Pending-signature section (conditional) + filter chips + grid | —               |
| Pending-signature section       | Any pending                        | Section header with count + task cards with "Sign" button     | —               |

## Flows

```
Page open
    │
    ▼
load all docs + pending signatures (parallel)
    │
    ▼
render pending section (if any) + filter chips + doc grid
    │
    ├── card click → preview dialog
    ├── "Download" → binary fetch + platform save
    ├── FAB click → upload dialog → (success) refresh list
    └── sign action → signature dialog → (success) refresh + toast
```

## Non-Goals

- **Full `/client-portal/dokumente/:id` detail page** — currently a stub; the preview dialog covers the use case.
- **Document versioning** — not implemented.
- **Commenting/annotations** on documents — not implemented.

## Edge Cases

- **Large files:** preview dialog for >50MB should show a "too large to preview; download instead" fallback (verify in implementation).
- **Unsupported MIME types:** generic file icon + download-only behavior.
- **Thumbnail loading:** thumbnails are loaded per-document after the initial list; slow networks see placeholders first.
- **Signature mid-flow interruption:** if the dialog is dismissed before submission, the signature is discarded (no draft persistence).
- **Re-signing:** once signed, the document shows the badge; no "re-sign" flow.

## Permissions & Tenant/Institution

- **Required roles:** Client (gated by `clientPortalGuard`).
- **Institution context:** resolved server-side.
- **Backend access checks:** `ClientDocumentService` only returns documents the client has access to; upload respects tenant file storage limits.

## Notifications (Push / In-App)

- Pending-signature count is surfaced on the [Client Dashboard](../client-dashboard/spec.md) sidebar.
- A push notification for a new signature request deep-links to `/client-portal/dokumente`.
- New documents do not generate notifications by default (verify with tenant settings).

## i18n Keys

> User-facing strings remain in German.

- `clientPortal.dokumente.title`, `.subtitle`, `.helpTooltip`
- `clientPortal.dokumente.sections.pendingSignatures`
- `clientPortal.dokumente.buttons.{sign,download,upload}`
- `clientPortal.dokumente.states.{loading,error,empty,emptyHint}`
- `clientPortal.dokumentDetail.*` (placeholder only)

## Offline Behavior

**Flutter-specific:**

- Cached doc list visible offline; previews require network unless the file is already cached.
- Downloads should integrate with the OS (Files app on iOS, Downloads folder on Android) via `path_provider` + `open_file`.
- Uploads queue offline and flush on reconnect (or block — simpler).
- Signing requires online — show offline error.

## References

- **Angular implementation (list):** [`apps/tagea-frontend/src/app/pages/client-portal/client-dokumente-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-dokumente-page.component.ts)
- **Angular implementation (detail stub):** [`apps/tagea-frontend/src/app/pages/client-portal/client-dokument-detail.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-dokument-detail.component.ts)
- **Upload dialog:** [`client-document-upload-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-document-upload-dialog.component.ts)
- **Preview dialog:** `DocumentPreviewDialogComponent` (shared under `components/documents/`)
- **Service:** `ClientDocumentService`, `NativeFileDownloadService`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
