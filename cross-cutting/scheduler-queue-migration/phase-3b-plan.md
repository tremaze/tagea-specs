---
phase: 3b — Outlook-Sync (Per-User Fan-out)
status: ✅ Code done 2026-04-26
owner: baumgart
created: 2026-04-26
last_updated: 2026-04-26
spec: ./spec.md
predecessor: Phase 3 (Article, live + verified)
---

# Phase 3b Plan — Outlook-Sync Migration mit Per-User-Fan-out + Clean DB-Refactor

## TL;DR

Der existierende `OutlookSyncSchedulerService` läuft alle 5 Min und iteriert pro Tenant **sequentiell** alle aktiven `OutlookCalendarSync`-Configs. Bei einem 1000-Mitarbeiter-Tenant dauert ein Tick ~8 Minuten — nahe der 5-Min-Cron-Cadence, was strukturell unsauber ist.

Phase 3b ersetzt das mit einem **Top-Level/Sub-Job-Pattern**:
- `outlook-sync-tick` (repeatable, 5 Min default, configurable) enumeriert eligible Users und enqueued pro User einen Sub-Job
- `outlook-sync-user` (per User) macht den eigentlichen Sync mit `concurrency: N` (default 5, env-konfigurierbar)

Bei 1000 MA + concurrency=10: 1000 / 10 × ~2s = ~200s statt 8 Min sequentiell.

**Plus** ein größerer Clean-Refactor: `OutlookSyncCoreService` und `OutlookTokenCoreService` haben keine internen `tenantConnectionService`-Calls mehr — alle DB-Methoden bekommen `manager: EntityManager` als required Param. Das ist ein architekturelles Upgrade gegenüber Phase 2/3, wo die Hybrid-Lösung (DataSource intern resolved) noch verwendet wurde.

## Why this design (Smarter Graph API als spätere Phase)

Microsoft Graph **Subscriptions** (Webhooks bei Outlook-Änderungen) wären eine deutlich smartere Variante — statt Polling alle 5 Min, würden wir bei tatsächlichen Änderungen benachrichtigt. Volume-Reduktion bei 1000 MA: 288.000 Calls/Tag → ~333/Tag (Renewal) + N pro echter Änderung.

ABER: Subscriptions brauchen Webhook-Endpoint, Validation-Handshake, Subscription-Lifecycle-Service mit Renewal alle 3 Tage, server-side State. ~20h Code statt ~12h. **Wir bauen Phase 3b zuerst** als robust-skalierende Polling-Lösung; Phase 3c (Subscriptions) kann später drüber, weil die `runFullSync(tenantId, employeeId, manager)`-API genau das ist, was ein Webhook-getriggerter Job aufrufen würde.

## Design Decisions (resolved)

### D1 — Required `manager: EntityManager` an allen DB-Methoden

`OutlookSyncCoreService` (12 Methoden) + `OutlookTokenCoreService` (9 Methoden) bekommen alle `manager` als required last param. Service entfernt `tenantConnectionService` aus dem Constructor — er ist nicht mehr nötig.

**Caller-Strategie:**
- HTTP-Pfad (request-scoped wrapper `OutlookSyncService` / `OutlookTokenService`): injiziert `TENANT_MANAGER` (existing DI token), reicht durch.
- Cron-Pfad (legacy `OutlookSyncSchedulerService`): `(await getWrite(tenantId)).manager`.
- BullMQ-Pfad (neu `OutlookSyncProcessor`): `schedulerDs.runInTenantContext(tenantId, manager => ...)`.

Drei Caller-Pfade, ein Service. Sauber.

### D2 — Per-User-Sub-Job-Fan-out

Top-Level `outlook-sync-tick` ist ein lightweight Enumerator. Echte Arbeit passiert pro User in einem Sub-Job. Concurrency liegt am Sub-Worker:

```
outlook-sync-tick (concurrency: 1, top-level)
   ├─ schedulerDs.runInTenantContext(tenant.id, m => find configs)
   ├─ shouldSkipSync filter (rate-limit / token-expired / disabled)
   └─ enqueue 1 outlook-sync-user job per surviving config

outlook-sync-user (concurrency: OUTLOOK_SYNC_WORKER_CONCURRENCY = 5)
   └─ schedulerDs.runInTenantContext(tenantId, m => coreService.runFullSync(tenantId, employeeId, m))
```

Sub-Job-`jobId` ist `outlook-sync-${tenantId}-${employeeId}-${Date.now()}` — die Timestamp-Komponente ist bewusst, damit zwei Ticks back-to-back nicht durch BullMQ-jobId-Dedup blockieren. Wenn ein Tick verzögert ist und der nächste schon läuft, fallen die Sub-Jobs zwar parallel an, aber der `shouldSkipSync` 2-Min-Rate-Limit auf Config-Ebene fängt das ab (zweiter Sub-Job sieht `last_sync_at` aktuell und skipt sofort am Worker).

### D3 — Sub-Job concurrency env-konfigurierbar

`OUTLOOK_SYNC_WORKER_CONCURRENCY` (default 5). Ops kann bei MS-Graph-429-Throttling auf 3 reduzieren oder bei viel Headroom auf 15 hochziehen — ohne Deploy.

Implementiert via `WorkerHost.getWorkerOptions()` Override (nicht via `@Processor`-Decorator-Option, weil dort noch kein DI verfügbar wäre).

### D4 — Cron-Cadence env-konfigurierbar (existierende Logik)

`OUTLOOK_SYNC_INTERVAL_MINUTES` (default 5) — bleibt von der Legacy-Logik. Pattern wird im `OutlookSyncQueueRegistrationService` als `*/${N} * * * *` gebaut.

### D5 — Feature-Flag `FEATURE_OUTLOOK_QUEUE`

Default `false`. Beim Setzen auf `true`:
- `cronTick()` returns early
- `OutlookSyncQueueRegistrationService` registriert Repeatable Job
- `OutlookSyncProcessor` läuft

### D6 — Tx-Lifetime + Connection-Pool-Size

Pro Sub-Job: eine `runInTenantContext`-Tx hält die Connection für ~1-3s (DB-Reads + MS-Graph-Roundtrip + DB-Writes). Bei `concurrency: 10` und Pool-Size 5 (default `SchedulerDataSourceService.extra.max`) würden 5 Sub-Jobs warten.

**TODO bei großen Tenants:** Pool-Size auf 15-20 erhöhen via Env-Var (env-Knob in `SchedulerDataSourceService` schon vorhanden? Wenn nicht: kleiner Follow-up). Aktuell hardcoded auf 5 — bei 1000-MA-Tenants Bottleneck. Erkennbar an conn-trace: bei Outlook-Tick steigt Pool-Auslastung auf 5 dauerhaft, längere Sub-Job-Queue-Time.

## Files

```
NEW    apps/tagea-backend/src/outlook-sync/outlook-sync.processor.ts
NEW    apps/tagea-backend/src/outlook-sync/outlook-sync-queue-registration.service.ts
NEW    apps/tagea-backend/src/outlook-sync/outlook-sync.processor.spec.ts (10 tests)
NEW    apps/tagea-backend/src/outlook-sync/outlook-sync-queue-registration.service.spec.ts (5 tests)

MOD    apps/tagea-backend/src/outlook-sync/services/outlook-sync-core.service.ts
         - Constructor entfernt tenantConnectionService
         - 12 DB-Methoden bekommen `manager: EntityManager` als required Param
MOD    apps/tagea-backend/src/outlook-sync/services/outlook-token-core.service.ts
         - Constructor entfernt tenantConnectionService
         - 9 DB-Methoden bekommen manager als required Param
MOD    apps/tagea-backend/src/outlook-sync/services/outlook-sync.service.ts
         - Wrapper injiziert TENANT_MANAGER, reicht an Core durch
MOD    apps/tagea-backend/src/outlook-sync/services/outlook-token.service.ts
         - Wrapper injiziert TENANT_MANAGER, reicht an Core durch
MOD    apps/tagea-backend/src/outlook-sync/services/outlook-sync-scheduler.service.ts
         - Split @Cron: cronTick (gated) + handleScheduledSync (public)
         - Reicht (await getWrite()).manager an coreService.runFullSync
MOD    apps/tagea-backend/src/outlook-sync/outlook-sync.module.ts
         - BullModule.registerQueue({ name: QUEUE_SYNC })
         - Provider Processor + Registration

MOD    apps/tagea-backend/src/outlook-sync/services/outlook-sync-core.service.spec.ts
         - Old DataSource-Mock-Setup ersetzt durch schlanken EntityManager-Mock
         - Smoke tests + early-return tests (3 Tests)
MOD    apps/tagea-backend/src/outlook-sync/services/outlook-token-core.service.spec.ts
         - Same simplification (4 Tests)
```

## Tests

| Suite | Tests | Coverage |
|---|---|---|
| `outlook-sync.processor.spec.ts` | 10 | unknown-job-name guard, tick enumerates tenants, fans out one sub-job per surviving config, shouldSkipSync gating (rate-limit / token_expired / disabled / hasSyncEnabled), tenant-error-isolation, user-sync runs core.runFullSync inside runInTenantContext, retryable-error throw, non-retryable-error swallow, concurrency env-honoring |
| `outlook-sync-queue-registration.service.spec.ts` | 5 | flag off → no-op, flag on → repeatable registered with correct pattern, OUTLOOK_SYNC_INTERVAL_MINUTES env override, stable jobId for re-init |
| `outlook-sync-core.service.spec.ts` | 3 (was 5) | instantiation, no-config early-return, no-token early-return |
| `outlook-token-core.service.spec.ts` | 4 (was ~10) | instantiation, isConfigured, getSyncConfig delegates to manager, SSO-user returns null in core path |
| Existing `outlook-sync-scheduler.service.spec.ts` | 8 | unchanged (still passes after split) |

**Total:** 831/831 ✓ (was 818, +13 net new — +15 Phase 3b — 7 obsolete + 5 simplified).

## Cutover Sequence (QS first)

1. **Deploy + soak with `FEATURE_OUTLOOK_QUEUE=false`** — 24h. Sicherstellen, dass der Refactor nichts kaputt macht. Alter `@Cron` läuft weiter.
2. **Beobachten:** keine Regression bei der existierenden Outlook-Sync-Funktion (manuelle Tests, Sentry-Logs).
3. **Flag flip:** `FEATURE_OUTLOOK_QUEUE=true`, optional `OUTLOOK_SYNC_WORKER_CONCURRENCY=5` (default), restart. Bull-Board zeigt repeatable `outlook-sync-tick` und Sub-Jobs.
4. **24h soak** — bull-board, conn-trace, Sentry, Microsoft-Graph-Throttle-Logs.
5. **Bei großem Tenant validieren** — Tick-Duration und Throughput; Concurrency anpassen falls nötig.
6. **Prod-Cutover:** be1 → 1h soak → be2 → 24h soak.

## Verification (manual on QS)

After flag flip:

1. **bull-board** → queue `sync` zeigt:
   - delayed `outlook-sync-tick` repeatable
   - completed `outlook-sync-tick` jobs alle 5 Min
   - completed `outlook-sync-user` Sub-Jobs (parallel laufend)
2. **Logs:** `[OutlookSyncProcessor] Tick completed in Xms: tenants=N enqueued=M skipped=K`. KEINE `[OutlookSyncSchedulerService] Scheduled sync completed` mehr.
3. **Functional:** echte Outlook-Termine vom Test-Tenant → 5 Min später als Tagea-Cache verfügbar (oder umgekehrt für Tagea→Outlook-Export).
4. **conn-trace:** kein dauerhafter Spike auf >15 mehr durch Outlook-Tick. Sub-Jobs sollten auf Pool-Slot 5 abgefangen sein (Pool-Bottleneck — siehe D6 Follow-up TODO).

## Rollback

`FEATURE_OUTLOOK_QUEUE=false`, restart. Alter `@Cron` resumiert. Pending sub-jobs in Redis können entweder verarbeitet werden (kein Schaden, sind harmlos) oder via einmaligem Skript drained werden.

## Estimated Effort (actual)

| Step | Hours |
|---|---|
| OutlookSyncCoreService refactor (manager-Param x 12 Methoden) | 2h |
| OutlookTokenCoreService refactor (x 9 Methoden) | 1.5h |
| Wrapper-Services (outlook-sync.service + outlook-token.service) anpassen | 0.5h |
| Scheduler-Service split + manager pass-through | 0.5h |
| Processor + Registration | 2h |
| Module wiring | 0.5h |
| Tests refactoring (existierende auf neuen Pattern, +Processor + Registration) | 3h |
| Spec amendment + diese Plan-Datei | 1h |
| **Total Net Engineering Time** | **~11h** |

## Open Risks

- **Connection-Pool-Bottleneck bei großen Tenants:** Sub-Job-Concurrency = 10 trifft auf SchedulerDataSourceService Pool max=5. Effektiv max 5 parallel. Mitigation: Pool-Size env-konfigurierbar machen (kleiner Follow-up, ~30 min).
- **Microsoft Graph Throttling:** parallele Sub-Jobs könnten App-throttle triggern. Mitigation: `OUTLOOK_SYNC_WORKER_CONCURRENCY` runterregeln. BullMQ retry mit exponential backoff.
- **Tx-Hold-Time inklusive HTTP-Call:** ein Sub-Job hält die DB-Connection für ~1-3s während Microsoft-Graph-Roundtrip. Bei `concurrency: 10` und Pool=15: alles gut. Bei Pool=5: Bottleneck.
- **Token-Refresh aus Worker-Context:** SSO-User können vom Worker NICHT refresht werden (`OutlookTokenCoreService.getAccessToken` returns null für `uses_sso_token`). Dieselbe Limitierung wie heute — Worker syncs nur Direct-OAuth-User. SSO-User syncs müssen weiterhin im Request-Pfad laufen (manuelle UI-Trigger).
- **Smartere Graph API (Phase 3c, deferred):** Subscriptions/Webhooks würden den Polling-Volumenfaktor um 100x reduzieren. Phase 3b's `runFullSync(tenantId, employeeId, manager)` ist API-kompatibel — Phase 3c kann darauf aufbauen.
