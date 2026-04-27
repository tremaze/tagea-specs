# Feature: Admin — Submission Categories

> **Status:** 🚧 Spec drafted — reflects in-repo implementation
> **Owner:** baumgart
> **Last updated:** 2026-04-22

## Vision (Elevator Pitch)

Global administration surface for submission categories ("Teamspace-Meldungen"). Admins manage categories (name, icon, description, teamspace visibility, supervisor/approval flags, notification emails, custom fields) and upload a PDF receipt template with placeholders that will populate automatically when a submission is filed.

## User Stories

- As a **global admin** I want to create, edit, archive, and delete submission categories across all teamspaces, so that incident reports / requests use a consistent schema organisation-wide.
- As a **global admin** I want to scope a category to specific teamspaces, so that only relevant staff see it in their submission form.
- As a **global admin** I want to configure which custom fields belong to a category, so that the submission form collects exactly the data handlers need.
- As a **global admin** I want to upload a PDF receipt template with placeholders, so that every submission produces a printable receipt with the submitter's data.
- As a **global admin** I want to see which placeholders are available for the PDF template, so that I know exactly which tokens I can reference in my template file.

## Acceptance Criteria

> Given/When/Then — observable behavior, phrased platform-agnostically.

### List (`/administration/daten/einreichungs-kategorien`)

- [ ] **Given** the user opens the page, **When** `SubmissionCategoriesService.getGlobalCategories` + `TeamspaceService.getAllTeamspaces` resolve, **Then** all categories render in a reorderable list with icon, name, teamspace-scope badges, and field counts.
- [ ] **Given** multiple teamspaces exist, **When** the user selects one or more teamspace chips from the filter, **Then** the list filters to categories scoped to those teamspaces (plus categories visible to all).
- [ ] **Given** the list renders, **When** the user drags a category, **Then** the order persists via `reorderGlobalCategories`.

### Create (Sidecard: `Neue Kategorie`)

- [ ] **Given** the "New category" CTA fires, **When** the sidecard opens, **Then** fields are empty and the PDF-template section is **not** visible (no `category_id` yet).
- [ ] **Given** the user fills name (required) + optional icon/description + supervisor/approval/attachment/notification flags + teamspace assignments, **When** they press Save, **Then** `createGlobalCategory` runs and the list reloads with the new category at the bottom.

### Edit (Sidecard: `Kategorie bearbeiten`)

- [ ] **Given** the user opens an existing category, **When** the sidecard renders, **Then** all form fields are pre-filled with the stored values (name, icon, description, active-toggle, repeating settings, teamspace IDs, supervisor/approval/attachment/emails).
- [ ] **Given** `form.dirty` is false and the `group()` input changes (e.g. re-bind), **When** the effect runs, **Then** the form re-hydrates from the new group. If `form.dirty` is true, the effect skips to preserve user input.
- [ ] **Given** the user changes fields and saves, **When** `updateGlobalCategory` resolves, **Then** the sidecard closes and the list row reflects the update.

### PDF template (Edit-mode only)

- [ ] **Given** the sidecard is in edit mode, **When** no template is uploaded yet, **Then** an "Upload PDF" button is visible with a hint text. Pressing the button opens a native file picker restricted to `application/pdf`.
- [ ] **Given** a PDF file is selected, **When** `uploadPdfTemplate(categoryId, file)` resolves with a category, **Then** the section switches to the "uploaded" state showing filename, size (formatted), download and delete actions — without closing the sidecard.
- [ ] **Given** a template is uploaded, **When** the user clicks Download, **Then** the file downloads under `pdf_template_filename`.
- [ ] **Given** a template is uploaded, **When** the user clicks Delete, **Then** `SimpleConfirmationDialogComponent` confirms, and on confirm `deletePdfTemplate` clears the template; the section returns to upload state.
- [ ] **Given** the category has at least one custom field, **When** the user clicks the help icon next to "PDF-Vorlage", **Then** `SubmissionPdfPlaceholdersDialogComponent` opens and lists all `SubmissionCategoryField` placeholders plus the static environment placeholders (employee, institution, submission metadata).
- [ ] **Given** any PDF action is in flight, **When** the request is pending, **Then** buttons are disabled (`pdfBusy` signal).

### Field definitions (per-category)

- [ ] **Given** the user expands a category in the list, **When** the field editor renders, **Then** fields can be created, edited, deleted, and reordered using the shared `AdminFieldEditorComponent` / `CustomFieldGroupFieldsService`.

### Delete

- [ ] **Given** the user presses Delete on a category, **When** confirming in the native confirm dialog, **Then** `deleteGlobalCategory` soft-deletes and the list refreshes.

## UI States

| State     | When?                                  | What does the user see?                                                   | A11y notes        |
| --------- | -------------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| Loading   | Initial fetch / teamspace filter swap  | Shell list, skeleton rows                                                 | `aria-busy`       |
| Empty     | No categories match filter             | Empty state + "New category" CTA                                          | —                 |
| Populated | Categories rendered                    | Reorderable cards with badges and field counts                            | —                 |
| Editing   | Sidecard open (create or edit)         | Form fields + teamspace picker + supervisor/emails + PDF (edit only)      | focus trap        |
| Busy      | PDF upload/delete in flight            | PDF buttons disabled, spinner on action                                   | `aria-busy`       |
| Error     | Create/update/delete fails             | Snackbar with `administration.submissions.errors.*`                       | `role="status"`   |

## Flows

1. Admin opens list → selects optional teamspace filter → list reloads.
2. Admin clicks "Neue Kategorie" → sidecard opens (no PDF section) → fills form → saves → category appears in list.
3. Admin clicks edit on a category → sidecard opens with hydrated form + PDF section visible → edits metadata OR uploads/downloads/deletes PDF → closes sidecard.
4. Admin clicks help icon next to PDF section → placeholder dialog opens showing custom + environment placeholders.

## Non-Goals

- **Submission filing / submitter view** — covered by `teamspace-submissions`.
- **Per-submission PDF rendering / email delivery** — backend concern, happens at submission time.
- **Field-definition edit dialog internals** — generic `AdminFieldEditorComponent` is shared across admin surfaces; its contract lives with the shared primitives, not here.
- **Placeholder dialog internals** — reuses the teamspace-side `SubmissionPdfPlaceholdersDialogComponent` verbatim.

## Edge Cases

- **PDF upload on a category with no fields** — help icon is hidden (nothing to show), but upload still works for environment-only templates.
- **Form dirty while input signal re-emits** — hydration effect skips to preserve user input; saving submits the dirty values.
- **Teamspace list not yet loaded** — teamspace badges show raw IDs as fallback until the teamspace map resolves, then re-derive.
- **Category without any assigned teamspace** — badge shows `administration.submissions.badges.allTeamspaces` ("Alle Teamspaces").

## Permissions & Tenant/Institution

- **Required roles:** global admin scope (`teamspace/admin/submission-categories` backend route — see contracts).
- **Institution context:** categories are cross-teamspace by design; teamspace scoping is a soft filter on the list, not an access check.
- **Backend access checks:** POST/PATCH/DELETE on `teamspace/admin/submission-categories/**` require admin-level tenant permission; frontend handles 401/403 via global interceptor + snackbar.

## Notifications (Push / In-App)

Not applicable — administration surface does not emit notifications. Submission events themselves are covered by `teamspace-submissions`.

## i18n Keys

> User-facing strings in German. Translation block lives in `apps/tagea-frontend/src/assets/i18n/de.json` under `administration.submissions.*`. Non-German locales fall back to the German block via Transloco (consistent with the rest of the administration surface).

- `administration.submissions.categoryList.*` — title, newCategory, empty, editCategory, deleteCategory
- `administration.submissions.categoryEditor.*` — newTitle, editTitle
- `administration.submissions.extras.*` — supervisor flags, notification emails, teamspace assignment
- `administration.submissions.badges.allTeamspaces`
- `administration.submissions.pdfTemplate.*` — sectionTitle, upload, uploadHint, download, delete, deleteConfirm, showPlaceholders, errors.upload, errors.delete
- `administration.submissions.errors.*` — create, update, delete, updateFields
- `administration.submissions.confirmDeleteCategory`, `confirmDeleteField`

## Offline Behavior

**Flutter port note:** Not applicable — this is a desktop-only admin surface (Flutter port is explicitly ❌, see parity.md).

## References

- **Angular list:** [`apps/tagea-frontend/src/app/pages/administration/daten/einreichungs-kategorien/admin-submission-categories.component.ts`](../../../apps/tagea-frontend/src/app/pages/administration/daten/einreichungs-kategorien/admin-submission-categories.component.ts)
- **Dialog:** [`admin-submission-category-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/administration/daten/einreichungs-kategorien/admin-submission-category-dialog.component.ts)
- **Generic editor:** [`admin-group-editor.component.ts`](../../../apps/tagea-frontend/src/app/pages/administration/shared/custom-fields/admin-group-editor.component.ts)
- **Placeholder dialog (reused):** [`submission-pdf-placeholders-dialog.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/components/submission-pdf-placeholders-dialog.component.ts)
- **Service:** [`SubmissionCategoriesService`](../../../apps/tagea-frontend/src/app/services/submission-categories.service.ts)
- **Model:** [`submission-category.model.ts`](../../../apps/tagea-frontend/src/app/models/submission-category.model.ts)
- **Backend entity:** [`custom-field-group.entity.ts`](../../../apps/tagea-backend/src/custom-fields/entities/custom-field-group.entity.ts)
- **Backend controller:** [`admin-submission-categories.controller.ts`](../../../apps/tagea-backend/src/submissions/controllers/admin-submission-categories.controller.ts)
- **E2E tests:** _(to be identified — no admin-side tests yet)_
- **Backend endpoints:** see [contracts.md](./contracts.md)

## Related specs

- [`teamspace-submissions`](../teamspace-submissions/spec.md) — submitter-side flow. Previously listed this admin surface under Non-Goals as `/teamspace/submissions/verwaltung`; the surface now lives under `/administration/daten/einreichungs-kategorien`.
