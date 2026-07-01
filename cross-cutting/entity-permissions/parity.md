# Parity: Entity-Level Permissions

## Angular

- **Status:** ⏳ Not yet consumed
- **Path:** existing permission infrastructure in `apps/tagea-frontend/src/app/services/unified-auth.service.ts`, `apps/tagea-frontend/src/app/directives/has-permission.directive.ts`, and per-feature guards under `apps/tagea-frontend/src/app/guards/`.
- **Adoption plan:** after the backend pattern stabilizes across multiple entities, a separate effort replaces client-side state/time/owner computeds (e.g. `appointment-detail.component.ts:259–342`) with reads from `_permissions` / `_fieldPermissions`.

## Flutter

- **Status:** ⏳ Not started
- **Path:** N/A
- **Notes:** Dart port follows the wire contract described in [contracts.md](./contracts.md).

## Backend

- **Status:** ⏳ Planned, not yet implemented. Verified 2026-05-16: `apps/tagea-backend/src/permissions/ability/` folder does not exist, no `_permissions` / `_fieldPermissions` / `_visibility` field is serialized anywhere in the repo, no `toDtoWithPermissions` call site exists. Earlier `✅ Pilot landed` claim was spec-drift — there was never a landed implementation.
- **Primitives (planned):** `apps/tagea-backend/src/permissions/ability/` — base class, types, field-permission helper, visibility-origin helper, tests.
- **First Pilot (chosen 2026-05-16):** Submissions — see [`features/teamspace-submissions/`](../../features/teamspace-submissions/spec.md). Submissions was chosen over Appointments because it stress-tests the pattern under (a) per-detail visibility variance via `_visibility`, and (b) the new collection-scoping convention (split scoped-list endpoints, no client-side filtering).
- **Wired endpoints (planned for first pilot):**
  - `GET /teamspaces/:tsId/submissions/:id` and `GET /submissions/:id` return `_permissions` + `_visibility`
  - Collection list endpoints are SPLIT by scope per the [collection scoping convention](./spec.md#collection-scoping-convention): `GET /submissions/managed`, `GET /submissions/supervised`, `GET /submissions/own`. Each is scoped server-side via its own `@Auth` annotation; items contain NO meta-fields (Server Invariant 5 strict).
  - The legacy `GET /submissions` (default-OR over all visibility paths) and the `?visibility=institution_supervisor` query-param shortcut are removed in the same change.
  - `PATCH /teamspaces/:tsId/submissions/:id/status` (and other mutation routes) enforce permission/field rules with `403` / `422` symmetric to detail-response hints.
- **Earlier candidate (Appointments):** the worked vocabulary in [contracts.md](./contracts.md) remains as a planned future Ability adoption — not the first to land.

## Known Divergences

- Frontend will continue computing permissions locally until migrated. During that window, the backend is the authority; client-side state-based checks act as UI polish, not enforcement.
- Submissions detail page currently uses a `?mode=admin` query-param heuristic to choose UI variant (`submission-detail-page.component.ts:1386`). After the first pilot lands, that heuristic is removed and the UI variant is derived from `_visibility`.

## Port Log

| Date       | Who        | What                                                                                                                                            |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-21 | ltoenjes   | Spec created; original pilot candidate = Appointments; backend-only rollout                                                                     |
| 2026-05-16 | svenarbeit | Parity drift corrected (pilot never actually landed). Pattern extended with `_visibility` (detail-response origin discriminator) and the collection-scoping convention (URL is scope authority; collection items carry no meta-fields). First pilot reassigned to Submissions. |
