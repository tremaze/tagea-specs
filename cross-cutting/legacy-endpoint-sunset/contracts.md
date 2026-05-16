# Contracts: Legacy Endpoint Sunset

This is a process spec, not an API spec — it has no wire contract of its own.

The endpoints listed in the [Sunset Table](./spec.md#sunset-table) keep their original wire shapes unchanged during the sunset window. Their contracts live with the refactor that originally defined them:

- Submissions legacy: [`features/teamspace-submissions/contracts.md`](../../features/teamspace-submissions/contracts.md) — the entries `GET /submissions` (default-OR) and the `?visibility=…` query-param are documented there as "Deleted in the same change" — until the cleanup PR actually runs, that documentation is forward-looking.
- Auth-Hydration legacy: [`features/auth-session/`](../../features/auth-session/) — `/tenants/current/theme` and `/auth/me/institutions` were originally part of the pre-`/session` API surface.

When a cleanup PR removes a legacy endpoint, the originating spec's contracts.md gets updated in the same PR to remove any lingering "currently still served" qualifiers.
