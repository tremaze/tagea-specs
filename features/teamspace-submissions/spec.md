# Feature: Teamspace Submissions

> **Status:** 🟡 Permission architecture complete; UI acceptance criteria still validating
> **Owner:** ltoenjes (UI), svenarbeit (permission architecture)
> **Last updated:** 2026-09-23 (list tabs, detail read-only view, endpoints — Flutter WP6)
>
> **Pattern reference:** This feature is the canonical permission-pattern example
> for the teamspace scope. The institution scope already follows the pattern
> consistently (see `cases.controller.ts`, `appointments.controller.ts`);
> submissions now matches it. Other teamspace features (events, news, articles, …)
> follow the same template — see Drift-Pins section below for the open work.
>
> **Permission-architecture status:**
> - ✅ Backend: every `/teamspaces/:tsId/submissions[-categories]/*` endpoint
>   carries explicit `@Auth({ scope: 'teamspace', permissions: [...] })` per the
>   table in this spec. Mutation endpoints, GET endpoints, and CSV/PDF/CF endpoints all gated.
> - ✅ Service: `findAll` consolidated onto `applyAccessControl` — tier filter
>   uses TS-permission-map (`view_all` / `view_scoped` / `view_own`) consistently.
> - ✅ Frontend: `hasHRManagePermission` (legacy stub) replaced with
>   `hasTeamspacePermission(tsId, view_all|view_scoped)` + TA bypass.
> - ✅ E2E: 13 submission-relevant specs covering create/list/tier/categories;
>   former `findAll` drift-pin (`drift-ts-admin-without-inst-hierarchy-…`)
>   converted to a soll-test (`ts-admin-via-permission-tier-sees-all-submissions`).
> - ⏳ Open: `AdminSubmissionCustomFieldsController` (`/institutions/:institutionId/submissions/custom-fields/*`)
>   marked for removal; clients no longer call it but controller still exists.
> - ⏳ Open: original UI Acceptance Criteria (Card-Click, Wizard, Deep-Link)
>   not yet covered by E2E tests — owned by UI team.

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

### Deep link new (`/teamspace/submissions/new/:teamspaceId/:categoryId`)

- [ ] **Given** a deep link carries a teamspace + category, **When** the route loads with `data.mode === 'deepLink'`, **Then** the creation form prefills that teamspace + category and skips the picker step.

### Deep link new (`/teamspace/submissions/new/:categoryId`)

- [ ] **Given** the deep link carries only a category, **When** the route loads, **Then** the user is prompted to pick a teamspace before the creation form proceeds.

### Detail (`/teamspace/submissions/:id`)

Loaded via the global routes `GET /submissions/:id` (with `_permissions`, `_visibility`) and `GET /submissions/:id/category` (field layout: `field_groups[]` + legacy `field_definitions[]`). Values come from the detail's `custom_fields_summary`; `GET …/custom-fields/v2` is not needed for the read-only view.

- [ ] **Given** a submission id is present, **When** the detail page loads with `data.mode === 'global'`, **Then** the submission's content, attachments, answer and status are shown (read-only for the submitter).
- [ ] Mobile order: header (status, subject „{Kategorie} - {dd.MM.yyyy, HH:mm}“, submitter, „Eingereicht:“, „Letzte Änderung:“, „Zugeteilt:“ if assigned) → „Zusätzliche Informationen“ → „PDF-Beleg“ → „Anhänge (n)“ → „Antwort vom Team“.
- [ ] Title: „Meine Anfrage“ when `_visibility === 'own'`, else „Anfrage einsehen“.
- [ ] Fields: active groups by `display_order`; flat groups as label/value rows; repeating groups (with `key` and rows in `summary[key].rows`) per row, plus „Summe {Feld}“ for `aggregation_config.kind === 'sum'`. Conditional fields (`ui_config.visibility_condition`) without a value are skipped. Values resolve per field type (choice labels, names, file name, Ja/Nein, `dd.MM.yyyy`, `ui_config.number_format`); rich text is shown as plain text — API HTML is untrusted and never rendered as markup in Flutter.
- [ ] **Answer:** there is **one** answer per submission (`response`, `responded_at`, `respondedByEmployee` columns on the submission — no reply thread). With an answer: „Beantwortet von {Name} am {Datum}“ + text. Without: „Deine Anfrage wird noch bearbeitet …“ (submitter) / „Diese Anfrage wird noch bearbeitet …“ (others).
- [ ] **Status history** („Status-Verlauf“, `status_history[]`) is shown to editors (`submissions.edit`, admin view) only — not to the submitter.
- [ ] **Files:** attachments open via `GET /submissions/:id/attachments/:aid/download?presigned=true` → `{url}` (15-minute presigned URL; without `presigned` the endpoint streams the file). The PDF receipt via `GET /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url?expiresIn=900` → `{url, expiresIn}`; shown when `generated_receipt_filename` is set or the category has a PDF template. Flutter accepts only http(s) URLs and opens them with the platform (url_launcher).
- [ ] Opening the detail marks it read (`content-read-status`, type `submission`).
- [ ] 404/403 → „Meldung nicht gefunden“ with „Zurück zur Übersicht“; other errors → error state with retry. **Flutter:** pull-to-refresh.

### Permission enforcement (backend)

- [ ] Every mutation endpoint (POST/PATCH/PUT/DELETE) under `/teamspaces/:tsId/submissions[-categories]/...` is annotated with `@Auth({ scope: 'teamspace', permissions: [...] })` — no class-level-only `scope:'authenticated'` for mutations.
- [ ] Every read endpoint that returns user-scoped data (submission lists, single submission, attachments, custom-field values) is annotated with at least `@Auth({ scope: 'teamspace', permissions: ['submissions.view_own'] })`. Service-side tier filter narrows further.
- [ ] Picker/form data (`GET .../submission-categories`, `.../submission-categories/:id`) is annotated with `@Auth({ scope: 'teamspace', permissions: ['submissions.create'] })`.
- [ ] `submissions.service.ts:findAll` filters via the teamspace-permission map (`view_all` / `view_scoped` / `view_own`), **not** via institution-hierarchy. Single source of truth: `applyAccessControl`.
- [ ] `AdminSubmissionCustomFieldsController` at `/institutions/:institutionId/submissions/custom-fields/...` is removed; clients use the per-TS category endpoints exclusively.
- [ ] Tenant-admin bypass works on every endpoint above (verified: removing all submission permissions from a role still lets a TA do everything).

### Permission enforcement (frontend)

- [ ] Every action button (Create, Edit, Delete, Status change, Assign, Configure, Verwaltung CTA) is gated with `*appHasPermission` or programmatic `hasTeamspacePermission(...)` — no `role === 'admin'` or `hasAdminRole()` checks on submission UI elements.
- [ ] Every submission route in `app/routes/` carries `permissionGuard` with the `data.requiredPermission` listed in the route table above; no implicit "logged-in is enough" routes.
- [ ] When a tenant-admin removes `submissions.view_all` from a role and the affected user reloads `/auth/context`, the "Verwaltung" surface stops appearing in their UI.

### Custom-Fields integration

- [ ] Categories are returned with `field_definitions` inline; consumers do not fetch a separate custom-fields endpoint.
- [ ] When admin edits a category's `field_definitions` via `PUT /teamspaces/:tsId/submission-categories/:id`, subsequent `POST /submissions` calls validate against the new definitions (no stale cache).
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

- **Submission-categories configuration** — handled under `/teamspace/submissions/konfiguration` (teamspace-admin surface, marked ❌ for Flutter).
- **Global admin management** — handled under `/administration/daten/einreichungs-kategorien` (admin-only, ❌ for Flutter). See [`admin-submission-categories`](../admin-submission-categories/spec.md).
- **Bulk actions** — not implemented.

## Edge Cases

- **Deep link with unknown category/teamspace** — form falls back to picker or shows a friendly error.
- **Category custom fields change between list and open** — the form uses the current `FieldGroup[]`; historical submissions are displayed with their stored values regardless.
- **Status transitions** — `SubmissionStatus` enum values live in the model; UI chips must mirror exactly (no implicit translations).

## Permissions & Tenant/Institution

### Architecture: Configuration vs. Consumption

Two distinct surfaces, each with its own permission family:

| Surface | What | Who | Permission |
|---|---|---|---|
| **Configuration** | Define categories, edit field definitions, upload PDF templates, configure CSV export | Teamspace-Admin (per-TS) and Tenant-Admin (cross-TS) | `settings.manage` (TS scope), `tenant.submission_categories.*` (Tenant scope) |
| **Consumption** | List categories, fill in form, submit, view own/scoped/all submissions | Teamspace members with `submissions.create` for the form, `submissions.view_*` tier for viewing | `submissions.create`, `submissions.view_own` / `submissions.view_scoped` / `submissions.view_all` |

The **same database table** (`custom_field_groups` with `entity_type='submission'`) is read by both surfaces — but through different endpoints with different permissions. Custom fields are inline-bundled with the category response (`field_definitions`), so consumers only need read access to the category, never to a separate custom-field endpoint.

### Backend endpoint → permission map

URL convention: `/teamspaces/:teamspaceId/...` for everything in the teamspace scope.

| Method + Path | Permission | Notes |
|---|---|---|
| `GET    /teamspaces/:tsId/submission-categories` | `submissions.create` | Picker data — anyone allowed to submit must be able to list categories |
| `GET    /teamspaces/:tsId/submission-categories/:id` | `submissions.create` | Form data — load the chosen category with its `field_definitions` |
| `GET    /teamspaces/:tsId/submission-categories/:id/csv-config` | `settings.manage` | Admin-only |
| `POST   /teamspaces/:tsId/submission-categories` | `settings.manage` | Create category |
| `PUT    /teamspaces/:tsId/submission-categories/:id` | `settings.manage` | Update category (incl. `field_definitions`) |
| `PUT    /teamspaces/:tsId/submission-categories/:id/csv-config` | `settings.manage` | CSV export config |
| `DELETE /teamspaces/:tsId/submission-categories/:id` | `settings.manage` | Delete category |
| `GET    /teamspaces/:tsId/submissions` | `submissions.view_own` (service-tier filter further limits) | List, tier-filtered server-side |
| `GET    /teamspaces/:tsId/submissions/stats` | `submissions.view_all` | Admin dashboard data |
| `GET    /teamspaces/:tsId/submissions/export/csv` | `submissions.view_all` | Admin export |
| `GET    /teamspaces/:tsId/submissions/:id` | `submissions.view_own` (+ tier check in service) | Detail |
| `GET    /teamspaces/:tsId/submissions/:id/assignable-employees` | `submissions.edit` | Picker for assignment dialog |
| `GET    /teamspaces/:tsId/submissions/:id/attachments/:aid/download` | `submissions.view_own` (+ tier) | File download |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf` | `submissions.view_own` (+ tier) | PDF receipt |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url` | `submissions.view_own` (+ tier) | Signed URL |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2` | `submissions.view_own` (+ tier) | Read custom-field values |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/history/:k` | `submissions.view_own` (+ tier) | DSGVO-trail |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/at-time` | `submissions.view_own` (+ tier) | Forensic snapshot |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | `submissions.view_own` (+ tier) | Repeating-group read |
| `POST   /teamspaces/:tsId/submissions` | `submissions.create` | Submit a new entry |
| `PATCH  /teamspaces/:tsId/submissions/:id/status` | `submissions.edit` | Status change (admin) |
| `PATCH  /teamspaces/:tsId/submissions/:id/assignment` | `submissions.edit` | Reassign |
| `POST   /teamspaces/:tsId/submissions/:id/response` | `submissions.edit` | Add response |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/bulk` | `submissions.edit` | Bulk-update CF values |
| `PATCH  /teamspaces/:tsId/submissions/:id/custom-fields/v2/:k` | `submissions.edit` | Single-field update |
| `POST   /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | `submissions.edit` | Repeating-group create |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | `submissions.edit` | Repeating-group update |
| `DELETE /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | `submissions.edit` | Repeating-group delete |

**Service-side tier filter** for `submissions.view_*`:
- `view_all`: sees every submission in the teamspace
- `view_scoped` + `institution_ids[]`: sees own + submissions whose submitter belongs to one of the scoped institutions
- `view_scoped` without scope: sees all in the teamspace
- `view_own`: sees only own submissions (+ institution-supervisor visibility for categories with `visible_to_institution_supervisors=true`)

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
| `teamspace-submissions-page` | "Neue Meldung" CTA | `hasAnyTeamspacePermission('submissions.create')` |
| `teamspace-submissions-page` | "Verwaltung" link/FAB | `hasAnyTeamspacePermissionOf(['submissions.view_all','submissions.view_scoped'])` |
| `teamspace-submissions-page` | „Mitarbeiter“ tab (mobile) / card (desktop) | `canInAnyInstitution('institution.submissions.view_institution_members')` |
| `submissions-page` (slug route) | "Meldung absenden" | `hasTeamspacePermission(tsId, 'submissions.create')` |
| `submissions-page` | "Verwaltung" button | `hasTeamspacePermission(tsId, 'submissions.view_all') ∨ ...view_scoped` |
| `submissions-verwaltung-page` | Status filter, search, sort | (page is gated already; controls visible) |
| `submissions-verwaltung-page` | "Konfiguration" button | `hasTeamspacePermission(tsId, 'settings.manage')` |
| `submission-categories-page` | Create/Edit/Delete category | `hasTeamspacePermission(tsId, 'settings.manage')` |
| `submission-detail-page` | "Antworten" / "Status ändern" / "Zuweisen" | `hasTeamspacePermission(tsId, 'submissions.edit')` |
| `global-submissions-verwaltung-page` | All admin actions | `isTenantAdmin ∨ specific tenant.submission_categories.*` |

### Routes

| Route | Guard(s) | `data.requiredPermission` |
|---|---|---|
| `/teamspace/submissions` | `permissionGuard` + `teamspaceFeatureGuard` | (any TS member with `submissions.create` OR a `view_*` permission) |
| `/teamspace/submissions/new/:tsId/:catId` | `permissionGuard` + `teamspaceFeatureGuard` | `submissions.create` (in the named TS) |
| `/teamspace/submissions/:id` | `permissionGuard` + `teamspaceFeatureGuard` | `submissions.view_own` (service tier filters further) |
| `/teamspace/submissions/verwaltung` | `permissionGuard` + `teamspaceFeatureGuard` | `submissions.view_all ∨ submissions.view_scoped` |
| `/teamspace/submissions/konfiguration` | `permissionGuard` + `teamspaceFeatureGuard` | `settings.manage` |
| `/administration/daten/einreichungs-kategorien` | `permissionGuard` (tenant scope) | `tenant.submission_categories.view` |

### Custom-Fields recycling (architectural note)

Submission categories are stored as `custom_field_groups` with `entity_type='submission'` — same table that holds custom-field groups for cases, clients, appointments, etc. **The recycling is at the database level**; on the API level, each consuming domain (cases, submissions, …) exposes its own endpoints with feature-specific permissions.

Specifically for submissions:
- Field definitions are returned **inline** with the category response (`field_definitions: SubmissionCategoryField[]`). No separate "fetch fields for category X" endpoint is needed for consumers.
- The legacy `AdminSubmissionCustomFieldsController` at `/institutions/:institutionId/submissions/custom-fields/...` is a structural artifact (institution-scoped controller for what is logically teamspace-scoped data). Marked for removal — its endpoints are not used by the current frontend; clients should not call it.

### Standard role defaults

| Role | Permissions in `default-teamspace-role-permissions.ts` |
|---|---|
| `admin` | `submissions.{create,edit,delete,view_all,view_own,view_scoped}`, `settings.manage` |
| `bearbeiter` | `submissions.{create,edit,view_own,view_scoped}` |
| `redakteur` | `submissions.{create,view_own}` |

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

## Open drifts (tracked in E2E specs as drift-pins)

These are deliberate "current IS" pins that flip from green to red once the matching backend fix lands; they are then rewritten to standard expected-pass tests.

| Drift | Spec file | Will flip when |
|---|---|---|
| `events.create` permission removal does not affect `POST /events` (no permission check at endpoint) | `apps/tagea-frontend-e2e/src/tests/teamspaces/drift-events-create-not-permission-checked.spec.ts` | Events controller gets `@Auth({ scope: 'teamspace', permissions: [...] })` (requires AuthGuard body-resolver) |
| `news.create` permission removal does not affect `POST /articles` | `apps/tagea-frontend-e2e/src/tests/teamspaces/drift-articles-create-not-permission-checked.spec.ts` | Articles controller gets `@Auth(...)` with article-type-resolver |
| TS-admin without inst-hierarchy ≥ 3 only sees own submissions in `findAll` (service uses inst-hierarchy not TS-permission-map) | `apps/tagea-frontend-e2e/src/tests/teamspaces/drift-ts-admin-without-inst-hierarchy-sees-only-own-submissions.spec.ts` | `submissions.service.ts:findAll` uses `applyAccessControl` consistently |

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Template:** [`teamspace-submissions-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.html)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **Services:** `SubmissionsService`, `SubmissionCategoriesService`, `TeamspaceService`
- **Models:** `Submission`, `SubmissionStatus`, `SubmissionCategory`, `FieldGroup`
- **Card:** `TageaSubmissionCardComponent`
- **Field renderer:** `TageaCustomFieldsComponent`
- **E2E tests:** `apps/tagea-frontend-e2e/src/tests/teamspaces/`
  - `traegermanager-removes-submissions-create-from-redakteur.spec.ts` — permission-editor wirkt durch
  - `bearbeiter-sees-only-own-submissions.spec.ts` — view_own tier
  - `admin-sees-all-submissions-via-view-all-tier.spec.ts` — TA bypass list
  - `non-member-cannot-create-submissions-in-teamspace.spec.ts` — 403 path
  - `traegeradmin-bypass-creates-submissions-without-membership.spec.ts` — TA bypass mutation
  - `submissions-disabled-blocks-create-403.spec.ts` — module-guard
  - `submissions-disabled-blocks-category-create-403.spec.ts` — module-guard categories
  - `drift-ts-admin-without-inst-hierarchy-sees-only-own-submissions.spec.ts` — drift pin (open)
- **Backend endpoints:** see [contracts.md](./contracts.md)
