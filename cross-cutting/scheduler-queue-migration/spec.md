# Feature: Scheduler Queue Migration (Redis + BullMQ)

> **Status:** Phase 0 + 1 done (2026-04-25). Phase 2 planned ([phase-2-plan.md](./phase-2-plan.md)).
> **Owner:** baumgart
> **Last updated:** 2026-04-25
> **Type:** Backend infrastructure migration (no Flutter port — backend-only behavior)

## Vision (Elevator Pitch)

Replace the current cron-based per-tenant iteration in `tagea-backend` with a Redis-backed BullMQ job queue. Schedulers stop iterating all 45 active tenants every minute on every replica, stop holding ~90 PostgreSQL connections per backend warm, and stop firing identical work twice (once per replica). Article publishing becomes event-driven (jobs enqueued with `delay` at status-change time); reminder dispatch and daily syncs run as repeatable jobs that pull live state from the database. Either way, BullMQ owns "who runs this", and a single shared `SchedulerDataSourceService` provides per-transaction tenant isolation via `SET LOCAL search_path`.

## Background & Motivation

On 2026-04-23/24, Sentry issue TAGEA-BACKEND-4D (`error: remaining connection slots are reserved for roles with the SUPERUSER attribute`) accumulated 15k+ events. Investigation traced the root to:

- **45 active tenants × 2 (Read + Write DataSources) × 2 backends = 180 logical Postgres connections** — knife-edge to the effective cap of 197 (`max_connections=200`, `superuser_reserved_connections=3`).
- **Two `@Cron(EVERY_MINUTE)` schedulers** (`article-scheduler`, `appointment-reminder-scheduler`) iterate every active tenant on each tick, refreshing the `lastAccessTime` of every per-tenant DataSource and preventing the cache's idle-eviction from ever firing. Steady-state holds essentially all DataSources warm.
- **Both backend replicas run identical scheduler workloads** (jittered 0–30 s to avoid wall-clock collisions) — pure duplication of work and connection pressure.
- Three prior 24-hour fix attempts (commits `8a528653`, `3fa45428`, `15bd4c8a`) ping-ponged the per-tenant pool size between 1, 2, and 3 — none addressed the structural cause (per-tenant pool count, not pool size).

The schedulers are one of two structural causes of the connection-pool exhaustion. (The other — per-tenant DataSources for *user* traffic — requires an app-wide refactor and PgBouncer; that's a separate, later effort. This spec covers the scheduler half.)

See [`memory/project_infrastructure.md`](../../../memory/project_infrastructure.md) for full production topology and connection-budget math.

## Goals

1. **Reduce scheduler-induced Postgres connections from ~90 to ≤10 across both backends** (a single shared scheduler DataSource per worker process with `max=5`).
2. **Eliminate duplicate work between replicas** — every job runs exactly once per logical occurrence, regardless of replica count.
3. **Persist jobs across restarts** — a backend restart in the middle of a scheduled-publish window does not lose articles or reminders.
4. **Establish the `SET LOCAL search_path` per-transaction tenant-isolation pattern** as a piloted, tested foundation. The same pattern will later carry the user-pathway refactor that PgBouncer transaction-pooling requires.
5. **Improve observability** — bull-board dashboard exposes queue depth, in-flight jobs, failures, and retry state.

## Non-Goals

- Refactoring user-facing request paths to use shared DataSources. (Out of scope; a separate spec.)
- Introducing PgBouncer. (Depends on the user-pathway refactor; a separate spec.)
- Changing the multi-tenant data model (schema-per-tenant remains).
- Migrating the report-worker (`apps/tagea-backend/src/reports/workers/report-worker.ts`) — it has its own DataSource pattern and is a separate concern.
- Changing public API contracts. All HTTP endpoints continue to behave identically; only internal background-work execution changes.

## Architecture: Before / After

### Before

```
                   @Cron(EVERY_MINUTE)
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
            Backend be1         Backend be2
                │                   │
                ▼                   ▼
         iterate 45 tenants  iterate 45 tenants
                │                   │
                ▼                   ▼
         getWrite(tenantId)  getWrite(tenantId)
              ×45                 ×45
                │                   │
                ▼                   ▼
         45 PG-Conns         45 PG-Conns
         (always warm —      (always warm —
          cache touched      cache touched
          every minute)      every minute)
                            
         Sub-total: ~90 PG-Conns from schedulers, in addition to user traffic
```

### After

```
Event-driven enqueue (Phase 3):
  - "article status = scheduled"     → articles.queue.add(..., { delay: ... })

Repeatable jobs (replacing per-minute / daily / monthly @Cron):
  - "reminder-dispatch-tick"         → reminders.queue.add(..., { repeat: { pattern: '*/1 * * * *' } })
  - "azure-ad-sync"                  → sync.queue.add(..., { repeat: { pattern: '0 2 * * *' } })
  - "vivendi-sync", "time-account", "ai-chat-cleanup", "registration-cleanup", "outlook-sync"
                            │
                            ▼
                   ┌─────────────────────┐
                   │ Redis (10.0.3.4)    │
                   │   bull:reminders:…  │   AOF persistence + noeviction
                   │   bull:articles:…   │   (reconfigured from current)
                   │   bull:sync:…       │
                   │   bull:cleanup:…    │
                   └──────────┬──────────┘
                              │ pull
              ┌───────────────┴───────────────┐
              ▼                               ▼
       Worker on be1                   Worker on be2
       concurrency: 5                  concurrency: 5
       (per queue)                     (per queue)
              │                               │
              └───────────────┬───────────────┘
                              ▼
                  SchedulerDataSourceService
                  - one shared DataSource per worker process
                  - extra.max = 5 (concurrent transactions)
                  - SET LOCAL search_path inside each tenant tx
                              │
                              ▼
                       Postgres-LB → Main

   Scheduler total: 2 backends × 5 PG-Conns max = 10 PG-Conns
                    (vs ~90 before)
```

## Phase Plan

| # | Phase | Scope | Aufwand | Risiko | Status |
|---|---|---|---|---|---|
| 0 | Vorbereitung | Redis-Reconfig (AOF + noeviction + 3GB cap), Mess-Infra (`pg_stat_activity` snapshot CSV), QS-Tenant-Seed | 1 Tag | Niedrig | ✅ QS done 2026-04-25; Prod deferred |
| 1 | BullMQ Foundation | `QueueModule`, `SchedulerDataSourceService`, bull-board mount, tenant-isolation test suite | 1–2 Tage | Niedrig | ✅ Done 2026-04-25 |
| 2 | Pilot: Reminder | Migrate `appointment-reminder-scheduler` to a single BullMQ repeatable job + worker using `SchedulerDataSourceService.runInTenantContext()`. **Keep the existing query-based dispatch model** — see [`phase-2-plan.md`](./phase-2-plan.md). | ~8h Code + Soak | Niedrig | ✅ Code done; soaking on QS since 2026-04-25 |
| 3 | Article Publishing | Migrate `article-scheduler` to **event-driven enqueue** at status-transitions + BullMQ worker that runs the same atomic `UPDATE … RETURNING` plus fan-out sub-jobs for embedding (KNOWLEDGE) and notification (NEWS). See [`phase-3-plan.md`](./phase-3-plan.md). | ~8h Code + 3 Tage Soak | Niedrig | ✅ Code done 2026-04-26 |
| 3b | Outlook-Sync | Migrate `outlook-sync-scheduler` (5-min cadence) to BullMQ — top-level `outlook-sync-tick` repeatable job that fans out one `outlook-sync-user` sub-job per eligible user. Worker concurrency configurable via `OUTLOOK_SYNC_WORKER_CONCURRENCY` for parallel sync. **Sauberer DB-Refactor:** `OutlookSyncCoreService` + `OutlookTokenCoreService` nehmen `manager: EntityManager` als required Param — keine internen `tenantConnectionService`-Calls mehr. See [`phase-3b-plan.md`](./phase-3b-plan.md). | ~12h Code + 1 Tag Soak | Mittel | ✅ Code done 2026-04-26 |
| 4 | Daily Crons | Migrate `azure-ad-sync`, `vivendi-sync`, `time-account-scheduler`, `ai-chat-cleanup`, `registration-cleanup` to repeatable jobs with per-tenant fan-out. (Outlook moved to Phase 3b above.) | 2 Tage | Niedrig | ⏳ Optional — daily/monthly schedulers are not steady-state PG-conn drivers; migration is a consistency play, not a perf play |
| 5 | Cleanup | Delete old `*-scheduler.service.ts` classes, remove `@Cron` decorators, remove feature flags, update memory | 0,5 Tag | Niedrig | ⏳ |

**Total: ~8 days net engineering time.**

## Detailed Designs

### Phase 0 — Redis Reconfiguration ✅ QS DONE 2026-04-25 — Prod deferred until after Phase 2 soak

The current Redis on `10.0.3.4` (CPX22, 4 GB RAM) is configured per [`apps/tagea-backend/docs/docker-compose.prod.example.yml`](../../../apps/tagea-backend/docs/docker-compose.prod.example.yml) for rate-limit storage only:

```yaml
command:
  - --appendonly
  - 'no'                    # ← incompatible with persistent jobs
  - --maxmemory
  - 128mb                   # ← undersized for queue+rate-limit shared use
  - --maxmemory-policy
  - allkeys-lru             # ← would evict job data under pressure
```

**This config is wrong for a job queue.** A Redis crash loses scheduled reminders; LRU eviction silently discards jobs. The reconfiguration shares one Redis instance across rate-limit + queue use cases:

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    ports:
      - '${REDIS_PRIVATE_IP}:6379:6379'
    volumes:
      - /opt/redis/data:/data       # NEW: AOF persistence on disk
    command:
      - redis-server
      - --requirepass
      - ${REDIS_PASSWORD}
      - --appendonly
      - 'yes'                       # CHANGED
      - --appendfsync
      - everysec                    # NEW: 1-second fsync window
      - --maxmemory
      - 3gb                         # CHANGED from 128mb
      - --maxmemory-policy
      - noeviction                  # CHANGED from allkeys-lru
```

**Trade-off accepted:** with `noeviction`, hitting the 3 GB cap blocks all writes (including rate-limit). Backend code already treats Redis-write failures as `RateLimitStoreUnavailableError` → 503 (`RATE_LIMIT_FAIL_MODE=closed`), so the failure mode is degraded-but-defined. 3 GB of headroom on a 4 GB VM far exceeds any realistic queue+rate-limit volume.

**Verification:**
1. `redis-cli -a $PWD CONFIG GET maxmemory-policy` → `noeviction`
2. `redis-cli -a $PWD CONFIG GET appendonly` → `yes`
3. Restart drill: stop Redis, restart, confirm AOF replay restores test job; rate-limit counters expectedly empty (TTL ≤ 1 h).

**Status:**
- ✅ QS (Tagea-V2-DEV-QS, single VM, container `tagea-redis-qs` in `/opt/tagea-v2/qs/docker-compose.yml`): AOF on, `everysec` fsync, **1 GB cap (QS VM has only 4 GB total)**, `noeviction`, persistent volume `tagea-redis-qs-data`. Persistence drill (SET → restart → GET) passed 2026-04-25.
- ✅ `conn-trace.sh` running on QS as systemd service, snapshotting `pg_stat_activity` every 5 s to `/var/log/conn-trace.csv`. 1h baseline (2026-04-25): min=3, avg=40, max=75 over 799 samples.
- ⏳ Prod Redis-reconfig + conn-trace install: deferred until Phase 2 QS-soak proves the migration end-to-end. The values in the YAML block above (`3gb`) target Prod; QS deviates downward.

### Phase 1 — `SchedulerDataSourceService` ✅ DONE 2026-04-25

The core of the tenant-isolation pattern. One shared `DataSource` per worker process — no per-tenant pools — with `SET LOCAL search_path` scoped to each transaction.

**Implementation:** [`apps/tagea-backend/src/queue/scheduler-data-source.service.ts`](../../../apps/tagea-backend/src/queue/scheduler-data-source.service.ts)

**Design invariants (non-negotiable; any change here requires a security review):**

- Single Postgres `DataSource`, `extra.max = 5`, `min = 1`, `idleTimeoutMillis = 30s`. **No** `schema` binding and **no** `extra.options` setting `search_path` — those would pin the connection to one tenant.
- Entity list comes from the shared `TENANT_ENTITIES` (`apps/tagea-backend/src/queue/__shared/tenant-entities.ts`), same source-of-truth as `TenantConnectionService`. Adding a tenant entity to one without the other is a bug.
- `runInTenantContext(tenantId, fn)` is the **only** sanctioned tenant-scoped entry point. It:
  1. Validates `tenantId` against a strict UUID regex; throws on any other input.
  2. Opens a transaction.
  3. Runs `SET LOCAL search_path TO "tenant_<id>"` — bounded by the surrounding `BEGIN`/`COMMIT`, automatically reset by Postgres on commit/rollback.
  4. Invokes `fn(manager)` inside the transaction.
- `getDataSource()` exposes the raw DS only for tests + meta-DB fan-out reads where no tenant scope applies. Production tenant-data paths must use `runInTenantContext` exclusively.

**Tenant Isolation Test Suite (was Phase 2 entry gate; passed):** at `apps/tagea-backend/src/queue/scheduler-data-source.service.spec.ts`. 11 Testcontainers-based scenarios, ~15s runtime. All green as of 2026-04-25. Required scenarios covered:

1. Inserts in tenant A are visible only inside tenant A's context.
2. Parallel concurrent calls do not bleed search_path (50 alternating calls).
3. Malicious tenantId formats are rejected before any SQL runs (`;`, `--`, `'`, `"`, spaces, non-hex characters).
4. search_path resets after transaction commit.
5. Rollback restores search_path.

Loosening any of these invariants without a corresponding test update + security review is a tenant-data-leak risk — DSGVO-relevant.

### Phase 2 — Pilot: Appointment Reminder

> **Detailed implementation plan, decisions, and cutover checklist:** [`phase-2-plan.md`](./phase-2-plan.md). The summary below records the design choice and rationale; the plan file owns the actionable detail.

#### Design choice (resolved 2026-04-25): query-based + BullMQ driver, NOT event-driven enqueue

The earlier draft of this spec assumed Phase 2 would enqueue per-reminder jobs at appointment-creation time with `delay`. We **do not pursue that design** for the following reason:

The team replaced a job-table-based reminder system with the current **query-based dispatcher** on 2026-04-17 (migration `20260417140000-ReplaceReminderJobsWithSentLog.ts`). The migration's own commentary records why:

> *"Old model: `appointment_reminder_jobs` + `reminder_backfill_jobs` tables carried a pre-computed, stateful schedule. Every state change in the system (appointment create/update/cancel, employee settings toggle) had to propagate into these tables — which was the source of every reminder bug we've been chasing."*

Re-introducing per-event enqueue at appointment-creation time would re-introduce that synchronisation problem. We don't.

The current dispatcher is already correct, idempotent, and reactive to live state. The connection-pool problem comes from its **execution model** (per-minute `@Cron` on every replica + per-tenant DataSource cache) — not from its data model. Phase 2 fixes only the execution model.

#### What changes

| Aspect | Before | After (Phase 2) |
|---|---|---|
| Tick driver | `@Cron(EVERY_MINUTE)` on each replica | Single BullMQ repeatable job `dispatch-tick` (`*/1 * * * *`) — single-owner across replicas |
| DataSource access per tenant | `tenantConnectionService.getWrite(tenantId)` (per-tenant pool, ~45 cached) | `schedulerDs.runInTenantContext(tenantId, …)` (one shared DS, `SET LOCAL search_path` per tx) |
| Dispatcher SQL | unchanged | unchanged |
| Idempotency | `appointment_reminder_sent` UNIQUE index | unchanged |
| Suppression rules (absence, working hours) | encoded as JOINs in dispatcher SQL | unchanged |
| Schema | `appointment_reminder_sent` table | unchanged — **no migration** |

#### Cutover

Behind env-var feature flag `FEATURE_REMINDER_QUEUE` (default `false`):
- `false` — old `@Cron` runs as today; BullMQ repeatable job is **not** registered.
- `true` — `@Cron` returns early; BullMQ repeatable job is registered at module init; worker drives ticks via `SchedulerDataSourceService.runInTenantContext`.

Both paths coexist in code through Phase 5 cleanup. The `appointment_reminder_sent` UNIQUE constraint protects against double-send during the brief dual-active window when one replica is flipped before the other.

For per-step details (file list, test plan, observability, rollback runbook, soak windows), see [`phase-2-plan.md`](./phase-2-plan.md).

### Phase 3 — Article Publishing ✅ DONE 2026-04-26

> **Detailed implementation plan, decisions, and cutover checklist:** [`phase-3-plan.md`](./phase-3-plan.md). Summary below records the design choice and rationale.

#### Design choice: Event-driven enqueue (different from Phase 2)

Article migrates **event-driven** — unlike Reminders which kept query-based — because the three reasons that argued against event-driven for Reminders fall away here:

| Aspect | Reminder (query-based) | Article (event-driven) |
|---|---|---|
| State machine | Complex: cancel, reschedule, employee opt-in toggle, suppression rules | Trivial: `scheduled` → `published`. Single-step. |
| Idempotency | Per-channel UNIQUE index, multiple writes | Atomic `UPDATE … WHERE status='scheduled' … RETURNING *` does it in the SAME statement |
| Stale-job risk | High: an obsolete job can't tell whether its target is still valid | Zero: UPDATE finds 0 rows when article is reverted/deleted — lazy-cancel by design |

**Trigger points** (in `articles.service.ts`):
- create() with `status='scheduled'` + `scheduled_publish_date` → `producer.enqueuePublish(...)`
- update() into `scheduled` from another status → `producer.enqueuePublish(...)`
- update() of `scheduled_publish_date` while still in `scheduled` → `producer.replaceJob(...)`
- update() out of `scheduled` (back to draft / forced publish) → `producer.removeJob(...)`
- remove() (soft-delete) of an article that was `scheduled` → `producer.removeJob(...)`

JobId is `publish-${articleId}` — stable, BullMQ-deduped. The producer is a no-op when `FEATURE_ARTICLE_QUEUE` is unset, so callers in `articles.service.ts` invoke unconditionally.

#### Worker (`ArticleProcessor`)

```
publish-article (delayed by publish_date - now)
    │
    ▼
schedulerDs.runInTenantContext(tenantId, manager =>
  UPDATE articles SET status='published', published_at=NOW(), updated_at=NOW()
   WHERE id=$1 AND status='scheduled' AND scheduled_publish_date<=NOW() AND is_deleted=false
   RETURNING *
)
    │
    │ rowCount > 0 (we actually published — fan-out)
    ▼
generate-article-embedding   (KNOWLEDGE-only, AI Chat enabled tenants)
send-article-notification    (NEWS-only)
```

Both sub-jobs run on QUEUE_ARTICLES with `concurrency: 5`. Sub-job retries are independent (BullMQ `attempts: 3, backoff: exponential`), so a Mistral hiccup doesn't roll back the publish.

#### Cutover

Behind env-var feature flag `FEATURE_ARTICLE_QUEUE` (default `false`):
- `false` — old `@Cron` path runs (legacy minute-tick); producer is a no-op; processor is registered but receives no work.
- `true` — `cronTick()` returns early; producer enqueues at status-transitions; processor picks up jobs.

Both paths coexist in code through Phase 5 cleanup. The atomic UPDATE protects against double-publish during the brief dual-active window when one replica is flipped before the other.

### Phase 4 — Daily Crons (Repeatable Jobs)

> **Note:** Originally included `outlook-sync`. After Phase 2/3 demonstrated that the steady-state PG-conn drop is what matters, daily/monthly schedulers (`azure-ad-sync`, `vivendi-sync`, `time-account-scheduler`, `ai-chat-cleanup`, `registration-cleanup`) are **not** steady-state drivers — they spike once per day or month. Migrating them is a consistency play, not a perf play. Phase 4 is therefore optional / lower-priority.
>
> `outlook-sync` (5-min cadence) IS a steady-state driver and was split out as Phase 3b — separate plan, separate cutover.

For schedulers that don't have a natural per-event trigger, use BullMQ repeatable jobs registered on module init:

```typescript
await this.syncQueue.add(
  'azure-ad-sync',
  {},
  {
    repeat: { pattern: '0 2 * * *' },
    jobId: 'azure-ad-sync-recurring', // dedupes across worker restarts
  },
);
```

Per-tenant fan-out pattern:

```typescript
@Processor(QUEUE_SYNC, { concurrency: 5 })
async process(job: Job): Promise<void> {
  if (job.name === 'azure-ad-sync') {
    // Top-level repeatable job — fans out one sub-job per tenant
    const metaDb = await this.tenantConnectionService.getMetaDatabase();
    const tenants = await metaDb.getRepository(Tenant).find({ where: { status: 'active' } });
    for (const tenant of tenants) {
      await this.syncQueue.add('azure-ad-sync-tenant', { tenantId: tenant.id });
    }
    return;
  }

  if (job.name === 'azure-ad-sync-tenant') {
    await this.schedulerDs.runInTenantContext(job.data.tenantId, async (manager) => {
      // per-tenant azure sync logic — moved from azure-ad-sync-scheduler.service.ts
    });
  }
}
```

`concurrency: 5` means 5 tenant sub-jobs run in parallel — bounded fan-out, 5 PG-Conns, regardless of tenant count.

### Phase 5 — Cleanup

- Delete `articles/services/article-scheduler.service.ts` (migrated)
- Delete `appointment-reminders/appointment-reminder-scheduler.service.ts` (migrated)
- Delete the per-scheduler files for the daily crons (migrated)
- Remove `@Cron` decorators
- Remove feature flags (`FEATURE_REMINDER_QUEUE` etc.)
- Update memory at `memory/project_scheduler_queue_migration.md` with final phase status

## QS Test Plan

For each phase, run before+after measurements in QS using:

| Scenario | How to trigger | What to measure |
|---|---|---|
| **A — Idle** | 10 min, no test load | Steady-state PG connection count, scheduler-conn estimate |
| **B — Scheduler burst** | Insert 50 reminders per tenant, all due in 60 s | Peak conns, time-to-drain queue, errors |
| **C — User + scheduler mix** | k6/artillery: 100 req/s mixed across all tenants, while Scenario B runs | Worst-case peak, P95 latency for user requests |

Hochrechnung Prod: QS-1-Worker × 2 = expected Prod with 2 backends. Direction-of-change is reliable; absolute numbers are estimation.

For Hebel 3 (leader-election style — implicitly handled by BullMQ since each job has a single owner), validate by running 2 backend containers on the QS VM (different ports) and confirming each job is processed exactly once.

## Prod Rollout

Per-phase pattern:
1. QS green ≥ 24 h
2. Deploy to be1 only via SSH `update-backend`
3. Observe 1 h: Sentry, bull-board, conn-trace
4. If clean: deploy be2
5. Observe 24 h
6. If clean: proceed to next phase

**Kill-switch:** every phase ships behind a feature flag (`FEATURE_REMINDER_QUEUE`, `FEATURE_ARTICLES_QUEUE`, `FEATURE_SYNC_QUEUE`). Flip to `false` to revert without redeploy. Old cron paths remain in code through Phase 4.

## Monitoring & Observability

- **bull-board** mounted at `/admin/queues` (auth-guarded — super-admin only). Shows queue depth, in-flight jobs, completed/failed counts, retry state, individual job inspection.
- **Sentry** — workers wrap `process()` in Sentry's transaction monitor; failed jobs after exhausting retries surface as Sentry errors with full job payload.
- **`conn-trace.sh`** — already running on PG-Main, captures `pg_stat_activity` every 5 s. Pre/post-phase delta is the primary connection-count proof.
- **App metrics endpoint** (deferred — not built in Phase 1): `/admin/metrics/connections` returning `tenantConnectionService.getConnectionDetails()` plus the BullMQ queue stats. Re-evaluate after Phase 2 if bull-board + conn-trace prove insufficient for ops.

## Risks & Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| Tenant-isolation bug (search_path leak across tenants) | Mittel | **Sehr hoch** (DSGVO-relevanter Datenleck) | Dedicated test suite (Phase 1, blocking), strict UUID validation, code review of all `runInTenantContext` callers, pilot is reminder (low-stakes content) |
| BullMQ jobs stuck after worker crash | Niedrig | Mittel | BullMQ stalled-job recovery is automatic; bull-board dashboard surfaces stuck queues; alert on queue depth > N |
| Redis OOM (3 GB cap with `noeviction`) blocks writes | Niedrig | Hoch | 3 GB headroom on 4 GB VM far exceeds realistic volume; Sentry alert on Redis OOM errors; runbook entry for emergency `MEMORY USAGE` inspection |
| Reminder duplication via BullMQ retry or dual-active cutover window | Mittel | Niedrig (UX) | Existing `(appointment_id, employee_id, reminder_type, channel)` UNIQUE index on `appointment_reminder_sent` plus `INSERT … ON CONFLICT DO NOTHING` in `recordSent` already guarantees at-most-once across retries and replicas |
| Repeatable-job schedule survives feature-flag flip-back | Niedrig | Niedrig | Documented in [`phase-2-plan.md`](./phase-2-plan.md) rollback section; one-line `removeRepeatable(...)` available for permanent rollback |
| Feature-flag flip causes window where neither path is active | Niedrig | Mittel | Feature flag gates which path runs at runtime; both paths coexist in code; switch is atomic per process |
| Daily syncs starve under heavy reminder traffic | Niedrig | Niedrig | Separate queues (`QUEUE_SYNC` ≠ `QUEUE_REMINDERS`), separate worker pools, each with own `concurrency` |
| Tenant marked `inactive` while jobs still queued | Niedrig | Niedrig | Worker checks tenant status before SET search_path (in `runInTenantContext` could add this check, or in the job handler) |

## Rollback Strategy

- **Per-phase rollback** via feature flag flip → old cron path resumes immediately. For repeatable-job phases (2, 4) the schedule persists in Redis until manually removed; for delay-based phases (3) any pending delayed jobs continue to live in BullMQ and fire when the flag is re-enabled (combined with the idempotency guarantees of each phase).
- **Pre-Phase-5 (cleanup) rollback** is straightforward: feature flags + old code intact.
- **Post-Phase-5 rollback:** if a critical issue surfaces after cleanup is merged, revert the cleanup commit. The infrastructure (Redis-reconfig, BullMQ module) stays — only the old cron classes are restored.
- **Redis-config rollback:** if the AOF + 3 GB + noeviction config causes unforeseen issues, the previous compose config can be restored on the Redis VM. Existing in-flight jobs persist on disk and will be picked up after restart.

## Open Decisions (resolved 2026-04-25)

- ✅ **Spec-first:** spec written before code (this document).
- ✅ **Redis strategy:** Option X — reconfigure existing Redis (`10.0.3.4`), share between rate-limit and queue.
- ✅ **Pilot:** appointment-reminder first (largest connection-pressure contributor + non-trivial tenant-isolation pattern; success here de-risks the rest).
- ✅ **Phase 2 design:** **Query-based + BullMQ driver**, not event-driven enqueue. Rationale: the team migrated away from job-table-based reminders on 2026-04-17 because keeping the table in sync with appointment + employee state was the bug source. The execution model is what fails today, not the data model. See [`phase-2-plan.md`](./phase-2-plan.md).

## Open Questions (to revisit before Phase 2 cutover)

- Do we need a dedicated worker VM, or do co-located workers on be1+be2 suffice? (Decision: start co-located; add dedicated VM only if CPU contention with user traffic shows up.)
- ~~bull-board UI mount under what auth?~~ ✅ Resolved in Phase 1: env kill-switch (`BULL_BOARD_ENABLED=true`) + super-admin DB check via `BullBoardAuthMiddleware`.
- Logging strategy: structured JSON for job-level events to be parsable by netdata/loki/whatever the ops stack adds in the future.

## References

- **Production infrastructure:** `memory/project_infrastructure.md` (Claude auto-memory; not in repo)
- **Current scheduler files (to be migrated/removed):**
  - `apps/tagea-backend/src/articles/services/article-scheduler.service.ts`
  - `apps/tagea-backend/src/appointment-reminders/appointment-reminder-scheduler.service.ts`
  - `apps/tagea-backend/src/azure-ad-sync/azure-ad-sync-scheduler.service.ts`
  - `apps/tagea-backend/src/vivendi-sync/services/vivendi-sync-scheduler.service.ts`
  - `apps/tagea-backend/src/workforce-planning/services/time-account-scheduler.service.ts`
  - `apps/tagea-backend/src/outlook-sync/services/outlook-sync-scheduler.service.ts`
  - `apps/tagea-backend/src/ai-chat/services/ai-chat-cleanup.service.ts`
  - `apps/tagea-backend/src/registration-cleanup/registration-cleanup.service.ts`
- **Connection pool implementation:** `apps/tagea-backend/src/tenants/tenant-connection.service.ts`
- **Redis prod config example:** `apps/tagea-backend/docs/docker-compose.prod.example.yml`
- **Sentry incident:** issue ID 2790 / TAGEA-BACKEND-4D (15k+ events 2026-04-18 to 2026-04-23)
- **Prior fix attempts:** commits `8a528653`, `3fa45428`, `15bd4c8a`, `7dd8fa82`, `b838128c`
