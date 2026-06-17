# Design: Past-Series-Occurrence Materialisierung für Completion-Tasks

> **Status:** ✅ Implementiert & verifiziert 2026-06-14 (uncommitted) — Phasen 1–4 + 1b grün
> **Owner:** baumgart
> **Erweitert:** [appointment-completion-tasks](./spec.md)
>
> **Umsetzung (alle uncommitted):**
> - **Phase 1** Job-sicherer `AppointmentMaterializationCoreService` (manager-param; `computeObligation`, `materializePastObligations`, `FOR UPDATE`-Anker-Lock, `setting`-Carry).
> - **Phase 2** BullMQ: `QUEUE_MATERIALIZATION`, Producer (repeatable Tick gegated durch `FEATURE_MATERIALIZATION_QUEUE`, `enqueueBackfill`/`enqueueIncremental`), Processor (`@Processor`, fan-out + per-Tenant, lookback `BACKFILL=24M`/`INCR=7d`, cap 2000/Anker).
> - **Phase 3** Super-Admin `POST /super-admin/appointment-materialization/backfill/:tenantId` (404-Tenant-Guard, 202 Accepted) + funktionaler E2E `appointment-series-materialization.spec.ts`.
> - **Phase 4** Hands-on: E2E hittet echtes `GET /institutions/:id/tasks` als Berater → materialisierte Occurrences erscheinen als Aufgaben.
> - **Phase 1b (B1/B2 aufgelöst)** Approval-Link-Vererbung via neuem singleton `AppointmentApprovalLinkCoreService` (manager-param `linkApproval`/`recalculateBudget`/`resolvePriceWithManager`); `createLink` + `ApprovalBudgetService.recalculateBudget` delegieren dorthin (Single Source of Truth, 50 Bestands-Tests grün). Materialisierte (scheduled) Occurrences erben die Bewilligung **uncounted** → Budget erst bei „teilgenommen".
> - **Tests:** 72 BE-Unit (4 Suites) + 1 E2E (Materialisierung→Tasks→Link-Vererbung→Idempotenz→404) grün. Code-Review nach jeder Phase; gefundener FK-Bug (`created_by_employee_id ?? ''` → `null`) gefixt.
> - **Offen:** RSVP-Override-Carry-over (B2) im Job-Core noch NICHT umgesetzt — Override-Tisch ist staff-only, Client-Status = Anker-Default, daher für die Completion-Obligation unkritisch (siehe Recipe Schritt 4).

## Problem
Die Completion-Tasks (`__response_status`/`__documentation`) hängen an `appointments.invalid_fields` — **zeilen-basiert**. Serien nutzen das Anker-Pattern: Anker = echte Zeile (`recurrence_rule`); Occurrences sind **virtuell** (`is_materialized=false`, vom Expander in-memory erzeugt, nicht persistiert); per-Occurrence-RSVP liegt im Override-Tisch `appointment_occurrence_responses`. → Vergangene virtuelle Occurrences sind für Tasks **und** Report unsichtbar. Köln (AWO Sommerberg) nutzt für FLS-Fallarbeit **Serien** → unbearbeitete vergangene Sitzungen müssen zu Aufgaben werden (Doku nicht vergessen).

## Ansatz (entschieden)
**Bounded lazy materialization**, gegated durch `appointment_completion_requirements` (Opt-in pro Template; Tenants ohne Requirements = No-op). Zwei Mechanismen:
1. **Einmaliger Backfill bei Aktivierung** — pro completion-pflichtigem Termin-Template, pro Anker: alle vergangenen Occurrences mit **offener Pflicht** materialisieren (gebatcht/gedrosselt).
2. **Täglicher Inkrement-Sweep** — nur seit letztem Lauf vergangene Occurrences (kleines Fenster, idempotent).

Beide rufen `materializeFromAnchor` (Wiederverwendung). „Vergangen?" via `end_datetime <= now()` (Cron-getrieben, kein Per-Occurrence-Timer).

## Materialisierungs-Recipe (pro Occurrence) — Pflicht-Constraints
Aus dem Mechanik-Review (`materializeFromAnchor` @ appointments.service.ts:3260+):
1. **Enumerieren** via `seriesGenerator.generateOccurrencesFromAnchor(anchor, {start: lookback, end: now, maxOccurrences})` → wall-clock-korrigierte Instants (Europe/Berlin). Kanonischer Key = `seriesGenerator.occurrenceKey(start)` (UTC YYYY-MM-DD). **Nie** `setHours(0,0,0,0)` lokal.
2. **Skip** wenn:
   - Datum in `anchor.excluded_dates` (Expander filtert eh, aber explizit prüfen).
   - Anker **superseded** (`notSupersededAnchorSql` / Range nach Split) → nicht materialisieren (gehört zum neuen Anker).
   - Datum = **Anker-Datum selbst** (der Anker *ist* die erste Occurrence → sonst Doppel-Zeile + Doppel-Budget).
   - Datum bereits materialisiert (`anchor_appointment_id`+`occurrenceKey`-Dedup; pro Anker einmal die Kinder laden, lokal abgleichen — kein N+1).
3. **Offene-Pflicht-Filter** (sonst keine Zeile): effektiver Status = RSVP-Override (`appointment_occurrence_responses`) ∪ Anker-Default. Materialisieren nur wenn:
   - Status `scheduled` (→ Status-Pflicht), **oder**
   - Status „took place" (≠scheduled, ∉excluded) **und** keine Doku (→ Doku-Pflicht).
   - **abgesagt/excluded → NICHT materialisieren** (keine Pflicht).
4. **RSVP-Override übernehmen** (🔴 High): `materializeFromAnchor` setzt heute den **Anker-Default**-Status, liest den Override-Tisch NICHT (vgl. `getVirtualOccurrence` Z.3215, das ihn anwendet). → Backfill muss `appointment_occurrence_responses` pro (anchor, date) laden und den materialisierten Teilnehmer-Status **nachsetzen** (sonst feuert Rule A fälschlich für bereits beantwortete Occurrences).
5. **Danach** `update_appointment_validity` (Trigger feuert eh beim Insert) → Sentinels fließen in `invalid_fields`.

## Blast-Radius-Register (verifiziert)
| # | Risiko | Schwere | Mitigation |
|---|--------|---------|-----------|
| B1 | ~~Approval-Budget-Doppelzählung~~ **AUFGELÖST**: Backfill **kopiert die Approval-Links** (Anker→Occurrence), damit die Bewilligungs-Verknüpfung nicht vergessen wird. `counted_towards_budget` folgt dem Status: bei materialisierten `scheduled`-Occurrences = **false** (kein Budget-Verbrauch); erst wenn die Beraterin „teilgenommen" setzt, flippt `handleAppointmentStatusChange` das Flag → Budget verbraucht (normaler, korrekter Zeitpunkt). **Kein retroaktiver Verbrauch, keine Doppelzählung**, solange (a) Anker-Datum nicht als Kind materialisiert wird und (b) bereits materialisierte Daten dedupliziert werden — beides im Recipe. | ✅ aufgelöst | Links kopieren (Standard `copyApprovalLinksFromAnchor`); Anker-Datum skippen + Dedup (Recipe Schritt 2). Override='completed' → Link counted=true (korrekt, Sitzung fand statt). |
| B2 | **RSVP-Override nicht übernommen** → bereits beantwortete Occurrences werden als `scheduled` getasked. | 🔴 high | Recipe Schritt 4. |
| B3 | **Open-ended Serie ohne UNTIL/COUNT**: Generator hat keinen Lookback-Cap → „ganzer Zeitraum" kann Tausende enumerieren. | 🔴→✅ | **Cap 24 Monate** (Default, ≥ Serienbeginn) + `maxOccurrences`-Guard im Backfill-Request (entschieden). |
| B4 | **Trigger-Last beim Bulk-Insert**: jede Termin- *und* Teilnehmer-Insert feuert `update_appointment_validity` (N×M); plus Anker-`excluded_dates`-Update pro Occurrence feuert Anker-Trigger. | 🟡 med | Anker-`excluded_dates` **einmal** nach Batch updaten (raw, trigger-frei); Teilnehmer als Multi-Row-Insert; ggf. `invalid_fields`-Recompute nach dem Batch gebündelt. |
| B5 | **`cases.invalid_appointments` ohne Zeit-Gate** springt retroaktiv hoch (0 → viele). | 🟡 med | Gewollt (Backlog sichtbar); dokumentieren. |
| B6 | **Report/KPI/Aggregation** zeigen plötzlich die materialisierten Zeilen (Leistungsnachweis-Zeilen, Schwangerschaftsberatungs-KPI, „nach Monat"-Aggregationen). | 🟡 med | Gewollt = vollständiger; in Release-Notes; optional `is_materialized`-Filter/Label. |
| B7 | **Doppelanzeige Kalender** (materialisiert + virtuell). | 🟢 low | Dedup existiert (`buildMaterializedKeysSet` Z.8671 ↔ `virtualId` Z.8597, beide UTC-Datumskey). Regressions-Test an Mitternachts-/TZ-Grenze. |
| B8 | **Reminder/Notifications** für historische Inserts. | 🟢 low | `create()` sendet keine Notifications; Reminder sind durch `created_at<=start-lead` gegated (historisch → false). `created_at=now()` setzen, **nie** auf `start_datetime`. Test: 0 Notifications. |
| B9 | **Orphans bei Anker-Delete** (FK `ON DELETE SET NULL`). | 🟢 low | Bekannt; optional Cleanup. |

## Getroffene Entscheidungen (2026-06-14)
1. **Budget (B1) — ENTSCHIEDEN:** Approval-Links **werden** beim Backfill kopiert (Bewilligungs-Verknüpfung nicht vergessen). Budget-Verbrauch ist an `counted_towards_budget` geknüpft, das dem Termin-Status folgt — also **kein** Verbrauch für `scheduled`-Backlog-Occurrences, Verbrauch erst bei „teilgenommen" (live via `handleAppointmentStatusChange`). Fachlich sauber, keine rückwirkende Budget-Verfälschung, keine Doppelzählung (Anker-Datum-Skip + Dedup vorausgesetzt).
2. **Lookback (B3) — ENTSCHIEDEN:** Cap mit sinnvollem Default (**24 Monate** seit jetzt, aber nicht vor Serienbeginn) + `maxOccurrences`-Guard im Backfill-Request. Schützt vor Zeilen-Explosion bei alten open-ended Serien. (Bei Bedarf später pro-Tenant überschreibbar.)

## Test-Plan

### Bestehende, die GRÜN bleiben müssen (Regressionsschutz)
- `appointment-occurrence-expander.service.spec.ts` (occurrenceKey, excluded_dates, series_end_date, maxOccurrences)
- `appointment-series-generator.service.spec.ts` (DAILY/WEEKLY/MONTHLY, DST, `resolveOccurrenceOnDate` UTC-Boundary)
- `appointments.service.series-tz.spec.ts` (materializeFromAnchor an UTC-Datumsgrenze)
- `appointment-occurrence-response.service.spec.ts` (RSVP-Override-Upsert, Notice-Mapping, D1)
- `series-supersession.util.spec.ts` (notSupersededAnchorSql)
- `appointment-completion-sentinels.spec.ts` (Sentinel-Emission, Zeit-Gate)
- `einrichtungs-berater-series-participant-status-no-leak.spec.ts` (Single-Occurrence-Materialisierung + Status-Carry-over)

### Neu — Unit
- Obligation-Detection: `scheduled→status-sentinel` · `took-place-no-doc→doc-sentinel` · `cancelled/excluded-override→skip` · `null-override→Anker-Default`.
- RSVP-Override-Übernahme: Override `no_show_with_notice` → materialisierter Teilnehmer hat diesen Status (nicht `scheduled`).
- Idempotenz: zweiter Backfill-Lauf = 0 neue Zeilen.
- Anker-Datum-Skip: Anker wird nicht als Kind doppelt materialisiert.
- Notifications: Mock `NotificationDispatchService` → 0 Aufrufe.

### Neu — SQL/Integration
- exdate- + Supersession-Skip im Bulk.
- materialisierte Zeile → Sentinel in `list_invalid_appointment_fields` → `invalid_fields`-Count.
- `count_invalid_case_appointments`: Anker + N Kinder → korrekte Summe, **kein** Doppel-Count.
- **Budget (B1):** Anker + 5 materialisierte completed-Occurrences mit Approval-Link → `prior_months_usage` zählt jede genehmigte Einheit **einmal** (nicht 6×).

### Neu — E2E (Playwright, `withE2eClient` + Factory)
- Serie FREQ=WEEKLY × 10 vergangene Wochen + completion-Template → Backfill/Sweep → **genau 10** Tasks, keine Dupes.
- Sweep-Idempotenz: zweimal laufen → weiterhin 10, keine neuen Zeilen.
- Gemischt: 5 cancelled-Override + 2 completed-mit-Doku + 3 scheduled-ohne-Doku + 2 exdates → nur die 3 erscheinen als Task.
- Kalender nach Backfill: genau N Zeilen, keine Anker-Doppelung im Vergangenheitsbereich.

### Neu — Factory
- `createSeriesWithPastOccurrences({tenant, createdBy, recurrenceRule, startDatetime, occurrenceCount, overrideStatuses[]})`.

## Implementierungs-Reihenfolge (nach Entscheidungen)
1. Materialisierungs-Helper `materializePastOccurrencesForAnchor(anchor, {lookback, maxOccurrences})` — enumerieren, Skip-Filter (exdate/superseded/anker-datum/already), Offene-Pflicht-Filter, `materializeFromAnchor` + **RSVP-Override-Nachsetzen**, gebatcht.
2. Budget-Mitigation gemäß Entscheidung 1.
3. Backfill-Trigger an die Aktivierung (Köln-Seed / Admin-Endpoint, gedrosselt) + Inkrement in `AppointmentCompletionSweepService` (Fenster).
4. Performance: Anker-`excluded_dates`-Batch-Update, Teilnehmer-Multi-Row, Trigger-Last messen.
5. Tests (oben), in dieser Reihenfolge: Unit → SQL/Integration → E2E.
