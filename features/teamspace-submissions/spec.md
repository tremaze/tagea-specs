# Feature: Teamspace Submissions

> **Status:** 🚧 Permission architecture complete; first pilot for the entity-permissions cross-cutting pattern in progress
> **Owner:** ltoenjes (UI), svenarbeit (permission architecture, entity-permissions pilot)
> **Last updated:** 2026-05-16
>
> **Pattern reference:** This feature is the canonical permission-pattern example
> for the teamspace scope. The institution scope already follows the pattern
> consistently (see `cases.controller.ts`, `appointments.controller.ts`);
> submissions now matches it. Other teamspace features (events, news, articles, …)
> follow the same template — see Drift-Pins section below for the open work.
>
> **Cross-cutting pattern:** Submissions is the **first pilot** for the cross-cutting
> [entity-permissions](../../cross-cutting/entity-permissions/spec.md) pattern.
> The pilot stress-tests both pattern additions made 2026-05-16: `_visibility`
> origin discriminator on detail responses, and the collection-scoping convention
> (split scoped-list endpoints; URL is scope authority; collection items carry
> no meta-fields). The Submissions-specific action vocabulary, visibility values,
> and scoped-list endpoints live in [contracts.md](./contracts.md).
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
> - 🚧 In progress (2026-05-16): entity-permissions pilot adoption — `SubmissionAbility`,
>   `_visibility` + `_permissions` on detail, split scoped-list endpoints
>   (`/submissions/{managed,supervised,own}` replace legacy `/submissions`),
>   removal of the `?mode=admin` query-param heuristic in
>   `submission-detail-page.component.ts`, removal of the `?visibility=…`
>   query-param shortcut in the frontend service.

## Vision (Elevator Pitch)

Staff-facing hub for creating and tracking submissions (e.g. incident reports, equipment requests) across teamspaces. List view with filter chips per teamspace + status, a create flow driven by dynamic category-defined custom fields, and a detail route for reviewing a single submission.

## User Stories

- As a **staff member** I want to submit a categorized report, so that the right handlers get it.
- As a **staff member** I want to see the status of my submissions, so that I know when something's resolved.
- As a **staff member** I want a deep-linked creation flow from a notification, so that I can act on a prompt quickly.

## Acceptance Criteria

### List (`/teamspace/submissions`)

- [ ] **Given** the user opens the page, **When** `SubmissionsService` + `SubmissionCategoriesService` + `TeamspaceService` resolve, **Then** submissions render as `TageaSubmissionCardComponent` cards with status, category, submitter, and timestamp.
- [ ] **Given** multiple teamspaces are accessible, **When** filter chips render, **Then** one chip per teamspace is shown; an active filter scopes the list.
- [ ] **Given** status chips render, **When** a status chip is selected (e.g. `awaiting_approval`, `pending`, `in_review`, `closed`, `rejected`), **Then** the list additionally filters on `SubmissionStatus`.
- [ ] **Given** a card is tapped, **When** navigation resolves, **Then** open `/teamspace/submissions/:id`.
- [ ] **Given** a "New submission" CTA fires, **When** the user is on the list, **Then** they can pick a category and the creation form for that category renders (dynamic fields based on `FieldGroup[]`).

### Deep link new (`/teamspace/submissions/new/:teamspaceId/:categoryId`)

- [ ] **Given** a deep link carries a teamspace + category, **When** the route loads with `data.mode === 'deepLink'`, **Then** the creation form prefills that teamspace + category and skips the picker step.

### Deep link new (`/teamspace/submissions/new/:categoryId`)

- [ ] **Given** the deep link carries only a category, **When** the route loads, **Then** the user is prompted to pick a teamspace before the creation form proceeds.

### Detail (`/teamspace/submissions/:id`)

- [ ] **Given** a submission id is present, **When** the detail page loads with `data.mode === 'global'`, **Then** the submission's content, attachments, history, and status are shown (read-only for the submitter).

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

### Entity-permissions pilot — detail endpoints

> Adopts [`cross-cutting/entity-permissions`](../../cross-cutting/entity-permissions/spec.md). Vocabulary in [contracts.md](./contracts.md).

- [ ] **Given** a user fetches `GET /teamspaces/:tsId/submissions/:id` or `GET /submissions/:id` **When** they have read access **Then** the response carries `_permissions` (all declared submission actions) and `_visibility` (one of `own | teamspace_member | institution_supervisor | tenant_admin`). The Submissions pilot does NOT serialize `_fieldPermissions` — there is currently no per-field mutation rule (terminal-state field freezing is out of scope for this pilot).
- [ ] **Given** a user holds the institution-supervisor permission for a submission category that opts into supervisor visibility **When** they fetch the submission **Then** `_visibility === 'institution_supervisor'` and `_permissions.changeStatus === false` (read-only supervisor view).
- [ ] **Given** a user is a teamspace-admin in the submission's teamspace **When** they fetch the submission **Then** `_visibility === 'teamspace_member'` and `_permissions.changeStatus === true` (subject to terminal-state rules).
- [ ] **Given** a user owns the submission **When** they fetch it **Then** `_visibility === 'own'` (regardless of other origins — `own` has highest precedence in the per-entity visibility resolution).
- [ ] **Given** a user is tenant-admin or super-admin without any of the above origins **When** they fetch the submission **Then** `_visibility === 'tenant_admin'`.
- [ ] **Given** `_permissions.changeStatus === false` **When** the client calls `PATCH /teamspaces/:tsId/submissions/:id/status` **Then** the backend rejects with `403 Forbidden` (symmetry with the response hint).
- [ ] **Given** the detail page (`/teamspace/submissions/:id`) loads with arbitrary query-params **When** the user opens it **Then** the view mode is derived from `_visibility` exclusively; `?mode=admin` and `?mode=supervisor` query-params are removed from the codebase and ignored if present.

### Entity-permissions pilot — scoped-list endpoints

> Implements the [collection-scoping convention](../../cross-cutting/entity-permissions/spec.md#collection-scoping-convention).

- [ ] **Given** the backend is migrated **When** a client calls `GET /submissions` (legacy default-OR) or `GET /submissions?visibility=institution_supervisor` (legacy shortcut) **Then** the endpoint returns `404 Not Found` — both are deleted in the same change.
- [ ] **Given** a user calls `GET /submissions/managed` **When** they have `tenant.submissions.view_all` or `tenant.submissions.view_scoped` in at least one teamspace (or are tenant-admin) **Then** they receive submissions in those teamspaces — inclusive of items they also own (their own request in a teamspace where they are admin appears here, with detail-`_visibility: 'own'` on click). Institution-supervisor-only items (no other origin qualifying) are NOT in the response. List items contain NO `_permissions` / `_visibility` (Invariant 5 strict). (Inclusion semantics: see [Per-scope inclusion semantics](../../cross-cutting/entity-permissions/spec.md#per-scope-inclusion-semantics).)
- [ ] **Given** a user calls `GET /submissions/managed` **When** they have none of the required permissions **Then** the backend returns `403 Forbidden`.
- [ ] **Given** a user calls `GET /submissions/supervised` **When** they hold `institution.submissions.view_institution_members` in at least one institution **Then** they receive ONLY submissions whose detail-response would have `_visibility === 'institution_supervisor'` (exclusive scope — own / managed items are NOT in the response, even if also supervisor-visible). List items contain NO meta-fields.
- [ ] **Given** a user calls `GET /submissions/own` **When** authenticated **Then** they receive submissions where they are the submitter (matches `_visibility === 'own'` on detail; inclusive of items that would also appear in `/managed`). List items contain NO meta-fields.
- [ ] **Given** an item appears in `GET /submissions/managed` **When** the same item is opened via `GET /submissions/:id` **Then** detail-`_visibility` is `'own'`, `'teamspace_member'`, or `'tenant_admin'` — never `'institution_supervisor'` (inclusive-scope consistency).
- [ ] **Given** the global Verwaltungsseite (`/teamspace/submissions/verwaltung`) **When** it loads **Then** it calls `GET /submissions/managed` (NOT `GET /submissions` with client-side filter). No items beyond the user's manage-scope ever cross the wire.
- [ ] **Given** the supervisor section in `/teamspace/:slug/submissions` and the sidebar badge in secure-main **When** they load **Then** they call `GET /submissions/supervised`. The old `getAllSubmissions({ visibility: 'institution_supervisor' })` shape is migrated to the new URL.

### Entity-permissions pilot — teamspace-scoped collections

> The pre-existing per-teamspace list (`GET /teamspaces/:tsId/submissions`) stays as it is in URL — its scope is the teamspace itself. List items still carry no meta-fields per Invariant 5.

- [ ] **Given** a user calls `GET /teamspaces/:tsId/submissions` **When** they are a member of that teamspace with at least one `submissions.view_*` permission **Then** the service returns submissions visible to them within that teamspace (own + tier-filtered by the `applyAccessControl` permission map), and items contain NO `_permissions` / `_visibility` (Invariant 5 strict).
- [ ] **Given** the per-teamspace list endpoint **When** a user has only institution-supervisor visibility into the teamspace (no teamspace membership) **Then** the per-teamspace list does NOT return institution-supervisor-only items — those live on `GET /submissions/supervised` instead. (Cross-teamspace supervisor visibility is not a per-teamspace concept.)

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
| `GET    /teamspaces/:tsId/submissions/:id/assignable-employees` | `submissions.process` | Picker for assignment dialog |
| `GET    /teamspaces/:tsId/submissions/:id/attachments/:aid/download` | `submissions.view_own` (+ tier) | File download |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf` | `submissions.view_own` (+ tier) | PDF receipt |
| `GET    /teamspaces/:tsId/submissions/:id/filled-pdf/signed-url` | `submissions.view_own` (+ tier) | Signed URL |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2` | `submissions.view_own` (+ tier) | Read custom-field values |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/history/:k` | `submissions.view_own` (+ tier) | DSGVO-trail |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/at-time` | `submissions.view_own` (+ tier) | Forensic snapshot |
| `GET    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | `submissions.view_own` (+ tier) | Repeating-group read |
| `POST   /teamspaces/:tsId/submissions` | `submissions.create` | Submit a new entry |
| `PATCH  /teamspaces/:tsId/submissions/:id/status` | `submissions.process` | Status change (admin) |
| `PATCH  /teamspaces/:tsId/submissions/:id/assignment` | `submissions.process` | Reassign |
| `POST   /teamspaces/:tsId/submissions/:id/response` | `submissions.process` | Add response |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/bulk` | `submissions.process` | Bulk-update CF values |
| `PATCH  /teamspaces/:tsId/submissions/:id/custom-fields/v2/:k` | `submissions.process` | Single-field update |
| `POST   /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows` | `submissions.process` | Repeating-group create |
| `PUT    /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | `submissions.process` | Repeating-group update |
| `DELETE /teamspaces/:tsId/submissions/:id/custom-fields/v2/groups/:gid/rows/:rowId` | `submissions.process` | Repeating-group delete |

**Service-side tier filter** for `submissions.view_*` (per-teamspace endpoint):
- `view_all`: sees every submission in the teamspace
- `view_scoped` + `institution_ids[]`: sees own + submissions whose submitter belongs to one of the scoped institutions
- `view_scoped` without scope: sees all in the teamspace
- `view_own`: sees only own submissions

Per-teamspace endpoint does NOT add institution-supervisor visibility — that path lives on the global scoped-list endpoints (see below).

### Global (tenant-wide) scoped-list endpoints

> Implements the [collection-scoping convention](../../cross-cutting/entity-permissions/spec.md#collection-scoping-convention). Replaces the pre-existing default-OR `GET /submissions` and `?visibility=institution_supervisor` query-param shortcut, both of which are deleted in the same change.

| Method + Path | Permission | Returns submissions whose detail-`_visibility` would be |
|---|---|---|
| `GET /submissions/managed` | any of `tenant.submissions.view_all`, `tenant.submissions.view_scoped` in at least one teamspace (or tenant-admin) | `teamspace_member` (or `tenant_admin` via bypass) |
| `GET /submissions/supervised` | `institution.submissions.view_institution_members` in at least one institution | `institution_supervisor` |
| `GET /submissions/own` | authenticated (any employee) | `own` |
| `GET /submissions/:id` | union of the above (Ability resolves which `_visibility` applies) | computed per-request; carries `_permissions` + `_visibility` |
| `PATCH /submissions/:id/status` | enforced via `_permissions.changeStatus` on the detail response | — |
| `PATCH /submissions/:id/assignment` | enforced via `_permissions.assign` | — |
| `POST /submissions/:id/response` | enforced via `_permissions.respond` | — |
| `DELETE /submissions/:id` | enforced via `_permissions.delete` | — |

Detail and mutation endpoints under `/teamspaces/:tsId/submissions/:id` (already exist) continue to work in parallel — same Ability service, same `_visibility` result. The global `/submissions/:id` detail endpoint is added so the scoped lists have a tenant-wide detail companion.

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
| `submissions-page` (slug route) | "Meldung absenden" | `hasTeamspacePermission(tsId, 'submissions.create')` |
| `submissions-page` | "Verwaltung" button | `hasTeamspacePermission(tsId, 'submissions.view_all') ∨ ...view_scoped` |
| `submissions-verwaltung-page` | Status filter, search, sort | (page is gated already; controls visible) |
| `submissions-verwaltung-page` | "Konfiguration" button | `hasTeamspacePermission(tsId, 'settings.manage')` |
| `submission-categories-page` | Create/Edit/Delete category | `hasTeamspacePermission(tsId, 'settings.manage')` |
| `submission-detail-page` | "Antworten" / "Status ändern" / "Zuweisen" | `hasTeamspacePermission(tsId, 'submissions.process')` |
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

## Notifications (Push / In-App / Email)

- Status-change notifications deep-link to the detail route.
- Submissions influence the teamspace-home badge via `TeamspaceUnreadCountService`.
- **Submitter notifications** are sent on all three channels (PUSH + IN_APP + EMAIL) whenever the workflow advances visibly to the original employee:
  - `submission_responded` — fires when a processor adds a `response` via `POST .../response`. If the same call also closes the submission (`should_close=true`), the body line announces both events; no separate status-change notification is sent.
  - `submission_status_changed` — fires when `PATCH .../status` moves the submission between `pending` / `in_review` / `closed` (re-openings included). Approval flows continue to use the dedicated `approval_granted` / `approval_denied` types; rejected is a terminal state and cannot transition.
  - Self-notify is suppressed: when the actor equals `employee_id`, no notification is created.

## i18n Keys

> User-facing strings remain in German. Owned by the external template and category metadata.

## Offline Behavior

**Flutter-specific:**

- List view cached offline.
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
