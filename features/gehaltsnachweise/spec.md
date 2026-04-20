# Feature: Gehaltsnachweise (Proof of Salary)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff landing page for salary documents (payslips). Lists the employee's payslip PDFs grouped by month, with preview + download actions. Feature-gated behind a tenant flag (`proofOfSalaryFeatureGuard`).

## User Stories

- As a **staff member** I want to see my monthly salary documents in one place, so that I can review or download them.
- As a **staff member** I want to open a payslip inline, so that I don't need to download every file first.

## Acceptance Criteria

### Load + group

- [ ] **Given** the user opens `/teamspace/gehaltsnachweise`, **When** `ProofOfSalaryService` loads, **Then** documents are grouped by month into `MonthGroup[]` with `label` and `sortKey` fields.
- [ ] **Given** load succeeds, **When** `hasDocuments()` is true, **Then** month groups render sorted by `sortKey` descending.
- [ ] **Given** load succeeds with zero documents, **When** `hasDocuments()` is false, **Then** an empty state with icon `receipt_long` and localized text is shown.

### States

- [ ] **Given** `proofOfSalaryService.loading()` is true, **When** the page renders, **Then** a spinner + "loading" message is shown.
- [ ] **Given** `proofOfSalaryService.error()` has value, **When** the page renders, **Then** an error panel with the service-provided message + "Retry" button is shown; pressing retry re-invokes `loadDocuments()`.

### Document actions

- [ ] **Given** a document card is clicked, **When** `openPreview(doc)` fires, **Then** `ProofOfSalaryService.downloadDocumentBlob(doc.id)` returns a blob and `DocumentPreviewDialogComponent` opens with a `downloadFn` wired to the same service method.
- [ ] **Given** the preview dialog is open, **When** the user presses its internal download action, **Then** the `downloadFn` triggers the platform save.

> **Note:** there is no separate download button on the list card itself — card click opens the preview dialog, and the download action lives inside the dialog via `downloadFn`.

## UI States

| State     | When?                 | What does the user see?                | A11y notes      |
| --------- | --------------------- | -------------------------------------- | --------------- |
| Loading   | `loading()` true      | Spinner + loading text                 | `role="status"` |
| Error     | `error()` has value   | Error icon + message + retry button    | `role="alert"`  |
| Empty     | load done, no docs    | `receipt_long` icon + empty message    | —               |
| Populated | month groups rendered | Sections per month with document cards | —               |

## Non-Goals

- **Upload / admin** — employees can only consume; admin/payroll uploads happen elsewhere.
- **Annotations or edits** — read-only.
- **Multi-year archive browser** — the current UI is a flat list of all fetched documents grouped by month.

## Edge Cases

- **Document unavailable / deleted on backend** — 404 on preview; surface a transient error.
- **Large files** — preview dialog may fall back to "download to view" (same rule as [client-dokumente](../client-dokumente/spec.md)).
- **Month boundaries** — `sortKey` is stable; monthly grouping handles documents issued across year boundaries correctly.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_home.view'`.
- **Feature guards:** `teamspaceFeatureGuard`, `proofOfSalaryFeatureGuard`.
- **Institution context:** server-resolved per authenticated employee.

## Notifications (Push / In-App)

- New payslip notifications may deep-link here (verify with backend).

## i18n Keys

> User-facing strings remain in German.

- `proofOfSalary.title`, `.subtitle`, `.helpTooltip`
- `proofOfSalary.loading`, `.retry`
- `proofOfSalary.error.title`, `.error.message` (fallback)
- `proofOfSalary.empty.title`, `.empty.message`
- `proofOfSalary.documents.title`

## Offline Behavior

**Flutter-specific:**

- Cached list visible offline.
- Previews require online unless the file is already cached.
- Downloads integrate with OS file system (`path_provider` + `open_file`).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/proof-of-salary-page.component.ts)
- **Service:** [`ProofOfSalaryService`](../../../apps/tagea-frontend/src/app/services/proof-of-salary.service.ts)
- **Preview dialog:** [`DocumentPreviewDialogComponent`](../../../apps/tagea-frontend/src/app/components/documents/document-preview-dialog.component.ts)
- **Feature guard:** `proofOfSalaryFeatureGuard`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
