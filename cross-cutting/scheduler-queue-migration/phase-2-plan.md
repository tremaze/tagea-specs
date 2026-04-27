---
phase: 2 — Reminder Pilot
status: ⏳ Planned
owner: baumgart
created: 2026-04-25
last_updated: 2026-04-25
spec: ./spec.md
predecessor: Phase 1 (Foundation, done 2026-04-25)
---

# Phase 2 Plan — Appointment Reminder Migration

## TL;DR

We migrate `AppointmentReminderSchedulerService` from `@Cron(EVERY_MINUTE)` to a **single BullMQ repeatable job**, driven by a worker that uses `SchedulerDataSourceService.runInTenantContext()` for all tenant data access. The dispatcher's SQL query and idempotency table stay untouched.

This **departs from the spec's Phase 2 design** (event-driven enqueue at appointment-create with `delay`). The reason is documented below — short version: the team already had a job-table model and ripped it out 8 days ago because keeping it in sync with appointment + employee state changes was the source of every reminder bug. We will not re-introduce that pattern.

The spec's Phase 2 section will be amended in lockstep with this plan.

## Why we're departing from the spec

| Spec assumption (2026-04-25) | Reality on disk (also 2026-04-25) |
|---|---|
| "Reminders are enqueued at appointment + reminder creation time with `delay`" | Migration `20260417140000-ReplaceReminderJobsWithSentLog.ts` (8 days ago) **explicitly removed** the job-based system: *"Every state change in the system (appointment create/update/cancel, employee settings toggle) had to propagate into these tables — which was the source of every reminder bug we've been chasing."* |
| New table `appointment_reminders_sent` (plural) with `idempotency_key` UUID column | Existing table `appointment_reminder_sent` (singular), idempotency via `(appointment_id, employee_id, reminder_type, channel)` UNIQUE composite |
| `SendReminderJobPayload` per (appointment, participant, reminderType) job | Dispatcher SQL finds candidates per (appointment, employee), evaluates **live suppression rules** (absence, working-hours, employee opt-out) at dispatch time |
| Lazy-cancel checks `appointment.status === 'cancelled'` | Live SQL already filters cancelled, no-shows, deleted, opted-out, suppressed — encoded as JOINs/predicates, not as a worker re-check |

The spec's design solves Phase 2 against the wrong baseline. The current dispatcher is **already correct, idempotent, and resilient to state changes** — it just runs in the wrong execution model (per-tenant DS + per-replica cron).

The execution-model fix is what Phase 2 is actually about.

## Goals (Phase 2 only)

1. **Cut scheduler-induced PG connections from ~75 (per backend, oscillating) → ≤5 across both backends.** Per-tenant DataSources are no longer touched by the reminder scheduler path.
2. **One reminder tick per minute, globally.** Not "one per backend replica." BullMQ enforces single-owner per repeatable job.
3. **Zero observable behavior change.** Same reminders, same timing windows, same suppression rules, same idempotency guarantees, same logs.
4. **Reversible cutover.** Feature-flag gates which path runs at runtime; old `@Cron` path remains in code through Phase 5.

## Non-goals (Phase 2)

- Event-driven enqueue at appointment-creation time. (Reserved as a future optimization, only after the query-based path is proven and Phase 4 lands. Not an entry point for Phase 2.)
- Per-tenant fan-out (sub-job per tenant, parallel execution). (Sequential iteration matches current production behavior; parallelism is a Phase 4+ concern after we've measured headroom.)
- Removing the `@Cron` decorator. (Stays through Phase 5 cleanup behind the feature flag — kill-switch path.)
- Touching `appointment_reminder_sent` schema or the dispatcher's SQL. (No migration. No data backfill. The query is already correct.)

## Architecture: Before / After

### Before (today)

```
@Cron(EVERY_MINUTE) on be1                @Cron(EVERY_MINUTE) on be2
   │                                          │
   ▼                                          ▼
AppointmentReminderSchedulerService       AppointmentReminderSchedulerService
   │                                          │
   │ jitter 0–30s                             │ jitter 0–30s
   │ for tenant in active_tenants:            │ for tenant in active_tenants:
   │   getWrite(tenant.id)  ←──── per-tenant DS cache touched, kept warm
   │   dispatcher.dispatchForTenant(tenant)   │ (same, identical work)
   │                                          │
   ▼                                          ▼
~45 PG-Conns (per backend)                ~45 PG-Conns (per backend)
                              ┌── ~90 PG-Conns total, identical work duplicated
```

### After (Phase 2)

```
                    BullMQ repeatable job
                  "reminders:dispatch-tick"
                  pattern: '*/1 * * * *'
                  jobId:   'dispatch-tick-recurring'
                              │
                              │ Redis enforces single owner
                              ▼
              ┌──────────────────────────────┐
              │ ReminderProcessor (worker)   │
              │ on be1 OR be2 (whichever     │
              │ pulls first this minute)     │
              └──────────────┬───────────────┘
                             │
                             ▼
                AppointmentReminderDispatcherService
                             │
                             │ for tenant in active_tenants:
                             │   schedulerDs.runInTenantContext(tenant.id, async (manager) => {
                             │     await manager.query(<existing dispatcher SQL>, ...);
                             │     // …existing dispatch logic…
                             │   });
                             ▼
                  Shared SchedulerDataSource
                  extra.max = 5
                  SET LOCAL search_path per tx
                             │
                             ▼
                       Postgres-LB → Main

  Total: ≤5 PG-Conns across both backends, one tick per minute globally.
```

## Detailed Design

### Code changes

#### 1. `AppointmentReminderDispatcherService` — accept `EntityManager` instead of `DataSource`

The dispatcher currently takes `tenant: Tenant` and internally calls `tenantConnectionService.getWrite(tenant.id)`. We change the contract to accept the `EntityManager` from the caller — the worker is responsible for opening the tenant context.

```typescript
// Before
async dispatchForTenant(tenant: Tenant): Promise<DispatchResult> {
  const dataSource = await this.tenantConnectionService.getWrite(tenant.id);
  // … uses dataSource.query(...) …
}

// After
async dispatchForTenant(
  tenant: Tenant,
  manager: EntityManager,
): Promise<DispatchResult> {
  // … uses manager.query(...) …
}
```

All internal `dataSource.query(...)` and `findCandidates(dataSource, ...)` calls become `manager.query(...)` / `findCandidates(manager, ...)`. No SQL changes.

The old `@Cron` path (kept behind feature flag) wraps the call in its own `tenantConnectionService.getWrite(...)` to obtain a `DataSource`, then calls `dataSource.manager` to satisfy the new signature. Both paths use the same dispatcher signature; only the source of the manager differs.

#### 2. New `ReminderProcessor` (BullMQ worker)

Lives at `apps/tagea-backend/src/appointment-reminders/reminder.processor.ts`:

```typescript
@Processor(QUEUE_REMINDERS, { concurrency: 1 })
export class ReminderProcessor extends WorkerHost {
  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly schedulerDs: SchedulerDataSourceService,
    private readonly dispatcher: AppointmentReminderDispatcherService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== 'dispatch-tick') return;

    const started = Date.now();
    const metaDb = await this.tenantConnectionService.getMetaDatabase();
    const tenants = await metaDb
      .getRepository(Tenant)
      .find({ where: { status: 'active' } });

    let totalPush = 0, totalEmail = 0, totalPushFail = 0, totalEmailFail = 0;

    for (const tenant of tenants) {
      try {
        const result = await this.schedulerDs.runInTenantContext(
          tenant.id,
          (manager) => this.dispatcher.dispatchForTenant(tenant, manager),
        );
        totalPush       += result.pushSent;
        totalEmail      += result.emailSent;
        totalPushFail   += result.pushFailed;
        totalEmailFail  += result.emailFailed;
      } catch (e) {
        this.logger.error(`Reminder dispatch failed for tenant ${tenant.id}: ${...}`);
      }
    }

    // Same log line as current scheduler — keeps log greps + alerts working.
    const duration = Date.now() - started;
    if (totalPush || totalEmail || totalPushFail || totalEmailFail) {
      this.logger.log(
        `Reminder tick completed in ${duration}ms: push=${totalPush} email=${totalEmail} pushFail=${totalPushFail} emailFail=${totalEmailFail}`,
      );
    } else {
      this.logger.debug(`Reminder tick completed in ${duration}ms: idle`);
    }
  }
}
```

Key choices:
- **`concurrency: 1`** — one tick processed at a time per worker. Two workers across replicas could in theory both grab a tick, but BullMQ's repeatable-job mechanism (delayed-set + claim-on-tick) makes simultaneous double-fire extremely unlikely. Even if it happens, the `appointment_reminder_sent` UNIQUE constraint guarantees idempotency at the data layer.
- **`removeOnComplete: { age: 3600 }`** override — successful ticks discard within 1h. We don't need 24h of successful reminder ticks polluting bull-board.
- **`attempts: 3`** (BullMQ default we set in `QueueModule`) — if tenant iteration crashes, BullMQ retries the whole tick. Idempotency table protects against double-send.
- **No per-tenant sub-jobs.** Sequential iteration matches today's behavior. We log a TODO for future per-tenant fan-out if dispatcher latency becomes a problem (currently sub-second per tenant).

#### 3. New `ReminderQueueRegistration` (registers the repeatable job at startup)

Lives at `apps/tagea-backend/src/appointment-reminders/reminder-queue-registration.service.ts`:

```typescript
@Injectable()
export class ReminderQueueRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(ReminderQueueRegistrationService.name);

  constructor(
    @InjectQueue(QUEUE_REMINDERS) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.FEATURE_REMINDER_QUEUE !== 'true') {
      this.logger.log('FEATURE_REMINDER_QUEUE=false — repeatable job NOT registered');
      return;
    }
    await this.queue.add(
      'dispatch-tick',
      {},
      {
        repeat: { pattern: '*/1 * * * *' },
        jobId: 'dispatch-tick-recurring', // dedupes on worker restarts
      },
    );
    this.logger.log('FEATURE_REMINDER_QUEUE=true — repeatable job registered');
  }
}
```

Idempotent: re-registering the same `jobId` is a no-op in BullMQ (same scheduler-key in Redis).

When the flag is later flipped from `true` → `false` (rollback), this code path doesn't run — but the previously-registered repeatable schedule **persists in Redis**. We'll add a one-line `removeRepeatable(...)` call to the rollback runbook (not automated; manual decision).

#### 4. `AppointmentReminderSchedulerService` — gate by feature flag

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async handleTick(): Promise<void> {
  if (process.env.FEATURE_REMINDER_QUEUE === 'true') {
    return; // BullMQ owns ticking now
  }
  // … existing implementation …
}
```

Same module, same DI, no service deletion. The class survives until Phase 5 cleanup as the kill-switch fallback.

#### 5. `AppointmentRemindersModule` wiring

```typescript
@Module({
  imports: [
    TenantsModule,
    PushNotificationsModule,
    EmailModule,
    AuthModule,
    BullModule.registerQueue({ name: QUEUE_REMINDERS }),
  ],
  controllers: [AppointmentRemindersAdminController],
  providers: [
    AppointmentReminderDispatcherService,
    AppointmentReminderSchedulerService,
    ReminderProcessor,
    ReminderQueueRegistrationService,
  ],
})
export class AppointmentRemindersModule {}
```

Note: `BullModule.registerQueue` here makes `@InjectQueue(QUEUE_REMINDERS)` resolvable in the module. The queue itself is already registered globally by `QueueModule`, so this is just NestJS DI plumbing.

### Tests

| Test | What it covers | Where |
|---|---|---|
| Existing dispatcher unit tests | Adapt to new `EntityManager` parameter | `appointment-reminders/*.spec.ts` |
| `ReminderProcessor` unit | Calls dispatcher per tenant, accumulates totals, swallows tenant errors | `reminder.processor.spec.ts` (new) |
| `ReminderQueueRegistrationService` unit | No-op when flag off; registers when flag on | `reminder-queue-registration.service.spec.ts` (new) |
| Phase 1 isolation tests | Already cover the `runInTenantContext` security boundary | `queue/scheduler-data-source.service.spec.ts` (existing, no changes) |

Manual QS verification (no automated E2E for Phase 2):
1. Set `FEATURE_REMINDER_QUEUE=true` on QS, restart.
2. Seed: create an appointment due in 1h05m for an opted-in employee.
3. Observe bull-board: `dispatch-tick` job appears every minute.
4. At T-60min: query `appointment_reminder_sent` for the row, observe push + email arriving.
5. Disable flag, restart, observe `@Cron` path resumes (verify by appointment 24h test the next day).
6. `cat /var/log/conn-trace.csv | tail -100` — connection count should be flat ~10–15, no minute-tick oscillation.

### Cutover (per-replica)

Per the spec's per-phase pattern:

1. **Code merge to develop, deploy to QS** with `FEATURE_REMINDER_QUEUE=false`. Both code paths exist; only `@Cron` runs. Soak ≥24h.
2. **Flip QS flag to `true`**, restart backend, soak ≥24h. Watch:
   - bull-board (`/admin/queues`): no failed jobs, queue depth stable, repeatable schedule visible.
   - `conn-trace.csv`: max drops from ~75 to ~10–20.
   - Sentry: zero new reminder-related errors.
   - Logs: same `Reminder tick completed in Xms: …` log lines as before.
3. **Deploy to Prod be1 only**, flag still `false`. Soak 1h.
4. **Flip Prod be1 flag to `true`**, restart be1. **be2 still on `@Cron` path.** Soak 1h.
   - Critical observation: the `@Cron` on be2 will see `FEATURE_REMINDER_QUEUE=false` (its own env), so it will dispatch reminders. **be1 will ALSO process the BullMQ tick.** Both paths active simultaneously → potential double-send.
   - **Mitigation:** the `appointment_reminder_sent` UNIQUE constraint protects against double-send at the data layer. The first writer wins; the second sees `ON CONFLICT DO NOTHING` (already in the dispatcher's `recordSent`).
   - **What does double-fire look like in observability?** A small bump in candidate counts during the dual-active window. We tolerate it for the ≤1h overlap.
5. **Flip Prod be2 flag to `true`**, restart be2. Now both backends are on BullMQ; `@Cron` is dormant on both. Soak ≥24h.
6. **If clean: declare Phase 2 complete.** Old code stays in place; flag stays as kill-switch.

### Rollback

- **Same flow in reverse.** Set `FEATURE_REMINDER_QUEUE=false` on the affected backend(s), restart. `@Cron` resumes.
- **Repeatable job in Redis** persists across the rollback. No harm: with the flag off, the worker also doesn't process — but the repeatable schedule still emits delayed jobs into the queue. Action: run `await queue.removeRepeatable('dispatch-tick', { pattern: '*/1 * * * *' })` from a one-shot script if rollback is permanent. (For temporary rollback, leave it — it'll resume cleanly when the flag flips back.)
- **Worst case:** flag flip fails (env-var misconfigured). The two paths' idempotency table protects user-visible behavior — the worst we'd see is a doubled internal log line.

## Risks (Phase 2-specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BullMQ repeatable job registers but worker doesn't pick it up (queue depth builds) | Low | Medium | `concurrency: 1` is set on the processor; `dispatch-tick-recurring` jobId dedupes; bull-board surfaces unprocessed jobs immediately. Pre-check in QS soak (≥24h). |
| Dual-active window during Prod be1↔be2 cutover causes double-dispatch | Medium | Low (visible only as small bumps in send counts) | UNIQUE index on `appointment_reminder_sent` protects user-visible behavior. Window is ≤1h. Document the bump as expected. |
| `runInTenantContext` adds latency vs. the warmed per-tenant pool | Low | Low | Each tenant gets one `BEGIN`+`SET LOCAL`+queries+`COMMIT` per minute — adds ~5–10ms per tenant. With 45 tenants: +225–450ms total per tick. Current ticks already run in 1–3s; well within margin. |
| Repeatable schedule survives feature-flag flip-back, leaks zombie work | Low | Low | Documented in rollback section; one-line `removeRepeatable` available. |
| BullMQ worker crashes mid-tick, no automatic re-run for that minute | Low | Negligible | Next minute's tick re-evaluates the live SQL — late-by-60s reminder, not lost. |
| Two workers (be1+be2) race on the same tick despite BullMQ ownership | Very Low | Negligible | Same UNIQUE-constraint backstop as the dual-active window risk. |

## Definition of Done

- ✅ Code merged to develop with `FEATURE_REMINDER_QUEUE=false` default.
- ✅ All existing dispatcher tests pass.
- ✅ New processor + registration-service unit tests pass.
- ✅ `nx test tagea-backend` green; `nx build tagea-backend` green.
- ✅ QS deployed with flag=false, smoke-tested 24h, no regressions.
- ✅ QS deployed with flag=true, soaked 24h:
  - bull-board shows clean repeatable schedule + no failed jobs
  - `conn-trace.csv` shows max ≤25 (down from ~75 baseline)
  - Sentry: zero new reminder errors
  - Manual reminder test (push + email) passes
- ✅ Prod cutover (be1 → be2) executed per checklist, soaked 24h, no regressions.
- ✅ `memory/project_scheduler_queue_migration.md` updated: Phase 2 status DONE.
- ✅ Spec amended: Phase 2 section reflects query-based + BullMQ design (not event-driven).

## Open Decisions (resolve before coding)

These are the actual decisions that need a yes/no before implementation begins. Please confirm or correct:

1. **D1 — Departure from spec:** Implement Phase 2 as query-based + BullMQ driver (this plan), NOT as event-driven enqueue (spec). Spec gets amended in the same PR.
   _Recommendation: yes — re-introducing the trigger model is the bug source the team just removed._

2. **D2 — Concurrency:** `ReminderProcessor` runs with `concurrency: 1`. Sequential tenant iteration inside the tick. No fan-out sub-jobs in Phase 2.
   _Recommendation: yes — matches today's behavior; preserves "one slow tenant doesn't crash a parallel sibling" property; Phase 4 is the right place to introduce per-tenant fan-out._

3. **D3 — Feature flag scope:** `FEATURE_REMINDER_QUEUE` is a backend env-var (process-level), not per-tenant. Set via `update-backend` SSH script, applies on container restart.
   _Recommendation: yes — phase rollout is global, not per-tenant; tenant-level toggling is unnecessary complexity._

4. **D4 — Old `@Cron` retention:** `AppointmentReminderSchedulerService` stays in code through Phase 5. The class is gated by the env check, returns early when the flag is on.
   _Recommendation: yes — kill-switch path; deletion happens in Phase 5 cleanup PR._

5. **D5 — Observability:** Reminder tick logs the same German-formatted line as today (`Reminder tick completed in Xms: push=N email=M …`). bull-board mounted at `/admin/queues` is the secondary surface.
   _Recommendation: yes — preserves existing dashboards/log alerts; bull-board adds visibility, not replaces logs._

## Estimated Effort

| Step | Hours |
|---|---|
| Spec amendment (Phase 2 section rewrite) | 0.5 |
| Dispatcher refactor (`DataSource` → `EntityManager`) + adapt tests | 2 |
| `ReminderProcessor` + unit tests | 2 |
| `ReminderQueueRegistrationService` + unit tests | 1 |
| Module wiring + `@Cron` flag-gate | 0.5 |
| QS deploy + 24h soak (flag off) | passive 24h, ~1 active |
| QS flag flip + 24h soak | passive 24h, ~1 active |
| Prod cutover (be1 → be2) + 24h soak | passive 24h, ~1 active |
| Memory + docs update | 0.5 |
| **Net engineering time** | **~8h** |
| **Calendar time including soaks** | **~5 days** |

## Files touched (anticipated)

```
apps/tagea-backend/src/appointment-reminders/appointment-reminder-dispatcher.service.ts   [signature change]
apps/tagea-backend/src/appointment-reminders/appointment-reminder-scheduler.service.ts    [flag gate]
apps/tagea-backend/src/appointment-reminders/appointment-reminders.module.ts              [add providers]
apps/tagea-backend/src/appointment-reminders/reminder.processor.ts                        [NEW]
apps/tagea-backend/src/appointment-reminders/reminder-queue-registration.service.ts       [NEW]
apps/tagea-backend/src/appointment-reminders/reminder.processor.spec.ts                   [NEW]
apps/tagea-backend/src/appointment-reminders/reminder-queue-registration.service.spec.ts  [NEW]
specs/cross-cutting/scheduler-queue-migration/spec.md                                     [Phase 2 section rewrite]
specs/cross-cutting/scheduler-queue-migration/phase-2-plan.md                             [THIS FILE]
```

No migrations. No data backfill. No new entities. No public API changes.
