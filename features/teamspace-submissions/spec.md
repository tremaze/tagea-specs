# Feature: Teamspace Submissions

> **Status:** 🟡 Permission architecture complete; UI acceptance criteria still validating
> **Owner:** ltoenjes (UI), svenarbeit (permission architecture)
> **Last updated:** 2026-09-25 (M2-Specs: permission map corrected to the Scope-A/Scope-B model — `tenant.submissions.submit` / `tenant.submissions.view_own` / `submissions.process`; create endpoint contract; deep links)
>
> **Pattern reference:** This feature is the canonical permission-pattern example
> for the teamspace scope. The institution scope already follows the pattern
> consistently (see `cases.controller.ts`, `appointments.controller.ts`);
> submissions now matches it. Other teamspace features (events, news, articles, …)
> follow the same template — see Drift-Pins section below for the open work.
>
> **Permission-architecture status:**
> - ✅ Backend: every `/teamspaces/:tsId/submissions[-categories]/*` endpoint
>   carries an explicit method-level `@Auth(...)` per the table in this spec —
>   `scope: 'tenant'` for the consumer capabilities (Scope A: `tenant.submissions.submit`,
>   `tenant.submissions.view_own`), `scope: 'teamspace'` for processing and
>   configuration (Scope B: `submissions.process`, `submissions.view_all`, `settings.manage`).
>   See [teamspace-consumer-access](../teamspace-consumer-access/spec.md) (migration
>   `20260504170000-RestructureSubmissionsPermissions`).
> - ✅ Service: `findAll` consolidated onto `applyAccessControl` — tier filter
>   uses TS-permission-map (`view_all` / `view_scoped` / `view_own`) consistently.
> - ✅ Frontend: `hasHRManagePermission` (legacy stub) replaced with
>   `canInAnyTeamspaceOf(['submissions.view_all','submissions.view_scoped'])` + super-admin bypass.
> - ✅ E2E: 13 submission-relevant specs covering create/list/tier/categories;
>   former `findAll` drift-pin (`drift-ts-admin-without-inst-hierarchy-…`)
>   converted to a soll-test (`ts-admin-via-permission-tier-sees-all-submissions`).
> - ⏳ Open: `AdminSubmissionCustomFieldsController` (`/institutions/:institutionId/submissions/custom-fields/*`)
>   marked for removal; clients no longer call it but controller still exists.
> - ⏳ Open: UI Acceptance Criteria Card-Click and Deep-Link not yet covered by
>   E2E tests (the wizard submit is covered by `submissions-consumer-submit-ui.spec.ts`) — owned by UI team.

## Vision (Elevator Pitch)

Staff-facing hub for creating and tracking submissions (e.g. incident reports, equipment requests) across teamspaces. List view with filter chips per teamspace + status, a create flow driven by dynamic category-defined custom fields, and a detail route for reviewing a single submission.

## User Stories

- As a **staff member** I want to submit a categorized report, so that the right handlers get it.
- As a **staff member** I want to see the status of my submissions, so that I know when something's resolved.
- As a **staff member** I want a deep-linked creation flow from a notification, so that I can act on a prompt quickly.

## Acceptance Criteria

### List (`/teamspace/submissions`)

**Mobile layout (< 600 px):** segmented tabs, in this order:

1. **„Neue Meldung“** — the create wizard (teamspace → category → form). Always visible.
2. **„Meine Meldungen“** — the user's own submissions (`GET /submissions/own`, newest first, all of them — the Angular page used to cap at 10).
3. **„Mitarbeiter“** („Meldungen meiner Mitarbeiter“) — `GET /submissions/supervised?limit&offset` (paged, infinite scroll). Shown only when the user holds `institution.submissions.view_institution_members` in any institution (`SessionAuthz.canInAnyInstitution`). These are submissions of employees of institutions the user supervises, in categories with `visible_to_institution_supervisors=true`, excluding the user's own. *(Open product question, Asana „WP6 Entscheidung: Wer sieht den Tab …“: whether `submissions.view_all` / `view_scoped` should also unlock this tab — those currently unlock the „Verwaltung“ surface, `GET /submissions/managed`.)*

Desktop keeps the two-column layout (wizard left, history right).

- [ ] **Given** the user opens the page, **When** the lists resolve, **Then** submissions render as cards with category, status, submitter (supervisor list only) and relative submission time.
- [ ] **Given** a search term, **When** it is typed, **Then** both lists filter client-side on category name and submitter name.
- [ ] **Given** status chips (`awaiting_approval`, `pending`, `in_review`, `closed`, `rejected`, plus „Alle“), **When** chips are selected, **Then** the lists filter on those statuses (multi-select; „Alle“ clears). *(Angular computes status groups but renders no chips; Flutter renders them — acceptance criterion of the port.)*
- [ ] **Given** two or more teamspaces with the submissions module, **When** teamspace chips are selected, **Then** the lists additionally filter on `teamspace_id` (multi-select; „Alle“ clears).
- [ ] **Given** filters leave no result, **Then** a „Keine Meldungen gefunden“ state with „Filter zurücksetzen“ is shown.
- [ ] **Given** a card is tapped, **When** navigation resolves, **Then** open `/teamspace/submissions/:id` (Angular appends `?teamspaceId=`; Flutter does not need it).
- [ ] **Given** a "New submission" CTA fires, **When** the user is on the list, **Then** they can pick a category and the creation form for that category renders (dynamic fields based on `FieldGroup[]`). *(Flutter: „Kommt bald“ until the create work package.)*
- [ ] **Flutter:** every list supports pull-to-refresh; a failed refresh keeps the shown items and says so.

### Create (submit)

Wizard: teamspace (only active teamspaces with the submissions module) → category (`GET /teamspaces/:tsId/submission-categories`) → form (`GET /teamspaces/:tsId/submission-categories/:id`, dynamic fields) → „Senden“. Contract: `POST /teamspaces/:teamspaceId/submissions` (multipart, see [contracts.md](./contracts.md#create-submission)).

- [ ] Submitting requires the tenant permission `tenant.submissions.submit` (floor permission of every standard tenant role) plus teamspace access (`@RequireTeamspaceAccess`: member, institution link or tenant-admin) and the teamspace module `submissions` being active; otherwise 403.
- [ ] Parts: `category_id` (required), `custom_field_values` (JSON string of the flat values; only fields the form currently shows — conditionally hidden fields are left out), `custom_field_repeating` (JSON string `Record<groupId, {created: [{tempId, fields}], updated: [], deleted: []}>`; always sent, `{}` when there are no rows — capability marker), `files` (0–5).
- [ ] **Files:** at most 5 per submission, at most 10 MB each; allowed types PDF, Word (`.doc`/`.docx`), Excel (`.xls`/`.xlsx`), JPEG, PNG, GIF, plain text, CSV. The client checks count, size, extension and MIME type before upload and shows „Maximale Anzahl von 5 Dateien erreicht“, „Datei ist zu groß. Maximum: 10 MB“ or „Ungültiger Dateityp. Erlaubt: PDF, Word, Excel, Bilder (JPG, PNG, GIF), Text“. Duplicate picks (same name + size) are ignored silently.
- [ ] „Senden“ is disabled while the form is invalid, while submitting, or when the category has `require_attachment` and no file is selected (the backend rejects that case with 400 too).
- [ ] Success → snackbar „Meldung erfolgreich gesendet“, success panel „Meldung erfolgreich gesendet!“ / „Deine Meldung wurde an {teamspace} gesendet.“, URL reset to `/teamspace/submissions`, own list reloaded. The new submission starts as `pending`, or `awaiting_approval` when the category has `requires_supervisor_approval` **and** `visible_to_institution_supervisors` and the submitter has at least one supervisor.
- [ ] Any failure (400 validation, 403, network) → snackbar „Fehler beim Senden der Meldung“; the form keeps its input.

### Deep link new (`/teamspace/submissions/new/:teamspaceId/:categoryId`)

Both params are UUIDs. `:teamspaceId` preselects the teamspace, `:categoryId` preselects the category; the wizard skips both picker steps and opens the form directly (loading state „Formular wird geladen...“).

- [ ] **Given** the teamspace exists, is active and has the submissions module, **and** the category exists in it and is active, **Then** the form for that category opens with the teamspace and category preselected.
- [ ] **Given** the teamspace is unknown, inactive or has no submissions module, **Then** snackbar „Der angegebene Teamspace wurde nicht gefunden.“ and redirect to `/teamspace/submissions` (history replaced).
- [ ] **Given** the category is unknown, **Then** „Die angegebene Meldungskategorie wurde nicht gefunden.“; **given** it is inactive, „Die angegebene Meldungskategorie ist nicht mehr aktiv.“ — both redirect to `/teamspace/submissions`.
- [ ] Any other load error → „Der Link ist ungültig.“ + redirect.
- [ ] After a successful submit or „Neue Meldung erstellen“ the URL is reset to `/teamspace/submissions`.

### Deep link new (`/teamspace/submissions/new/:categoryId?teamspaceId=…`)

Same page and behaviour as above, with the teamspace taken from the **query parameter** `teamspaceId`. There is no teamspace picker for this form: without `teamspaceId` the link is invalid → snackbar „Der Link ist ungültig.“ + redirect to `/teamspace/submissions`.

### List filter via query parameter

- [ ] `/teamspace/submissions?category=<categoryId>` preselects that category in the list filter (not the wizard).

### Detail (`/teamspace/submissions/:id`)

Loaded via the global routes `GET /submissions/:id` (with `_permissions`, `_visibility`) and `GET /submissions/:id/category` (field layout: `field_groups[]` + legacy `field_definitions[]`). Values come from the detail's `custom_fields_summary`; `GET …/custom-fields/v2` is not needed for the read-only view.

- [ ] **Given** a submission id is present, **When** the detail page loads with `data.mode === 'global'`, **Then** the submission's content, attachments, answer and status are shown (read-only for the submitter).
- [ ] Mobile order: header (status, subject „{Kategorie} - {dd.MM.yyyy, HH:mm}“, submitter, „Eingereicht:“, „Letzte Änderung:“, „Zugeteilt:“ if assigned) → „Zusätzliche Informationen“ → „PDF-Beleg“ → „Anhänge (n)“ → „Antwort vom Team“.
- [ ] Title: „Meine Anfrage“ when `_visibility === 'own'`, else „Anfrage einsehen“.
- [ ] Fields: active groups by `display_order`; flat groups as label/value rows; repeating groups (with `key` and rows in `summary[key].rows`) per row, plus „Summe {Feld}“ for `aggregation_config.kind === 'sum'`. Conditional fields (`ui_config.visibility_condition`) without a value are skipped. Values resolve per field type (choice labels, names, file name, Ja/Nein, `dd.MM.yyyy`, `ui_config.number_format`); rich text is shown as plain text — API HTML is untrusted and never rendered as markup in Flutter.
- [ ] **Answer:** there is **one** answer per submission (`response`, `responded_at`, `respondedByEmployee` columns on the submission — no reply thread). With an answer: „Beantwortet von {Name} am {Datum}“ + text. Without: „Deine Anfrage wird noch bearbeitet …“ (submitter) / „Diese Anfrage wird noch bearbeitet …“ (others).
- [ ] **Status history** („Status-Verlauf“, `status_history[]`) is shown to processors (`submissions.process`, admin view) only — not to the submitter.
- [ ] **Files:** attachments open via `GET /submissions/:id/attachments/:aid/download?presigned=true` → `{url}` (15-minute presigned URL; without `presigned` the endpoint streams the file). The PDF receipt via `GET /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url?expiresIn=900` → `{url, expiresIn}`; shown when `generated_receipt_filename` is set or the category has a PDF template. Flutter accepts only http(s) URLs and opens them with the platform (url_launcher).
- [ ] Opening the detail marks it read (`content-read-status`, type `submission`).
- [ ] 404/403 → „Meldung nicht gefunden“ with „Zurück zur Übersicht“; other errors → error state with retry. **Flutter:** pull-to-refresh, also on these two states.
- [ ] A 404/403 on `GET /submissions/:id/category` (category deleted or not visible) does not hide the submission: header, files and answer show, the fields section is omitted.

### Permission enforcement (backend)

- [ ] Every endpoint under `/teamspaces/:tsId/submissions[-categories]/...` carries a method-level `@Auth(...)`; the class-level `@Auth({ scope: 'authenticated' })` alone never grants access. Both controllers also apply `FeatureGuard` (`@RequireFeature('submissions')`) and `TeamspaceAccessGuard` (`@RequireTeamspaceAccess()`).
- [ ] Consumer reads (submission list, single submission, attachments, filled PDF, custom-field values/history/at-time, repeating rows) require the tenant permission `tenant.submissions.view_own`. The service tier filter (`applyAccessControl`) narrows further.
- [ ] Picker/form data (`GET .../submission-categories`, `.../submission-categories/:id`) and `POST .../submissions` require `tenant.submissions.submit`; the POST additionally requires the teamspace module (`@RequireTeamspaceModule('submissions')`).
- [ ] Processing (status, assignment, response, assignable employees, custom-field writes, repeating-row writes) requires the teamspace permission `submissions.process` (renamed from `submissions.edit`).
- [ ] `submissions.service.ts:findAll` filters via the teamspace-permission map (`view_all` / `view_scoped` / own), **not** via institution-hierarchy. Single source of truth: `applyAccessControl`.
- [ ] `AdminSubmissionCustomFieldsController` at `/institutions/:institutionId/submissions/custom-fields/...` is removed; clients use the per-TS category endpoints exclusively.
- [ ] Tenant-admin bypass works on every endpoint above (verified: removing all submission permissions from a role still lets a TA do everything).

### Permission enforcement (frontend)

- [ ] Every processing action (Edit, Status change, Assign, Configure, Verwaltung CTA) is gated with `*appHasPermission` or programmatic `sessionAuthz` checks — no `role === 'admin'` or `hasAdminRole()` checks on submission UI elements. Supervisor actions (approve, acknowledge) follow the server-authoritative `_permissions` of the detail response.
- [ ] Submission routes are gated by `requireTenantPermission('tenant.teamspace_submissions.view')` + `requireFeature('teamspace')` (see Routes); the Verwaltung route by `requireAnyPermission(['submissions.view_all','submissions.view_scoped'])`.
- [ ] When a tenant-admin removes `submissions.view_all` from a role and the affected user reloads `/auth/context`, the "Verwaltung" surface stops appearing in their UI.

### Custom-Fields integration

- [ ] Categories are returned with `field_definitions` inline; consumers do not fetch a separate custom-fields endpoint.
- [ ] When admin edits a category's `field_definitions` via `PUT /teamspaces/:tsId/submission-categories/:id`, subsequent `POST /teamspaces/:tsId/submissions` calls validate against the new definitions (no stale cache).
- [ ] Historical submissions retain their original `custom_field_values` even when the category schema later changes (schema migration responsibility, not field-rendering responsibility).

## UI States

| State           | When?                | What does the user see?            | A11y notes      |
| --------------- | -------------------- | ---------------------------------- | --------------- |
| Loading         | Initial fetch        | Spinner                            | `role="status"` |
| Empty           | No submissions yet   | Empty state + "New submission" CTA | —               |
| Populated       | Cards rendered       | Chips + cards + "New" CTA          | —               |
| Creating (form) | In the category form | Dynamic field group + submit       | —               |
| Submitting      | Submit in-flight     | Button disabled + spinner          | `aria-busy`     |
| Error           | Fetch/submit failure | Error banner + retry               | `role="alert"`  |

## Non-Goals

- **Submission-categories configuration** — `/teamspace/submissions/konfiguration` redirects to `/administration/daten/einreichungs-kategorien` (admin surface, ❌ for Flutter).
- **Global admin management** — handled under `/administration/daten/einreichungs-kategorien` (admin-only, ❌ for Flutter). See [`admin-submission-categories`](../admin-submission-categories/spec.md).
- **Bulk actions** — not implemented.

## Edge Cases

- **Deep link with unknown/inactive category or teamspace** — snackbar with the specific reason, then redirect to `/teamspace/submissions` (no picker fallback).
- **Category custom fields change between list and open** — the form uses the current `FieldGroup[]`; historical submissions are displayed with their stored values regardless.
- **Status transitions** — `SubmissionStatus` enum values live in the model; UI chips must mirror exactly (no implicit translations).

## Permissions & Tenant/Institution

### Architecture: Configuration vs. Consumption

Two distinct surfaces, each with its own permission family:

| Surface | What | Who | Permission |
|---|---|---|---|
| **Configuration** | Define categories, edit field definitions, upload PDF templates, configure CSV export | Teamspace-Admin (per-TS) and Tenant-Admin (cross-TS) | `settings.manage` (TS scope), `tenant.submission_categories.*` (Tenant scope) |
| **Consumption (Scope A)** | List categories, fill in form, submit, view own submissions | Every employee with teamspace access (tenant floor permissions) | `tenant.submissions.submit`, `tenant.submissions.view_own` |
| **Processing (Scope B)** | View scoped/all submissions, change status, assign, answer, edit field values | Teamspace roles (`admin`, `bearbeiter`) | `submissions.view_all` / `submissions.view_scoped`, `submissions.process` |

The **same database table** (`custom_field_groups` with `entity_type='submission'`) is read by both surfaces — but through different endpoints with different permissions. Custom fields are inline-bundled with the category response (`field_definitions`), so consumers only need read access to the category, never to a separate custom-field endpoint.

### Backend endpoint → permission map

URL convention: `/teamspaces/:teamspaceId/...` for everything in the teamspace scope.

Scope column: **T** = `@Auth({ scope: 'tenant', … })` (tenant permission), **TS** = `@Auth({ scope: 'teamspace', … })` (permission in that teamspace).

| Method + Path | Permission | Notes |
|---|---|---|
| `GET    /teamspaces/:tsId/submission-categories` | T `tenant.submissions.submit` | Picker data |
| `GET    /teamspaces/:tsId/submission-categories/:id` | T `tenant.submissions.submit` | Form data — the chosen category with its `field_definitions` |
| `GET    /teamspaces/:tsId/submission-categories/:id/csv-config` | TS `settings.manage` | Admin-only |
| `POST   /teamspaces/:tsId/submission-categories` | TS `settings.manage` | Create category |
| `PUT    /teamspaces/:tsId/submission-categories/:id` | TS `settings.manage` | Update category (incl. `field_definitions`) |
| `PUT    /teamspaces/:tsId/submission-categories/:id/csv-config` | TS `settings.manage` | CSV export config |
| `DELETE /teamspaces/:tsId/submission-categories/:id` | TS `settings.manage` | Delete category |
| `POST   /teamspaces/:tsId/submissions` | T `tenant.submissions.submit` + module `submissions` | Submit a new entry (multipart) |
| `GET    /teamspaces/:tsId/submissions` | T `tenant.submissions.view_own` (service tier filter limits further) | List |
| `GET    /teamspaces/:tsId/submissions/stats` | TS `submissions.view_all` | Admin dashboard data |
| `GET    /teamspaces/:tsId/submissions/export/csv` | TS `submissions.view_all` | Admin export |
| `GET    /teamspaces/:tsId/submissions/:id` | T `tenant.submissions.view_own` (+ tier check in service) | Detail |
| `GET    /teamspaces/:tsId/submissions/:id/assignable-employees` | TS `submissions.process` | Picker for assignment dialog |
| `GET    /teamspaces/:tsId/submissions/:id/attachments/:aid/download` | T `tenant.submissions.view_own` (+ tier) | File download |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf` | T `tenant.submissions.view_own` (+ tier) | PDF receipt |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url` | T `tenant.submissions.view_own` (+ tier) | Signed URL |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2` | T `tenant.submissions.view_own` (+ tier) | Read custom-field values |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/history/:k` | T `tenant.submissions.view_own` (+ tier) | DSGVO-trail |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/at-time` | T `tenant.submissions.view_own` (+ tier) | Forensic snapshot |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | T `tenant.submissions.view_own` (+ tier) | Repeating-group read |
| `PATCH  /teamspaces/:tsId/submissions/:id/status` | TS `submissions.process` | Status change |
| `PATCH  /teamspaces/:tsId/submissions/:id/assignment` | TS `submissions.process` | Reassign |
| `POST   /teamspaces/:tsId/submissions/:id/response` | TS `submissions.process` | Add response |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/bulk` | TS `submissions.process` | Bulk-update CF values |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/save-all` | TS `submissions.process` | Save flat + repeating values in one call |
| `PATCH  /teamspaces/:tsId/submissions/:id/custom-fields/v2/:k` | TS `submissions.process` | Single-field update |
| `POST   /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | TS `submissions.process` | Repeating-group create |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | TS `submissions.process` | Repeating-group update |
| `DELETE /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | TS `submissions.process` | Repeating-group delete |

The global routes under `/submissions/*` (`own`, `supervised`, `managed`, `:id`, `:id/category`, `:id/attachments/:aid/download`, acknowledge/approve/reject) are class-level `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` + `@RequireFeature('submissions')`; visibility is decided per item by the scope queries and `SubmissionAbility`.

**Service-side tier filter** for `submissions.view_*`:
- `view_all`: sees every submission in the teamspace
- `view_scoped` + `institution_ids[]`: sees own + submissions whose submitter belongs to one of the scoped institutions
- `view_scoped` without scope: sees all in the teamspace
- none of the above (only `tenant.submissions.view_own`): sees only own submissions (+ institution-supervisor visibility for categories with `visible_to_institution_supervisors=true`)

### Cross-TS Tenant-Admin path

For tenant-wide operations (managing categories across many teamspaces, reordering, archiving):

| Method + Path | Permission |
|---|---|
| `GET   /teamspace/admin/submission-categories` | `tenant.submission_categories.view` |
| `GET   /teamspace/admin/submission-categories/all-including-archived` | `tenant.submission_categories.view` |
| `POST  /teamspace/admin/submission-categories` | `tenant.submission_categories.create` |
| `PATCH /teamspace/admin/submission-categories/:id` | `tenant.submission_categories.edit` |
| `DELETE /teamspace/admin/submission-categories/:id` | `tenant.submission_categories.delete` |
| `POST  /teamspace/admin/submission-categories/:id/pdf-template` | `tenant.submission_categories.edit` |
| `GET   /teamspace/admin/submission-categories/:id/pdf-template` | `tenant.submission_categories.view` |
| `DELETE /teamspace/admin/submission-categories/:id/pdf-template` | `tenant.submission_categories.edit` |
| `PATCH /teamspace/admin/submission-categories/reorder` | `tenant.submission_categories.edit` |

Tenant-admin path complements the per-TS path; both write to the same DB table. Tenant-admins also bypass the per-TS path via `isTenantAdmin` shortcut in `permission-resolver.service.ts`.

### Frontend UI action → permission map

| UI Surface | Action / Element | Permission gate |
|---|---|---|
| `teamspace-submissions-page` | „Neue Meldung“ wizard | not gated in the UI beyond the route guard; the backend enforces `tenant.submissions.submit` (category list and POST return 403 without it) |
| `teamspace-submissions-page` | "Verwaltung" link/FAB | `sessionAuthz.isSuperAdmin() ∨ canInAnyTeamspaceOf(['submissions.view_all','submissions.view_scoped'])` |
| `teamspace-submissions-page` | „Mitarbeiter“ tab (mobile) / card (desktop) | `canInAnyInstitution('institution.submissions.view_institution_members')` |
| `global-submissions-verwaltung-page` | Status filter, search, sort, Kanban | (page is gated already; controls visible) |
| `submission-detail-page` | "Antworten" / "Status ändern" / "Zuweisen" / field edit | admin view mode (processor, `submissions.process` in the submission's teamspace) |
| `submission-detail-page` | „Genehmigen“ / „Ablehnen“ / acknowledge | server-authoritative `_permissions.approve` / `_permissions.acknowledge` |
| `admin-submission-categories` | Create/Edit/Delete category | `tenant.submission_categories.*` |

> `pages/teamspace/submissions-page.component.ts` (old slug route) is no longer routed.

### Routes

| Route | Guard(s) | Permission |
|---|---|---|
| `/teamspace/submissions` (incl. children below) | `requireTenantPermission` + `requireFeature('teamspace')` | `tenant.teamspace_submissions.view` |
| `/teamspace/submissions/new/:teamspaceId/:categoryId` | inherited | inherited (`data.mode = 'deepLink'`) |
| `/teamspace/submissions/new/:categoryId` (+ `?teamspaceId=`) | inherited | inherited (`data.mode = 'deepLink'`) |
| `/teamspace/submissions/:id` | inherited | inherited (`data.mode = 'global'`); backend decides visibility |
| `/teamspace/submissions/verwaltung` | `requireAnyPermission` + `requireFeature('teamspace')` | `submissions.view_all ∨ submissions.view_scoped` |
| `/teamspace/submissions/konfiguration` | — | redirect to `/administration/daten/einreichungs-kategorien` |
| `/administration/daten/einreichungs-kategorien` | `requireFeature('teamspace')` + `requireTenantPermission` | `tenant.submission_categories.view` |

### Custom-Fields recycling (architectural note)

Submission categories are stored as `custom_field_groups` with `entity_type='submission'` — same table that holds custom-field groups for cases, clients, appointments, etc. **The recycling is at the database level**; on the API level, each consuming domain (cases, submissions, …) exposes its own endpoints with feature-specific permissions.

Specifically for submissions:
- Field definitions are returned **inline** with the category response (`field_definitions: SubmissionCategoryField[]`). No separate "fetch fields for category X" endpoint is needed for consumers.
- The legacy `AdminSubmissionCustomFieldsController` at `/institutions/:institutionId/submissions/custom-fields/...` is a structural artifact (institution-scoped controller for what is logically teamspace-scoped data). Marked for removal — its endpoints are not used by the current frontend; clients should not call it.

### Standard role defaults

| Role | Permissions in `default-teamspace-role-permissions.ts` |
|---|---|
| `admin` | `submissions.{delete,process,view_all,view_scoped}`, `settings.manage` |
| `bearbeiter` | `submissions.{process,view_scoped}` |
| `redakteur` | — (no submission permissions) |

`tenant.submissions.submit` and `tenant.submissions.view_own` are **not** teamspace-role permissions: they are mapped to the standard tenant roles (`mitarbeiter`, `personalverwalter`, `traeger_manager`) by the migration and can be revoked per tenant role in the role matrix.

These are seed defaults; tenants can override via the permission editor at `/einstellungen/teamspaces/rollen-rechte`.

## Notifications (Push / In-App)

- Status-change notifications deep-link to the detail route.
- Submissions influence the teamspace-home badge via `TeamspaceUnreadCountService`.

## i18n Keys

> User-facing strings remain in German. Owned by the external template and category metadata.

## Offline Behavior

**Flutter-specific:**

- List view cached offline. *(Flutter WP6: not yet — lists and detail show the error state with retry when offline and keep already loaded data on a failed refresh; an offline cache follows with the app-wide caching work.)*
- Creating a submission requires online; large attachments queue on reconnect (or block — decide during port).

## Resolved drifts (former E2E drift-pins)

All three former drift-pins are fixed; their spec files were replaced by regular tests.

| Former drift | Now covered by |
|---|---|
| `events.create` permission removal did not affect `POST /events` | `apps/tagea-frontend-e2e/src/tests/teamspaces/events/events-permission-matrix.spec.ts` |
| `news.create` permission removal did not affect `POST /articles` | `apps/tagea-frontend-e2e/src/tests/teamspaces/articles/articles-permission-matrix.spec.ts` |
| TS-admin without inst-hierarchy ≥ 3 only saw own submissions in `findAll` | `apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/ts-admin-via-permission-tier-sees-all-submissions.spec.ts` |

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Template:** [`teamspace-submissions-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.html)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **Services:** `SubmissionsService`, `SubmissionCategoriesService`, `TeamspaceService`
- **Models:** `Submission`, `SubmissionStatus`, `SubmissionCategory`, `FieldGroup`
- **Card:** `TageaSubmissionCardComponent`
- **Field renderer:** `TageaCustomFieldsComponent`
- **E2E tests:** `apps/tagea-frontend-e2e/src/tests/teamspaces/submissions/`
  - `submissions-consumer-submit-ui.spec.ts` — submit via the real UI and persist
  - `submissions-create-eav.spec.ts` — create contract (values → EAV)
  - `bearbeiter-sees-only-own-submissions.spec.ts` — own-only floor via `tenant.submissions.view_own`
  - `admin-sees-all-submissions-via-view-all-tier.spec.ts` — `view_all` tier
  - `ts-admin-via-permission-tier-sees-all-submissions.spec.ts` — tier via TS permission map
  - `non-member-cannot-create-submissions-in-teamspace.spec.ts` — teamspace-access 403 path
  - `outsider-cannot-list-submission-categories.spec.ts` — picker 403 path
  - `submissions-disabled-blocks-create-403.spec.ts` — module guard
  - `submissions-disabled-blocks-category-create-403.spec.ts` — module guard categories
- **Backend endpoints:** see [contracts.md](./contracts.md)
