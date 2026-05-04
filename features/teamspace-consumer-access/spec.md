# Feature: Teamspace Two-Scope Access Enforcement

> **Status:** 🟢 Implemented (PR 1 Guard, PR 2 Wiring, PR 3 Submissions-Permission-Cut)
> **Owner:** svenarbeit
> **Last updated:** 2026-05-04

## Vision (Elevator Pitch)

Teamspace access decomposes into **two orthogonal scopes**: Scope A — Mitarbeiter-Nutzung (granted by membership: institution-link or PUBLIC), and Scope B — Teamspace-Verantwortung (granted by assignment + `ts.*` permissions). Both scopes are first-class; neither implies the other. This spec enforces this model on read-routes that today trust authentication alone, by rejecting users in *neither* scope at the route boundary.

## The Two-Scope Model

### Scope A — Mitarbeiter-Nutzung

> *„Ich arbeite hier, der Teamspace gehört zu meinem Arbeitsalltag."*

- **Granted by**: institution-link (for `INSTITUTION_BASED` teamspaces) or `PUBLIC` type. Pure membership, no assignment, no permission needed.
- **Capabilities**: read teamspace metadata + content (news, events, knowledge), create *own* submissions, see *own* submissions, RSVP to events, etc.
- **Source of truth**: `findAccessibleTeamspaces()` (teamspaces.service.ts:481-498).

### Scope B — Teamspace-Verantwortung

> *„Ich bin für diesen Teamspace zuständig — ich verwalte Personal/Inhalt/Einsendungen."*

- **Granted by**: `teamspace_employee_assignment` + `ts.*` permissions, *independent* of institution-link.
- **Capabilities** (per permission): create/edit news/events/knowledge, view + process *all* submissions (`submissions.view_all`/`view_scoped`), manage members, configure bookings, …
- **Source of truth**: `/auth/context.teamspaces[id]` (assignment-driven), `/teamspaces/editable` (returns full Teamspace entities filtered by ts.* permissions).

### Orthogonality

|  | has Scope A | no Scope A |
|---|---|---|
| **has Scope B** | local team-leader (member + manager) | **Fachbereichsleitung** — manages without being a member |
| **no Scope B** | normal employee | tenant employee with no relation to this teamspace |

All four cells are real users in production. The implementation must respect that.

### Important consequences

- **Reading-permissions like `submissions.view_all` are Scope B, not Scope A.** A user with `view_all` is a *processor* of submissions (Verwaltung), not a regular consumer of the teamspace.
- **Scope B does *not* imply Scope A.** Fachbereichsleitung does not see the teamspace in her employee navigation. She works from the verwaltung-UI.
- **Scope A does *not* imply Scope B.** The normal employee reads news but cannot create them.

## Motivation

Today's enforcement is uneven:

| Surface | Scope A enforced? | Scope B enforced? |
|---|---|---|
| `findAccessibleTeamspaces()` (employee nav list) | ✅ yes | n/a (correctly excluded) |
| `findEditableTeamspaces()` (verwaltung list) | n/a (correctly excluded) | ✅ yes |
| Write routes (`POST /articles`, …) | n/a (correctly not required) | ✅ yes (`@Auth({ scope: 'teamspace', permissions })`) |
| `GET /teamspaces/:id` (and other `:teamspaceId` read routes that don't filter through `findAccessibleTeamspaces`) | ❌ **not enforced** | ❌ **not enforced** |

A user from institution **A** can call `GET /teamspaces/{id-of-institution-B-only-teamspace}` and receive the full teamspace object — even though they are in *neither* scope (no membership, no assignment). This is a metadata leak, and the wrong layer to defend.

## Observable behavior changes

1. **`GET /teamspaces/:id`** — users in *neither* Scope A nor Scope B receive `403 Forbidden` instead of the teamspace payload.
2. **Other `:teamspaceId`-keyed read routes** (audit list below) — same: 403 if neither scope.
3. **All four user classes from the orthogonality table continue to work as today** for routes they need:
   - Normal employee (Scope A only) → `GET /teamspaces/:id` returns 200.
   - Local team-leader (Scope A + B) → 200.
   - Fachbereichsleitung (Scope B only) → 200, since Scope B is sufficient.
   - Tenant user with neither → **403** (was 200, this is the fix).
4. **Tenant admins are unaffected** — they bypass the guard.
5. **`findAccessibleTeamspaces` is unchanged** — strict Scope A. Fachbereichsleitung still does not see the teamspace in her employee nav (intentional).
6. **Write routes are unchanged** — still gated by `@Auth({ scope: 'teamspace', permissions: [...] })` (Scope B). The new guard is *not* added to write routes; doing so would lock out pure-writers who have no Scope A.

No frontend behavior changes for legitimate users. The change is only that hand-crafted requests with a teamspace-id the user has no relation to are now rejected at the route layer.

## Non-goals

- Replacing or merging the scopes with a single permission model — they remain orthogonal by design.
- Filtering content endpoints that already apply access-control filters (e.g. `applyAccessControl` in submissions). The guard sits *in front of* those filters as a fast 403 for users in neither scope; it does not replace the per-content checks.
- Changing `findAccessibleTeamspaces` or `findEditableTeamspaces` — they are the canonical Scope-A and Scope-B list endpoints respectively, and stay strict.
- Client portal exposure of teamspaces — clients are not yet first-class teamspace participants; that needs its own spec if/when it lands.

## Acceptance Criteria

- [ ] `GET /teamspaces/:id` for an institution-based teamspace — for a caller in *neither* Scope A nor Scope B (no institution-link, no assignment) — returns `403 Forbidden` with code `TEAMSPACE_NOT_ACCESSIBLE`.
- [ ] Same call as **Tenant Admin** → `200 OK`.
- [ ] Same call as **Scope-A-only user** (member of a linked institution, no assignment) → `200 OK`.
- [ ] Same call as **Scope-B-only user** (Fachbereichsleitung — assignment with any ts.* permission, not member of any linked institution) → `200 OK`.
- [ ] Same call for a `PUBLIC` teamspace by any authenticated tenant user → `200 OK`.
- [ ] `findAccessibleTeamspaces()` is unchanged — Scope-B-only users do **not** see the teamspace there.
- [ ] `findEditableTeamspaces()` is unchanged — Scope-A-only users do **not** see the teamspace there (unless they also have an assignment).
- [ ] Write routes (e.g. `POST /articles` with `news.create`) remain reachable for Scope-B-only users — i.e. **no consumer guard is added to write routes**.
- [ ] Existing E2E tests (`apps/tagea-frontend-e2e/src/tests/teamspaces/*.spec.ts`) remain green.
- [ ] New E2E denial test: an employee in institution A, with no assignment to a teamspace bound only to institution B, gets 403 on `GET /teamspaces/{B-teamspace-id}`.
- [ ] New E2E pass-through test: a Fachbereichsleitung-class user (assignment to teamspace, not in any linked institution) gets 200 on the same endpoint.
- [ ] New unit tests on the guard cover all four cells of the orthogonality table plus tenant-admin bypass and `is_active = false` rejection.

## Design

### Service helper

`TeamspacesService.hasTeamspaceAccess(userId: string, teamspaceId: string): Promise<boolean>` (new). Returns `true` if the user is in Scope A *or* Scope B for that teamspace.

Implementation outline (single SQL query, single round-trip):

```sql
SELECT 1 FROM teamspaces t
WHERE t.id = :teamspaceId
  AND t.is_active = true
  AND (
    t.type = 'public'
    OR EXISTS (                          -- Scope A: institution-link
      SELECT 1 FROM teamspace_institutions ti
      JOIN institution_assignments ia
        ON ia.institution_id = ti.institution_id
      WHERE ti.teamspace_id = t.id
        AND ia.user_id = :userId
        AND ia.deleted_at IS NULL
    )
    OR EXISTS (                          -- Scope B: assignment
      SELECT 1 FROM teamspace_employee_assignments tea
      WHERE tea.teamspace_id = t.id
        AND tea.user_id = :userId
        AND tea.deleted_at IS NULL
    )
  )
```

The Scope-B clause checks for *any* assignment (with any ts.* permission). The model says: if the tenant-admin gave you an assignment, you have a reason to know this teamspace exists.

### Guard

`TeamspaceAccessGuard` (apps/tagea-backend/src/teamspaces/guards/teamspace-access.guard.ts), modeled on `TeamspaceModuleGuard`:

- Decorator `@RequireTeamspaceAccess()` for routes whose `teamspaceId` is on `params` or `body`.
- Resolver form `@RequireTeamspaceAccess({ resolve: async (req, tm) => string | null })` for entity-keyed routes (e.g. `/articles/:id` where the teamspace lives on the entity). Returning `null` opts out (resource is not in a teamspace context).
- `req.isTenantAdmin` bypasses unconditionally.
- Calls `TeamspacesService.hasTeamspaceAccess(userId, teamspaceId)`. Falsy result → `ForbiddenException('TEAMSPACE_NOT_ACCESSIBLE')`.

### Order of checks (when stacked with `TeamspaceModuleGuard`)

`Access` → `Module`. A user in neither scope must receive 403 even if the module is inactive — don't leak teamspace existence by varying the error.

## Route Inventory (audit during implementation PR)

Each candidate is classified. **Write routes get no new guard** — Scope B is already enforced via `@Auth({ scope: 'teamspace', permissions })`. Adding the access guard to write routes would lock out pure-Scope-B users.

| Route | Class | Notes |
|---|---|---|
| `GET /teamspaces/:id` | `@RequireTeamspaceAccess` | The trigger case. |
| `GET /teamspaces/:id/employees` | `@RequireTeamspaceAccess` | Plus existing `members.view` member-permission. |
| `GET /teamspaces/:id/deletion-impact` | already tenant-admin only | No change. |
| News/Events/Knowledge **read** routes (per-teamspace) | `@RequireTeamspaceAccess` | Pure consumption gate at the boundary. |
| Submissions read routes | `@RequireTeamspaceAccess` | Already has per-content `applyAccessControl` filter; guard sits in front of it as a fast reject. |
| News/Events/Knowledge/Submissions **write** routes | unchanged | Existing `@Auth({ scope: 'teamspace', permissions: [...] })` (Scope B) stays sole gate. |

Resolver-form needed where the teamspace lives on the entity, not the URL — e.g. `GET /articles/:id` returns `null` for non-teamspace article types (`documentation`/`announcement`).

## Edge case: `submission-detail-page.component.ts:1489`

Audit found two frontend callers of `getTeamspaceById`. Both are in consumer-facing browsing. After the guard lands, they will 403 for users in neither scope — which is correct behavior for unauthorized navigation.

For Scope-B-only users (Fachbereichsleitung processing submissions), the guard returns 200 — they have an assignment, so they pass. The page works as today. No additional accommodation needed.

## Migration / Rollout

No DB migration. The guard is additive — pre-deploy, calls succeed; post-deploy, illegitimate calls 403. Risk vector: a legitimate caller path was relying on the current laxness. The route-inventory step exists precisely to flush these out.

Rollout in two PRs:

1. **PR 1** — `hasTeamspaceAccess` service method, `TeamspaceAccessGuard` + `@RequireTeamspaceAccess` decorator, unit tests covering all four orthogonality cells. No routes wired. Mergeable on its own — no behavior change.
2. **PR 2** — Wire `@RequireTeamspaceAccess` on the audited routes, add E2E denial + pass-through tests for the new scenarios.

## Frontend

No changes required. The frontend already only links to teamspaces a user can see (via `findAccessibleTeamspaces` or `findEditableTeamspaces`), so legitimate flows don't construct unauthorized teamspace-id URLs. If somewhere the frontend constructs a teamspace-id-bearing URL from a non-trusted source, that path will now 403, and the existing 403 handler kicks in.

## Implemented Reference: Submissions-Permission-Cut (2026-05-04)

The submissions area was the first refactor that fully exercises the model. Done in
migration `20260504170000-RestructureSubmissionsPermissions.ts`:

- **New tenant-scoped permissions** (Scope-A capabilities):
  - `tenant.submissions.submit` — submit own submission + view category list
  - `tenant.submissions.view_own` — see own submissions + their attachments / filled-PDFs / Verwalter-response
  - Default-mapped to all three standard tenant roles (`mitarbeiter`, `personalverwalter`, `traeger_manager`).
- **Renamed** `submissions.edit` → `submissions.process` (Scope B verarbeiten — clearer intent).
- **Removed** `submissions.create` and `submissions.view_own` from the ts.* catalog — they are now tenant-scoped.

Route gates after the cut:

| Route | Access-Guard | Permission-Decorator |
|---|---|---|
| `GET /teamspaces/:tsId/submission-categories` | `@RequireTeamspaceAccess()` | `@Auth({ scope: 'tenant', permissions: [TENANT_SUBMISSIONS_SUBMIT] })` |
| `POST /teamspaces/:tsId/submissions` | dito | dito + `@RequireTeamspaceModule('submissions')` |
| `GET /teamspaces/:tsId/submissions[/:id/...]` (alle Konsumenten-Read-Pfade) | dito | `@Auth({ scope: 'tenant', permissions: [TENANT_SUBMISSIONS_VIEW_OWN] })` |
| `PATCH /:id/status`, `PATCH /:id/assignment`, `POST /:id/response`, alle process-Routen | dito | `@Auth({ scope: 'teamspace', permissions: [SUBMISSIONS_PROCESS] })` |
| `GET /:id/assignable-employees`, `GET /stats`, `GET /export/csv` | dito | `@Auth({ scope: 'teamspace', permissions: [SUBMISSIONS_VIEW_ALL] })` (oder `SUBMISSIONS_PROCESS` für assignable-employees) |
| Categories CRUD (POST/PUT/DELETE) | dito | `@Auth({ scope: 'teamspace', permissions: [SETTINGS_MANAGE] })` |

E2E pinned in:
- `non-member-cannot-create-submissions-in-teamspace.spec.ts` (3 cells: PUBLIC pass, institution-link pass, foreign-inst deny)
- `outsider-cannot-list-submission-categories.spec.ts` (3 cells, dito)
- `bearbeiter-sees-only-own-submissions.spec.ts` (filter floor: bearbeiter ohne ts.submissions.* sieht nur eigene via tenant.submissions.view_own)
- `traegermanager-resets-defaults-restores-matrix.spec.ts` (post-cut role-permission counts: admin 16, bearbeiter 7, redakteur 7)

## Future work (out of this spec)

- A more fine-grained guard variant `@RequireTeamspacePermission(perm)` that combines access + a specific ts.* permission — useful for read-routes that want to require explicit Scope B (e.g. `submissions.view_all`) on top of generic access. Not needed for this spec; the existing `@Auth({ scope: 'teamspace', permissions: [...] })` already covers permission-specific gating, just without the route-level fast-403 for users in neither scope.
- Other content areas (news, events, knowledge, files) follow the same pattern when they get audited — consumer-read routes need the access guard wired, write routes get only the per-permission `@Auth` (Scope B). Submissions is the reference implementation.
- Client-portal exposure of teamspaces would introduce a third scope (Scope C — Klienten-Sicht). Out of scope here.
