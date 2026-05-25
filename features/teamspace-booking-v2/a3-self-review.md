# A3 Self-Review — E2E Coverage Plan

> **Status:** ✅ Plan drafted, awaiting implementation
> **Owner:** Claude (self-review)
> **Date:** 2026-05-22
> **Artifact:** `apps/tagea-frontend-e2e/BOOKING_COVERAGE_PLAN.md` (313 LoC)

## Was geliefert wurde

Ein **5-Wellen-Coverage-Plan** mit 21 Spec-Files (geschätzt ~63-96 Tests) für die vollständige E2E-Abdeckung des `teamspace-booking-v2`-Refactors.

| Welle | Fokus | Spec-Files | Aufwand |
|---|---|---|---|
| 1 | Permission-Matrix (Eingangs-Gate) | 3 | ~45 min |
| 2 | Slot-Generierung (Read-Path-Correctness) | 4 | ~90 min |
| 3 | Booking-Erstellung + Round-Robin | 4 | ~75 min |
| 4 | Verfügbarkeit + Kategorien-Verwaltung | 6 | ~75 min |
| 5 | Cleanup + Cascading | 3 | ~60 min |
| — | Drift-Pin (temporär, Welle-C-Bridge) | 1 | — |
| **Total** | | **21** | **~5-6h** |

Plus: Definition-of-Done + Quick-Start-Checkliste für die nächste Session.

## Bewertung gegen die A3-Zielsetzung

Ziel laut Spec (`spec.md` → "Welle A — Foundation"):
> E2E-Coverage-Plan BOOKING_COVERAGE_PLAN.md analog zum E2E-Welle-Cookbook aus dem Memory.

### ✅ Was der Plan gut leistet

#### AC-Abdeckung gegen `spec.md`

Jedes Acceptance Criterion aus dem v2-Spec hat eine zugeordnete Test-Spec:

| ACs aus spec.md | Wellen-Coverage |
|---|---|
| Verfügbarkeit anlegen (Multi-Block + Multi-Employee + Auto-Save + Veröffentlichen) | Welle 4 — 4 Spec-Files |
| Multi-Employee + Round-Robin (Atomic, Race-Safe, Mitgliedschafts-Entzug) | Welle 3 — 3 Spec-Files |
| Slot-Generierung (Multi-Block + Buffer + Vorlaufzeit) | Welle 2 — 4 Spec-Files |
| Kategorien (CRUD, Coverage-Banner, Detail-View) | Welle 4 — 2 Spec-Files |
| Permission Gating (TS-Admin, Tenant-Admin-Bypass, Cross-Tenant 403) | Welle 1 — 3 Spec-Files |
| Hard-Cut-Migration (alte Endpoints werden 404) | Drift-Pin |

#### Decisions D1-D9-Abdeckung

| D | Coverage |
|---|---|
| D1 Multi-Block | ✅ `slots-multi-block` + `availability-multi-block-crud` |
| D2 Multi-Employee | ✅ `availability-multi-employee-crud` + Round-Robin-Tests |
| D3 Draft/Published (nur is_active) | ✅ `availability-publish-flow` |
| D4 Self-Service (Non-Goal) | n/a |
| D5 Custom-Fields-Scope-Wechsel | ✅ `categories-custom-fields-scope-migration` |
| D6 Round-Robin = LRBO | ✅ `booking-round-robin-distribution` |
| D7 AbsencePeriod + PublicHoliday Integration | ✅ `slots-absence-period-filter` + `slots-public-holiday-filter` |
| D8 Modul-Auszug | n/a (Backend-Refactor-internal, kein E2E-Surface) |
| D9 Hard Cut | ✅ Drift-Pin als Bridge bis Welle C |

#### Risiko-Ordering

Wellen-Reihenfolge folgt der Cookbook-Konvention: Permission-Matrix vor Read-Path vor Write-Path vor Verwaltung vor Cleanup. **Welle 2 und Welle 3 sind beide "Highest Risk"** — gerechtfertigt, weil Slot-Generation und Race-Safety die zwei produktivsten Bug-Quellen sind.

#### Architektur-Cheatsheet ist self-contained

Der Plan enthält:
- Routen + Endpoints + Permissions (Tabelle)
- Persona-Verteilung mit erwartetem Verhalten
- NOT-NULL-Surprises pro Tabelle (`availability_blocks.weekday` nullable, `last_booked_at` nullable, etc.)
- D7-Integration-Doku (AbsencePeriod + PublicHoliday-Lookup)
- Test-Infrastructure-Patterns (BASE_URL, Postgres OOM, --repeat-each, notification_preferences_seen)

Eine neue Session kann allein mit diesem Plan starten — kein Side-Channel-Kontext nötig.

### ⚠️ Bewusste Lücken

| Bereich | Status | Begründung |
|---|---|---|
| **Frontend-UI-Tests** (Master-Detail, Auto-Save-Indicator, Empty-State, Kategorien-Card-Grid) | Nicht in A3 | UI-Tests entstehen während Welle C-Implementation. Plan fokussiert auf API-Surface, was vor der UI stabil sein muss |
| **Performance / Load-Tests** | Nicht in A3 | v2-Spec hat keine NFRs; on-the-fly Slot-Generation ist nicht im Performance-Pfad bei realistischen Datenmengen |
| **Visual Regression** | Nicht in A3 | Repo nutzt keine Snapshot-Tests für E2E; Prototyp-Design ist statisch validiert |
| **Daylight-Saving-Edge-Cases** | Nicht in eigener Spec | A2-Self-Review hat das als latentes Risiko markiert; sollte in Welle B-Fix mit-validiert werden, ist aber kein eigenes E2E-Surface (Timezone-Bug ist Backend, nicht UI) |

### ⚠️ Eine offene Frage im Plan

In der Architektur-Cheatsheet-Permission-Matrix erwähne ich:

> `tenant.bookings.book` *(NEU, v2 — optional)*. **Offene Frage:** brauchen wir das oder reicht der bestehende „authenticated EMPLOYEE"-Schutz? Phase-1-Entscheidung.

Das ist eine Entscheidung, die im aktuellen v2-Spec offen ist. Der `BookingCreatedDto`-Endpoint (`POST /teamspace-booking`) hat heute keinen eigenen Permission-Bit. Wenn wir später feststellen, dass es einen brauchen sollte (z.B. um Buchungen für bestimmte Mitarbeiter-Gruppen zu beschränken), muss Welle 1 zurückgekommen werden.

**Empfehlung:** v2 bleibt erstmal ohne explizites Permission-Bit; bei Bedarf in v3 nachgereicht. Plan-Eintrag bleibt als Offene-Frage stehen.

## Code-Quality-Check des Plans

### ✅ Format-Consistency

- Verwendet dieselbe Notation wie APPOINTMENTS/CASES/INSTITUTION_SETTINGS-Pläne: `[ ]` / `[x]` / `[~]` / `[→]`
- Header-Struktur identisch (Cheatsheet → Wellen → Drift-Pins → NOT-NULL-Surprises → Infra-Patterns → DoD)
- Welle-Format folgt Cookbook: Setup-Block + Test-Liste pro Spec + Aufwand-Schätzung

### ✅ Test-Granularität

Spec-Files sind im Cookbook-Standard-Bereich (3-6 Tests pro File). Die hohe Gesamtzahl (21) ist Konsequenz der Modul-Komplexität — Multi-Block + Multi-Employee + Round-Robin + AbsencePeriod-Integration sind 4 distinkte Test-Domains, jede mit eigener Spec.

### ✅ Tripwire-Pattern

Drift-Pin `drift-pin-old-slot-generator.spec.ts` folgt dem Cookbook-Pattern: pinnt aktuelles Verhalten, wird bei Welle-C-Cutover GELÖSCHT (nicht migriert). Dokumentation dazu im Plan-Body.

### ⚠️ Schwachpunkt

- **Race-Tests in Welle 3 sind flake-anfällig.** Ich rede `--repeat-each=5` an, aber das ist eher Schadenslimitation als Lösung. Race-Free-Race-Tests sind notorisch schwer — wir müssen beim Implementieren bereit sein, alternative Patterns einzusetzen (z.B. SQL-Level-Locking-Verifikation statt parallele HTTP-Calls).

## Tasks-Status

| # | Subject | Status |
|---|---|---|
| 13 | Read existing coverage plans & cookbook | ✅ |
| 14 | Inventory existing booking-related E2E + permissions | ✅ |
| 15 | Write BOOKING_COVERAGE_PLAN.md | ✅ |
| 16 | Self-review A3 deliverable | ✅ (this doc) |

## Empfehlung an den User

**A3 ist ready für Welle B-Start.** Der Plan ist:
- **Vollständig** gegen v2-Spec-ACs (alle 6 AC-Bereiche haben Specs zugewiesen)
- **Decision-konsistent** (D1, D2, D3, D5, D6, D7, D9 alle abgedeckt)
- **Risiko-geordnet** (Permission → Slot-Read → Booking-Write → Verwaltung → Cleanup)
- **Sequenziell unabhängig von Welle B**: Welle 1 + 2 können parallel zu B0/B1/B2 implementiert werden, sobald die Migrations da sind
- **Bridge zu A2**: Welle 2 testet das v2-Verhalten gegen die Charakterisierungs-Tests aus A2 (Tripwire-Effekt explizit beschrieben)

## Was als nächstes ansteht

Welle A ist damit komplett (A1 ✅ Decisions, A2 ✅ Backend-Tests, A3 ✅ E2E-Plan).

**Übergang zu Welle B — Backend-Refactor:**
- B0: Modul-Auszug aus AppointmentsService → `apps/tagea-backend/src/teamspace-booking/`
- B1: Schema-Migration (neue Tabellen)
- B2: Data-Migration für Bestandsdaten
- B3: SlotGeneratorService + RoundRobinSelectorService Rewrite + D7-Integration
- B4: DTOs neu (kein Legacy-Wrapper — D9)
- B5: Tests grün ziehen + neue Tests für Multi-Block + Round-Robin + Absences/Holidays

Geschätzter Aufwand: 5-7 Tage.
