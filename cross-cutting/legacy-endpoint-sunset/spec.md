# Cross-Cutting: Legacy Endpoint Sunset

> **Status:** 🚧 Process spec, live
> **Owner:** svenarbeit
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

When a refactor introduces new endpoints that replace existing ones, the legacy endpoints can NOT be deleted immediately — the native app (Capacitor wrap of the same Angular bundle) is updated through Apple/Google review and lags behind the web by weeks. This spec is the central, greppable ledger of every legacy endpoint that is kept alive temporarily, its replacement, and the earliest date a cleanup PR may delete it. Refactors enter the table here BEFORE marking endpoints as deprecated; cleanups consult the table before deleting anything.

## Non-Goals

- This is not a deprecation framework with runtime warnings — the table itself is the framework. No `Deprecation` header injection, no telemetry agent.
- Not a substitute for clear inline `@deprecated` JSDoc tags in code — those still belong on the legacy controller / service methods. The table is the chronology and accountability layer ON TOP of those tags.
- Not a force-update mechanism. Force-update lives in a separate TODO (see [Pending: Force-Update Mechanism](#pending-force-update-mechanism)).

## Workflow

### Adding an entry (refactor PR that obsoletes an endpoint)

1. In the same PR that introduces the replacement endpoint, add a row to the [Sunset Table](#sunset-table) below.
2. Mark the original endpoint with `@deprecated /** Replaced by <new-endpoint>; sunset on <date>. See specs/cross-cutting/legacy-endpoint-sunset/. */` in code.
3. Pick `Earliest delete date` based on the app-population estimate: **default = 4 weeks** from the PR merge date (Apple/Google review + typical user update lag), longer if a specific population is known to update slower.
4. Leave the entry at status `🟡 live` until cleanup.

### Cleaning up (follow-up PR after the date)

1. Once a quarter (or opportunistically), scan the table for entries past their `Earliest delete date` AND with verified low traffic.
2. For each, delete the endpoint / query-param shortcut in code.
3. Mark the table entry status `✅ removed` and add the cleanup PR.
4. Entries stay in the table indefinitely as historical record — they're cheap, and the "when was X removed?" question comes up.

### Verifying low traffic (before cleanup)

Defense-in-depth before deletion: check that the legacy endpoint is genuinely unused.

- Backend access log grep / metrics (whatever's available) for the route.
- If traffic > 0 from non-test sources, find out which app version still calls it. If recent app version: investigation. If only old versions: continue as planned — those users see degraded UI, not data loss.

## Sunset Table

| Endpoint / Param | From refactor | Replacement | Earliest delete | Status | Source PR |
|---|---|---|---|---|---|
| `GET /submissions` (default-OR over visibility paths) | entity-permissions pilot 2026-05-16 | `GET /submissions/{managed,supervised,own}` | 2026-06-13 | 🟡 live | (this branch) |
| `GET /submissions?visibility=institution_supervisor` (query-param shortcut) | entity-permissions pilot 2026-05-16 | `GET /submissions/supervised` | 2026-06-13 | 🟡 live | (this branch) |
| `GET /tenants/current/theme` | Auth-Hydration backward-compat | `/session` DTO `tenant.theme` | unscheduled — pin when next Auth-Hydration cleanup runs | 🟡 live | `a076949aa` |
| `GET /auth/me/institutions` | Auth-Hydration backward-compat | `/session` DTO | unscheduled — pin when next Auth-Hydration cleanup runs | 🟡 live | `a076949aa` |
| `GET /teamspaces/:teamspaceId/submission-categories` | submission-template-refactor Stage 1 2026-05-20 | `GET /teamspaces/:teamspaceId/submission-templates` | sunset together with submission-template-refactor Stage 2 (DB cleanup) | 🟡 live | (this branch) |
| `GET /teamspaces/:teamspaceId/submission-categories/:id` | submission-template-refactor Stage 1 2026-05-20 | `GET /teamspaces/:teamspaceId/submission-templates/:id` | sunset together with submission-template-refactor Stage 2 (DB cleanup) | 🟡 live | (this branch) |
| `POST /submissions` body field `category_id` (dual-accept with `template_id`) | submission-template-refactor Stage 1 2026-05-20 | `POST /submissions` with `template_id` | sunset together with submission-template-refactor Stage 2 (DB cleanup) | 🟡 live | (this branch) |

Status legend:
- `🟡 live` — endpoint exists, marked deprecated, still served
- `✅ removed` — endpoint deleted in the named cleanup PR
- `⏸️ blocked` — earliest date reached but cleanup blocked (note reason inline)

## Pending: Force-Update Mechanism

**Status:** ⏳ Not scheduled. Tracked here as a known follow-up so it doesn't get lost in code comments.

### Why this matters

The 4-week sunset rule above accepts that some users on old app versions will see degraded UI in the window. That is acceptable for low-risk degradations (empty Verwaltungs-list, missing badge). It is **not** acceptable for high-risk ones (broken auth, broken submit flow, broken payment). A force-update mechanism is the safety net for the day a refactor crosses into high-risk territory.

### Sketch (when we get to it)

- The Capgo live-update plugin was removed in `78c000efe`, so any solution must work through native app updates only (no OTA hot-patch).
- Backend exposes a `GET /system/min-app-version` (or returns the floor on every authenticated response as a header). App at startup compares its bundled version against the floor.
- If app version < floor → render a blocking "bitte App updaten" screen with a deep-link to the App Store / Play Store, no further UI mounted.
- The floor is bumped manually per release in a small admin surface or env var.
- Hen-egg: the first version that adopts this mechanism cannot retroactively force-update users on earlier versions. Mitigation: introduce as a no-op (floor = 0.0.0) and bump it only when the mechanism is itself widely deployed.

### Trigger to plan this

Add as roadmap item when EITHER:
- A high-risk legacy-endpoint sunset comes up that can't tolerate the 4-week-degraded-UI window, OR
- The volume of entries in the Sunset Table grows past ~10 and per-endpoint backwards-compat code becomes a real maintenance burden, OR
- A specific auth-protocol change (e.g. token format) requires it.

Until then: 4-week sunset + accept-degraded-UI is the working strategy.

## References

- Initial driver: [entity-permissions pilot](../entity-permissions/spec.md) — Submissions split into `/managed`, `/supervised`, `/own` (2026-05-16).
- Capgo removal: commit `78c000efe refactor(capgo): remove Capgo live-update plugin entirely` — turned native-app updates into the only viable update path.
- Earlier backward-compat: commit `a076949aa feat(backward-compat): restore /tenants/current/theme + /auth/me/institutions endpoints` — entries pinned in the table above.
