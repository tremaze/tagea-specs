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

- **Status:** ✅ Pilot landed (Appointments)
- **Primitives:** `apps/tagea-backend/src/permissions/ability/` — base class, types, field-permission helper, tests.
- **Pilot Ability:** `apps/tagea-backend/src/appointments/abilities/appointment.ability.ts` (+ mapper in the same folder).
- **Wired endpoints:** `GET /einrichtung/:id/appointments/:id` returns `_permissions`; `PATCH /einrichtung/:id/appointments/:id` enforces `_fieldPermissions` with `422`.

## Known Divergences

- Frontend will continue computing permissions locally until migrated. During that window, the backend is the authority; client-side state-based checks act as UI polish, not enforcement.

## Port Log

| Date       | Who      | What                                                           |
| ---------- | -------- | -------------------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec created; pilot entity = Appointments; backend-only rollout |
