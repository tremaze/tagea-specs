---
phase: 3 — Article Publishing
status: ✅ Code done 2026-04-26
owner: baumgart
created: 2026-04-26
last_updated: 2026-04-26
spec: ./spec.md
predecessor: Phase 2 (Reminder Pilot, code done + soaking)
---

# Phase 3 Plan — Article Scheduler Migration (Event-driven + Fan-out)

## TL;DR

The per-minute `@Cron(EVERY_MINUTE)` in `article-scheduler.service.ts` is replaced by **event-driven enqueue at status transitions** plus a BullMQ worker that runs the same atomic `UPDATE … RETURNING` and fans out embedding + notification sub-jobs. Hidden behind `FEATURE_ARTICLE_QUEUE` env flag.

Different design decision from Phase 2 — see "Why event-driven here" below.

## Why event-driven here (and not for Reminders)

Phase 2 explicitly rejected event-driven enqueue for reminders because the team migrated AWAY from a job-table-based reminder system on 2026-04-17 — the bug source was keeping that table in sync with appointment + employee state. Three properties of Articles make event-driven safe here:

| Aspect | Reminder | Article |
|---|---|---|
| State machine | Complex (cancel, reschedule, opt-in, suppression rules) | Trivial: `scheduled → published`. Single-step. |
| Idempotency lives | In a separate table (`appointment_reminder_sent`) with UNIQUE index — multiple writes | In the SAME `UPDATE … WHERE status='scheduled' … RETURNING *` statement |
| Stale-job risk | High — an obsolete job can't self-check | **Zero** — UPDATE finds 0 rows when article was reverted/deleted. Lazy-cancel by design. |

Event-driven also gives **sub-minute precision**: an article scheduled for 14:30:30 publishes at 14:30:30 instead of waiting for the next 14:31 tick.

## Design Decisions (resolved)

### D1 — Event-driven enqueue at status transitions

`ArticlesService.create()`, `update()`, `remove()` call into `ArticleQueueProducerService` whenever the article enters/leaves/changes-time-while-in `status='scheduled'`. The producer is a **no-op when `FEATURE_ARTICLE_QUEUE` is unset**, so callers invoke unconditionally — no flag-checks scattered through service code.

### D2 — Sub-jobs for embedding + notification (fan-out)

After the `publish-article` job's UPDATE successfully flips status (`rowCount > 0`), the worker enqueues two follow-up jobs in the same queue:

- `generate-article-embedding` — for KNOWLEDGE-typed articles, only when the tenant has `aiChat.enabled=true`
- `send-article-notification` — for NEWS-typed articles

Each runs in its own `runInTenantContext` and has independent retries (BullMQ `attempts: 3`). A Mistral hiccup doesn't undo the publish.

### D3 — Stable jobId `publish-${articleId}`

Producer's three methods leverage BullMQ jobId-dedup:
- `enqueuePublish` adds with the stable id; double-add is no-op while the job is queued
- `replaceJob` removes-then-adds with the same id (used when `scheduled_publish_date` is changed mid-flight)
- `removeJob` removes by id; idempotent (silently succeeds if no job exists)

### D4 — Defensive `is_deleted = false` in worker UPDATE

The original scheduler's UPDATE didn't filter on `is_deleted`. With soft-delete being possible during the delay window, we add `AND is_deleted = false` to the worker's UPDATE — both to prevent reviving deleted articles, and as belt-and-suspenders to the producer's `removeJob` call in `articles.service.remove()`.

### D5 — Old `@Cron` retained behind flag

`ArticleSchedulerService.cronTick()` returns early when `FEATURE_ARTICLE_QUEUE=true`. `handleScheduledPublishing()` stays public for admin/manual triggers (`triggerPublishing()` in the existing class). Cleanup happens in Phase 5.

## Files

```
NEW    apps/tagea-backend/src/articles/article.processor.ts
NEW    apps/tagea-backend/src/articles/article-queue-producer.service.ts
NEW    apps/tagea-backend/src/articles/article.processor.spec.ts (8 tests)
NEW    apps/tagea-backend/src/articles/article-queue-producer.service.spec.ts (11 tests)

MOD    apps/tagea-backend/src/articles/services/article-scheduler.service.ts
         - Split @Cron handler: cronTick (gated) + handleScheduledPublishing (public)
MOD    apps/tagea-backend/src/articles/articles.service.ts
         - Inject ArticleQueueProducerService
         - create(): enqueuePublish on SCHEDULED-with-publish_date
         - update(): snapshot wasScheduled + previousScheduledAt; transition diff after save
         - remove(): removeJob if article was scheduled
MOD    apps/tagea-backend/src/articles/articles.module.ts
         - BullModule.registerQueue({ name: QUEUE_ARTICLES })
         - Register ArticleProcessor + ArticleQueueProducerService
```

## Tests

### `article-queue-producer.service.spec.ts` — 11 tests

Feature-flag off branch:
1. `enqueuePublish` no-op
2. `replaceJob` no-op
3. `removeJob` no-op

Feature-flag on branch:
4. `enqueuePublish` with future `publishAt` adds job, delay calculated correctly
5. `enqueuePublish` with past `publishAt` clamps delay to 0
6. `replaceJob` removes existing then adds new with same jobId
7. `removeJob` is idempotent when no job exists (`getJob` returns null)
8. `removeJob` swallows errors from `getJob`/`remove` (active/done jobs throw — benign)
9. `enqueueGenerateEmbedding` queues sub-job with correct name + payload
10. `enqueueSendNotification` queues sub-job with correct name + payload

### `article.processor.spec.ts` — 8 tests

11. Unknown job names ignored without touching DB
12. `publish-article` runs UPDATE inside `runInTenantContext`, fans out embedding for KNOWLEDGE
13. `publish-article` fans out notification for NEWS (not embedding)
14. `publish-article` no-op when UPDATE returns 0 rows
15. `publish-article` skips embedding fan-out when AI Chat disabled
16. `publish-article` re-throws tenant errors so BullMQ retries
17. `generate-article-embedding` calls embedding + chunks inside `runInTenantContext`
18. `send-article-notification` no-op when article disappeared from tenant DB
19. `send-article-notification` calls `sendToAudience` with correct manager + audience args

**Total:** 19 new tests. `nx test tagea-backend` 818/818 ✓ (was 799, +19).

## Cutover Sequence (QS first)

1. **Deploy + soak with flag off** — 24h. Sicherstellen, dass der Refactor nichts kaputt macht. Alter `@Cron` läuft weiter, Producer ist no-op.
2. **Flag flip:** `FEATURE_ARTICLE_QUEUE=true`, restart. Bull-board zeigt nun `articles` queue mit delayed publish-jobs.
3. **Backfill (optional but recommended):** Beim ersten Flag-Flip gibt es bereits SCHEDULED articles, für die kein Job in BullMQ existiert. Ein einmaliges Skript `tools/backfill-scheduled-articles.ts` enumeriert sie und ruft `producer.enqueuePublish` auf. Idempotent dank jobId-dedup. **Wichtig:** ohne Backfill würden bestehende SCHEDULED articles erst beim nächsten manuellen Trigger oder beim nächsten Update publiziert — der alte `@Cron` ist dann ja gegated.
4. **24h soak:** bull-board, conn-trace, Sentry beobachten. Erwartet: kein 38er-Spike-Block mehr im conn-trace.
5. **Prod cutover:** be1 mit Flag an, 1h soak, dann be2, 24h soak. Atomic UPDATE schützt das brief Dual-Active-Window.

## Verification (manual)

After flag flip on QS:

1. **bull-board** (`/admin/queues`): queue `articles` zeigt
   - delayed `publish-article` jobs (von neuen schedulings)
   - completed `publish-article` jobs nach Trigger
   - completed `generate-article-embedding` und `send-article-notification` Sub-Jobs
2. **Logs:** `[ArticleProcessor] Published article=… tenant=…` Lines. KEINE `[ArticleSchedulerService] Article scheduler completed` mehr.
3. **Manual functional test:**
   - Create Article via UI/API: `status='scheduled'`, `scheduled_publish_date = NOW + 2 min`
   - Bull-board zeigt Job `publish-<articleId>`, delayed
   - In ~2 min: Job completed, fan-out Jobs entstanden
   - DB: `status='published'`, `published_at` gesetzt
   - Embedding update für KNOWLEDGE-Article (check `articles.embedding NOT NULL`)
   - Notification beim Recipient angekommen
4. **Edge: replace** — während scheduled, ändere `scheduled_publish_date`. Bull-board: alter Job removed, neuer mit neuer delay scheduled.
5. **Edge: cancel** — ändere `status` zurück auf `draft`. Bull-board: Job removed; falls noch in flight, UPDATE findet 0 Rows, no-op log.
6. **conn-trace:** `tail -200 /var/log/conn-trace.csv | awk -F, '{print $2}' | sort -n | uniq -c` — der 38er-Block ist weg, max ~10–15.

## Rollback

`FEATURE_ARTICLE_QUEUE=false`, restart. Alter `@Cron` resumiert. Pending delayed BullMQ jobs persistieren in Redis und feuern wenn das Flag wieder an ist. Atomic UPDATE schützt vor Doppel-Publish.

Bei permanentem Rollback: `tools/cleanup-article-jobs.ts` ruft `queue.drain()` und `queue.clean()` für QUEUE_ARTICLES auf. Nicht im normalen Pfad nötig.

## Definition of Done

- ✅ Code merged to develop with `FEATURE_ARTICLE_QUEUE=false` default
- ✅ All existing tests pass (nx test tagea-backend 818/818)
- ✅ New processor + producer unit tests pass (19/19)
- ✅ `nx build tagea-backend` green; ESLint clean for changed files
- ⏳ QS deployed flag=false, soaked 24h, no regressions
- ⏳ QS flag=true, soaked 24h: bull-board clean, conn-trace 38-block gone, no Sentry errors, manual reminder test passes
- ⏳ Prod cutover (be1 → be2), soaked 24h, no regressions
- ⏳ Memory updated: Phase 3 status DONE
- ✅ Spec amended: Phase 3 design recorded

## Estimated Effort

| Step | Hours |
|---|---|
| ArticleQueueProducerService + tests | 2h |
| ArticleProcessor (publish + 2 sub-job handlers) + tests | 3h |
| ArticlesService hook-up (transition detection) | 1.5h |
| ArticleSchedulerService split | 0.5h |
| Module wiring | 0.5h |
| Spec amendment + this plan | 0.5h |
| **Net engineering time (actual)** | **~8h** |
| **Calendar time inkl. QS-Soak** | **~3 Tage** |

## Open Risks

- **Backfill of existing SCHEDULED articles**: ohne ein einmaliges Backfill-Skript würden bestehende SCHEDULED articles auf QS nach Flag-Flip nicht automatisch publiziert (alter Cron ist gated, Producer war beim Anlegen noch nicht aktiv). Mitigation: Skript `tools/backfill-scheduled-articles.ts` schreiben + auf QS einmal vor Flag-Flip laufen lassen. Idempotent via jobId-dedup. **TODO** — wird im Cutover-Schritt erstellt.
- **Sub-Job concurrency vs Mistral rate limits**: bei Backfill könnten 100 Articles parallel die Mistral-API hämmern. Aktuell `concurrency: 5` für die ganze QUEUE_ARTICLES — deckelt das. Falls weiterhin ein Problem: separate Queue für Embeddings mit niedrigerer Concurrency.
- **Race condition bei replace**: zwei Backends ändern `scheduled_publish_date` simultan. Beide rufen `replaceJob` auf — die remove/add Sequenz kann interleaven. Worst-case: beide Jobs landen, BullMQ jobId-dedup behält den letzten — der mit unterschiedlicher delay. Atomic UPDATE bei publish-time entscheidet. Akzeptiert.
