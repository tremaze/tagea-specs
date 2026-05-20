# Cross-Cutting: Entity-Level Permissions in Detail Responses

> **Status:** 🚧 In progress
> **Owner:** ltoenjes (original pattern), svenarbeit (2026-05-16 extensions)
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

The backend becomes the single authority for "what can the current user do with this specific entity?" **and** for "why can the current user see this entity in the first place?". Detail-fetch endpoints (`GET /<resource>/:id`) embed a `_permissions` object (actions), an optional `_fieldPermissions` object (forbidden mutations), and a `_visibility` discriminator (access origin) alongside the entity. Collection endpoints follow a **scoped-list convention**: instead of one collection that returns mixed visibility-origins (forcing clients to filter), the backend exposes one URL per logical scope (e.g. `GET /<resource>/managed`, `GET /<resource>/supervised`, `GET /<resource>/own`). The URL is the scope authority — items contain no meta-fields. Clients render enabled/disabled UI and gate actions without re-implementing role, state, time, ownership, or visibility-origin rules, and lists deliver only the items their URL promises.

## Non-Goals

- Frontend migration. Clients will adopt the new fields in a separate effort; existing client-side permission logic continues to work untouched during rollout.
- Replacing the global `PERMISSIONS` constants or role model. The new per-entity layer is **additive**.
- Caching / change-streaming of permissions or visibility. Both are computed on each fetch.
- Bulk-action endpoints.
- **Meta-fields on collection items.** No `_permissions`, no `_fieldPermissions`, and no `_visibility` on list responses. The collection-scoping convention makes per-item meta redundant — every item in `GET /<resource>/managed` is, by URL contract, a "managed" item. Detail fetch supplies the full `_permissions` map (and the confirming `_visibility`) when a row is opened.

## Contract Summary

Every entity detail response MAY be augmented with three fields:

- `_permissions: Record<Action, boolean>` — which named actions the authenticated user is allowed to perform on this specific entity.
- `_fieldPermissions?: Partial<Record<Field, false>>` — which fields are currently **forbidden** for mutation. Positive default: missing keys mean the field is writable. Only the literal value `false` is permitted; `true` must not appear.
- `_visibility: VisibilityOrigin` — **why** the current user can see this entity at all. Single-value discriminator (e.g. `'own' | 'teamspace_member' | 'institution_supervisor' | 'tenant_admin'` for submissions). The vocabulary is per-entity.

Collection (list/search) response items MUST NOT carry `_permissions`, `_fieldPermissions`, or `_visibility`. List responses follow the [collection-scoping convention](#collection-scoping-convention) — the URL is the scope authority, and items inside that URL are by definition in that scope.

Action identifiers follow a **hybrid** vocabulary:

- **CRUD base** (always present for entities that ship permissions): `read`, `update`, `delete`.
- **Domain actions** (per entity, optional): verbs that reflect real operations — e.g. `cancel`, `reschedule`, `reassignEmployee` for appointments; `changeStatus`, `assign`, `respond`, `acknowledge` for submissions. Domain actions are introduced as the UI needs them; they are **not** required.

Visibility identifiers are likewise per-entity, but follow conventions: lowercase snake_case strings naming the **source** of access (not the role of the viewer). Common values across entities:

- `own` — viewer authored / owns / is the subject of this entity.
- `tenant_admin` — viewer has tenant-admin or super-admin elevation (admin-bypass path).
- Other values are domain-specific (e.g. `teamspace_member`, `institution_supervisor`, `assigned_counselor`, `participant`).

## Acceptance Criteria

### Detail endpoints

- [ ] **Given** an entity that supports permissions **When** a client calls `GET /<resource>/:id` **Then** the response body contains a `_permissions` object with one boolean per declared action for that entity.
- [ ] **Given** an entity that supports the pattern **When** a client calls `GET /<resource>/:id` **Then** the response body contains a `_visibility` discriminator naming the access origin via which the current user sees this entity.
- [ ] **Given** an entity has field-level rules **When** a client calls `GET /<resource>/:id` **Then** the response MAY additionally contain `_fieldPermissions` listing only the **forbidden** fields with value `false`.
- [ ] **Given** `_permissions.<action>` is `false` for an entity **When** the client invokes the corresponding route **Then** the backend rejects the request with `403 Forbidden` (symmetry: response field and route guard agree).
- [ ] **Given** `_fieldPermissions.<field>` is `false` **When** the client sends a `PATCH` whose body contains that field **Then** the backend rejects the request with `422 Unprocessable Entity` and names the forbidden field.
- [ ] **Given** `_fieldPermissions` is absent or does not list a field **When** the client sends a `PATCH` touching that field **Then** the backend does not reject on field-permission grounds (positive default).
- [ ] **Given** a user lacks coarse permission to read an entity **When** they request the detail route **Then** they receive `403`/`404` as today — `_permissions` / `_visibility` are only ever serialized for users who are allowed to see the entity.

### Collection endpoints (scoped-list convention)

- [ ] **Given** an entity that participates in the pattern **When** the backend exposes a list endpoint for it **Then** the endpoint URL identifies a single visibility-scope (e.g. `/managed`, `/supervised`, `/own`) — there is no default-OR collection that mixes multiple visibility origins.
- [ ] **Given** a scoped list endpoint **When** a client receives the list **Then** every item satisfies the URL's scope (server-enforced via the same Ability that computes `_visibility` on detail) and items contain NO `_permissions`, `_fieldPermissions`, or `_visibility` fields.
- [ ] **Given** an item appears in `GET /<resource>/<scope>` **When** the same entity is opened via the detail route **Then** the detail's `_visibility` is one of the values declared as compatible by the scope's per-entity inclusion-semantics rule (see [Per-scope inclusion semantics](#per-scope-inclusion-semantics)). For *exclusive* scopes, the values are strictly identical; for *inclusive* scopes, the detail value may be a more-specific visibility-origin (e.g. an item in `/managed` may show `_visibility: 'own'` if the principal also owns it).
- [ ] **Given** a list endpoint where the entity does not yet participate in the pattern **When** the client receives the list **Then** items are unchanged (the pattern is opt-in per entity).

## Enforcement Rules (Server Invariants)

1. **Backend is the authority.** The `_permissions` / `_fieldPermissions` / `_visibility` values are hints for UI. The backend MUST still enforce the same rules via route guards and request validation. Clients that ignore the hints fail at the server, not silently.
2. **Single source of truth.** Route guards, response serialization, and PATCH validation MUST call the same `EntityAbility` service for a given entity. Duplicated rule evaluations are forbidden. The `_visibility` computation MUST live in the same Ability service that computes `_permissions` — both derive from the same access-control evaluation pass.
3. **Explicit mapping.** Controllers attach the augmented fields via an explicit service method (conventionally `toDtoWithPermissions(entity, user)`), not via a global response interceptor. The code path must be greppable.
4. **Positive-default field model.** `_fieldPermissions` values are either `false` or absent. Serializers MUST NOT emit `true`.
5. **No meta-fields on collection items.** List/search responses MUST NOT carry `_permissions`, `_fieldPermissions`, or `_visibility` on items. Scope is communicated via the URL ([collection-scoping convention](#collection-scoping-convention)), not via per-row discriminators. This makes lists DSGVO-clean (no items leak via mixed-scope responses), pagination-stable (page-size is honest), and cache-friendly (each URL = one scoped result set).
6. **Visibility is single-valued.** When a user qualifies for multiple origins (e.g. owner AND tenant-admin), the Ability MUST pick the **most specific** value per a documented per-entity precedence (typically `own > domain-specific > tenant_admin`). The chosen value is stable for the same principal viewing the same entity in the same request.
7. **URL ≡ scope on lists.** Every collection endpoint serves exactly one visibility-scope, named in its URL (per the [collection-scoping convention](#collection-scoping-convention)). No `?visibility=…` query-param shortcuts that switch scopes on a shared collection endpoint — that pattern is forbidden, because it makes route guards imprecise and obscures the scope from logs/cache keys.

## Edge Cases

- **Entity not yet loaded (`toDtoWithPermissions` called with `null`)**: not permitted. The mapper assumes the entity has already been fetched and access-checked.
- **Action declared but impossible in current state**: evaluated as `false` (e.g. `cancel` on an already-cancelled appointment).
- **Field changes during the same request**: `_fieldPermissions` is evaluated against the **pre-update** entity state. If an update transitions the entity into a state where more fields would be locked, the next fetch reflects that — the just-completed PATCH does not.
- **Feature-flagged actions** (e.g. video-meeting join): the action stays in the vocabulary but evaluates to `false` when the feature is disabled for the tenant. Clients treat flag-disabled the same as permission-denied.
- **Owner-based rules**: when the current user owns / participates-in the entity, owner-scoped actions (e.g. `cancelOwnParticipation`) may be `true` even if the broader `cancel` is `false`. Clients must consult the specific action, not a generic one.
- **Visibility-origin ambiguity**: a user may qualify for multiple origins (e.g. they own a submission AND they are a tenant-admin AND they happen to also be in the teamspace). The Ability resolves to a single value via per-entity precedence (see Invariant 6). Clients MUST treat `_visibility` as authoritative for that principal — they do not re-derive it from other session/role state.
- **Visibility changes between request and follow-up**: visibility is computed per-request from the current principal state. If permissions change between fetches (e.g. tenant-admin role added), the next fetch may show a different `_visibility` for the same entity. Clients that need stable UI through a session SHOULD cache the value with the loaded entity, not recompute from session state.

## Collection Scoping Convention

When an entity exposes a list (anything more than a single detail), the backend ships **one URL per logical scope** rather than one collection that mixes scopes. This is the collection-side counterpart to `_visibility` on detail responses: detail says "why I can see this item", scoped lists say "everything in this URL is in this scope".

### URL naming

Pattern: `GET /<resource>/<scope>` where `<scope>` is a single lowercase word matching one of the entity's `_visibility` values, except admin-elevation paths (`tenant_admin`) which are typically not surfaced as a separate list scope (admins consume `/managed` together with everyone else, or are routed through admin-specific tooling).

Concrete examples (Submissions, first pilot):

| URL | Scope (matches `_visibility` on detail) | Who can call it | Typical UI consumer |
|---|---|---|---|
| `GET /<resource>/managed` | `teamspace_member` (incl. tenant-admin bypass) | callers with at least one teamspace-level manage permission | global verwaltungs-list |
| `GET /<resource>/supervised` | `institution_supervisor` | callers with `institution.<resource>.view_institution_members` | supervisor-section in the per-teamspace page; sidebar badge |
| `GET /<resource>/own` | `own` | every authenticated user | "meine ..."-section / dashboard |
| `GET /teamspaces/:tsId/<resource>` | union of `own` and `teamspace_member` **within that one teamspace** (URL also scopes by tenant route param) | teamspace members | per-teamspace list page |

Per-teamspace and per-institution scoped routes (`/teamspaces/:tsId/...`, `/einrichtung/:id/...`) are a degenerate case of the same pattern — their scope is already URL-encoded by the route param. They do NOT mix multiple `_visibility` origins of the broader tenant scope; if needed they expose their own sub-scoped URLs.

### Server invariants for scoped lists

- Each scoped URL has its own `@Auth({ scope: ..., permissions: [...] })` annotation. No shared annotation across scopes.
- Server-side, every scoped list calls the same Ability service that computes `_visibility` on detail. Specifically, the implementation reuses one shared query-builder predicate per visibility-origin so list and detail cannot drift.
- `?visibility=…` query-params are explicitly forbidden (see Server Invariant 7).
- No "fall back to broader scope if narrower one returns empty" magic. Empty is empty.

### Per-scope inclusion semantics

Each scope is documented as either **exclusive** or **inclusive**:

- **Exclusive scope** — an item appears in this list ONLY when its detail-`_visibility` would equal this scope. Used when overlap with another scope would create user-visible double-display (e.g. supervisor-only items should not also leak into the manage-list as separate entries with different UI treatment).
- **Inclusive scope** — an item appears in this list whenever the principal satisfies this scope's qualification, regardless of whether the principal also qualifies for a more-specific scope. Used when the list-mental-model is "what can I see in this capacity" and overlap with `/own` (or another broader scope) is the natural answer (e.g. a TS-admin who also submitted a request should see their own request on the manage-list).

The per-entity contract MUST document which scopes are exclusive and which are inclusive. Submissions example (in [`features/teamspace-submissions/contracts.md`](../../features/teamspace-submissions/contracts.md)):

| Scope | Inclusion semantics | Rationale |
|---|---|---|
| `/own` | inclusive | "my submissions" — natural to include everything I submitted |
| `/managed` | inclusive of `own` and `tenant_admin` | "items I can manage" — overlap with own is desirable; admin-bypass items are managed by definition |
| `/supervised` | exclusive | "items I see only via supervisor visibility" — overlap with own/managed would double-display in a UI that has separate "meine Mitarbeiter"-section |

### Migration of pre-existing default-OR endpoints

When migrating an existing tenant-wide collection that today returns mixed visibility-origins:

1. Introduce the three (or more) scoped URLs alongside the legacy URL.
2. Frontend consumers move one-by-one to the new URLs.
3. Once the last consumer is migrated, delete the legacy URL and any `?visibility=…` shortcuts in the same change.

The legacy URL MUST NOT live on past the migration.

## Pilot: Submissions (first to land)

First entity to adopt this contract. Full action vocabulary, visibility values, scoped-list endpoints, and field list live in [`features/teamspace-submissions/contracts.md`](../../features/teamspace-submissions/contracts.md). The rules encoded in the pilot Ability MUST match the behaviors described in [`features/teamspace-submissions/spec.md`](../../features/teamspace-submissions/spec.md).

Submissions stress-tests both pattern additions made in this revision:
- `_visibility` discriminator on detail with four values (`own`, `teamspace_member`, `institution_supervisor`, `tenant_admin`), exercising the per-entity precedence rule.
- Collection scoping convention — pre-existing `GET /submissions` (default-OR) and `?visibility=institution_supervisor` shortcut are deleted; replaced by `GET /submissions/managed`, `GET /submissions/supervised`, `GET /submissions/own`.

## Planned: Appointments (second pilot)

The pre-existing Appointments vocabulary in [contracts.md](./contracts.md) was the original target. After Submissions lands, Appointments is the natural second adoption — it exercises field-level permissions (`_fieldPermissions` for `status`, `template_id`, `assigned_to_employee_ids`) and feature-flagged actions (`joinVideoMeeting`), which Submissions does not. Owner of the second pilot is open.

## Permissions & Tenant/Institution

- The Ability consumes the same authenticated principal that route guards use (institution scope, tenant scope, teamspace scope as applicable).
- Tenant feature flags participate in action evaluation (e.g. `joinVideoMeeting` is `false` when video meetings are disabled for the tenant).
- Per-institution permission overrides (`InstitutionPermissionOverride`, `InstitutionRolePermissionOverride`) are honored transitively through the existing coarse permission check; the Ability layer does not re-implement override resolution.

## Rollout Strategy

1. Land the shared primitives + pilot (Appointments) in one change.
2. Migrate further entities one-per-PR, each adding its own `EntityAbility` + mapper + tests.
3. Once multiple entities are covered, a separate frontend effort wires the UI to read `_permissions` and retire client-side duplicates.

## References

- **Plan:** `/Users/lennarttonjes/.claude/plans/das-kannst-du-ja-robust-parnas.md`
- **Contracts (wire shape, action/field vocabulary):** [contracts.md](./contracts.md)
- **Existing coarse permissions:** `apps/tagea-backend/src/permissions/permissions.constants.ts`
- **Frontend rules this will eventually replace:** `apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts:259–342`, `apps/tagea-frontend/src/app/services/calendar-event.service.ts:205–214`
