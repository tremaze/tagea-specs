# Cross-Cutting: Entity-Level Permissions in Detail Responses

> **Status:** 🚧 In progress
> **Owner:** ltoenjes
> **Last updated:** 2026-04-21

## Vision (Elevator Pitch)

The backend becomes the single authority for "what can the current user do with this specific entity?". Detail-fetch endpoints (`GET /<resource>/:id`) embed a `_permissions` object (and optional `_fieldPermissions` object) alongside the entity, letting clients render enabled/disabled UI and gate actions without re-implementing role, state, time, or ownership rules.

## Non-Goals

- List, search, or aggregate endpoints (`GET /<resource>`). Permissions are **only** shipped on detail fetches.
- Frontend migration. Clients will adopt the new fields in a separate effort; existing client-side permission logic continues to work untouched during rollout.
- Replacing the global `PERMISSIONS` constants or role model. The new per-entity layer is **additive**.
- Caching / change-streaming of permissions. Permissions are computed on each detail fetch.
- Bulk-action endpoints.

## Contract Summary

Every entity detail response MAY be augmented with two fields:

- `_permissions: Record<Action, boolean>` — which named actions the authenticated user is allowed to perform on this specific entity.
- `_fieldPermissions?: Partial<Record<Field, false>>` — which fields are currently **forbidden** for mutation. Positive default: missing keys mean the field is writable. Only the literal value `false` is permitted; `true` must not appear.

Action identifiers follow a **hybrid** vocabulary:

- **CRUD base** (always present for entities that ship permissions): `read`, `update`, `delete`.
- **Domain actions** (per entity, optional): verbs that reflect real operations — e.g. `cancel`, `reschedule`, `reassignEmployee` for appointments. Domain actions are introduced as the UI needs them; they are **not** required.

## Acceptance Criteria

- [ ] **Given** an entity that supports permissions **When** a client calls `GET /<resource>/:id` **Then** the response body contains a `_permissions` object with one boolean per declared action for that entity.
- [ ] **Given** an entity has field-level rules **When** a client calls `GET /<resource>/:id` **Then** the response MAY additionally contain `_fieldPermissions` listing only the **forbidden** fields with value `false`.
- [ ] **Given** a list endpoint (`GET /<resource>`) **Then** the response MUST NOT include `_permissions` or `_fieldPermissions`.
- [ ] **Given** `_permissions.<action>` is `false` for an entity **When** the client invokes the corresponding route **Then** the backend rejects the request with `403 Forbidden` (symmetry: response field and route guard agree).
- [ ] **Given** `_fieldPermissions.<field>` is `false` **When** the client sends a `PATCH` whose body contains that field **Then** the backend rejects the request with `422 Unprocessable Entity` and names the forbidden field.
- [ ] **Given** `_fieldPermissions` is absent or does not list a field **When** the client sends a `PATCH` touching that field **Then** the backend does not reject on field-permission grounds (positive default).
- [ ] **Given** a user lacks coarse permission to read an entity **When** they request the detail route **Then** they receive `403`/`404` as today — `_permissions` is only ever serialized for users who are allowed to see the entity.

## Enforcement Rules (Server Invariants)

1. **Backend is the authority.** The `_permissions` / `_fieldPermissions` values are hints for UI. The backend MUST still enforce the same rules via route guards and request validation. Clients that ignore the hints fail at the server, not silently.
2. **Single source of truth.** Route guards, response serialization, and PATCH validation MUST call the same `EntityAbility` service for a given entity. Duplicated rule evaluations are forbidden.
3. **Explicit mapping.** Controllers attach permissions via an explicit service method (conventionally `toDtoWithPermissions(entity, user)`), not via a global response interceptor. The code path must be greppable.
4. **Positive-default field model.** `_fieldPermissions` values are either `false` or absent. Serializers MUST NOT emit `true`.
5. **No permissions on collections.** List/search responses MUST NOT carry permission fields; collection items stay lean.

## Edge Cases

- **Entity not yet loaded (`toDtoWithPermissions` called with `null`)**: not permitted. The mapper assumes the entity has already been fetched and access-checked.
- **Action declared but impossible in current state**: evaluated as `false` (e.g. `cancel` on an already-cancelled appointment).
- **Field changes during the same request**: `_fieldPermissions` is evaluated against the **pre-update** entity state. If an update transitions the entity into a state where more fields would be locked, the next fetch reflects that — the just-completed PATCH does not.
- **Feature-flagged actions** (e.g. video-meeting join): the action stays in the vocabulary but evaluates to `false` when the feature is disabled for the tenant. Clients treat flag-disabled the same as permission-denied.
- **Owner-based rules**: when the current user owns / participates-in the entity, owner-scoped actions (e.g. `cancelOwnParticipation`) may be `true` even if the broader `cancel` is `false`. Clients must consult the specific action, not a generic one.

## Pilot: Appointments

First entity to adopt this contract. Full action vocabulary and field list live in [contracts.md](./contracts.md). See also the parallel feature spec [`features/appointment-detail/spec.md`](../../features/appointment-detail/spec.md) — the rules encoded in the pilot Ability MUST match the behaviors described there.

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
