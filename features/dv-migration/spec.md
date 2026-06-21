# Feature: Donum-Vitae v1→v2 Migration (gehärtetes, wiederverwendbares Tool)

> **Status:** 📝 Draft (zur Abstimmung)
> **Owner:** baumgart
> **Last updated:** 2026-06-14

## Vision (Elevator Pitch)

Ein **config-getriebenes, idempotentes Migrations-Tool**, mit dem wir jeden
donum-vitae-Träger sauber von tagea v1 (`tagea.app`) nach v2 migrieren — in
**einem** durchgängigen Lauf, der die **volle operative Historie** (Klienten,
Fälle, Termine, Dokumentationen, **Dokumente**, Stammdaten, Fallstatus)
überträgt und die **Statistik** (NRW-Fachdatenerhebung + Erg. Statistikbogen)
auf das Berichtsjahr beschränkt rekonstruiert. Reconcile-Aufgaben
(Klientenstammdaten, Fallstatus, Dokumente) sind **reguläre Phasen**, keine
nachträgliche Reparatur. Am Ende erzeugt das Tool eine **Abnahme-Checkliste
mit 20 v1→v2-Stichproben**, mit der der Träger uns belegt, dass seine
Erwartungen erfüllt sind.

Heutiger Zustand (Skripte `scripts/migrations/v2-migration/` + `dv-nrw-migration/`):
funktioniert, aber Träger-spezifisch hartcodiert, jahres-überfiltert und auf
eine separate Recovery-Toolchain (22–28) angewiesen, die einen
**unvollständigen Erstlauf** im Nachhinein flickt. Diese Spec definiert den
Soll-Zustand.

### Auslöser (zwei konkrete Kundenbeschwerden, donum vitae HSK)

1. **2025-Bestandsdaten fehlen.** Der `REPORT_YEAR=2026`-Filter wurde
   fälschlich auf *operative* Daten angewandt → **739 von 1058 Fällen (70 %)**
   plus ihre Klienten/Termine/Dokus wurden nie übertragen. Bei Wiederauftreten
   eines Klienten fehlt die fachliche Vorgeschichte.
2. **Fallnummern neu vergeben.** v2 generiert Fallnummern aus dem Nummernkreis;
   die v1-Nummern (`0333-2026`) gehen verloren. Externe (anonyme) Berichte
   referenzieren die alten Nummern → ohne sie kein Rückschluss.

### Struktureller Zusatzbefund (HSK)

HSK wurde mit **2 v2-Einrichtungen** (= die 2 Standorte Arnsberg/Meschede)
aufgebaut. Richtig ist **1 Einrichtung + 2 Departments**, weil HSK nur **eine**
Statistik führt und **alle alles sehen** sollen. Das Tool migriert generell ins
Modell **1 Einrichtung pro Träger + N Departments pro Standort**.

## Root-Cause-Analyse (verifiziert im Code)

| Beschwerde | Ursache (Datei) | Befund |
| --- | --- | --- |
| 2025 fehlt | `04-upload-clients` (`V1_CLIENTS_ACTIVE_SINCE`), `10-index-v1-events` (`V1_EVENTS_START/END_DATE` 2026–2027), `15`+`16` (`REPORT_YEAR`) | Operativer Scope an Statistik-Scope gekoppelt. Für DV werden Fälle **nur** aus `16→17` (berichtsjahr-gefiltert) erzeugt; die generische `08` läuft nicht → kein 2025-Fall existiert. |
| Fallnummern | Backend `CreateCaseDto` / `CasesService.create` | `case_number` kann **nicht** mitgegeben werden — `create()` ruft IMMER `NumberRangeService.generateNextCaseNumber()`. Reparatur nur per SQL möglich. |
| Termine ohne Fall | `17` schreibt `mapping[v1_case_id]`, `11` liest `mapping['{v1_client}__{v1_institution}']` | Compat-Key wird nie geschrieben (310 Keys, 0 `__`) → **alle echten Termine bekamen `case_id=null`**. Key ist zudem bei mehreren Fällen/Klient mehrdeutig. |
| Stammdaten/Status/Dokumente fehlten | Recovery 22–28 | Erstlauf übertrug Klienten-Stammdaten, Fallstatus und **sämtliche Dokumente** nicht; Mapping-Dateien gingen verloren → Fuzzy-Re-Derive (riskant). |

## User Stories

- **Als Ops (wir)** will ich einen Träger über **eine Config-Datei** migrieren,
  ohne Skript-Code anzufassen, damit der nächste DV-Träger in Stunden statt Tagen
  startklar ist.
- **Als Ops** will ich jede Phase **`--dry-run`** vorab sehen und nach Abbruch
  **resumebar** fortsetzen, damit Token-/Netz-Fehler keinen Neustart erzwingen.
- **Als Träger-Admin** will ich nach der Migration eine **Checkliste mit 20
  Stichproben** v1↔v2, mit der ich Stammdaten, Fallnummern, Status, Termine und
  Dokumente abnehme.
- **Als Berater:in** will ich die **vollständige Fallhistorie** (auch 2025) sehen,
  damit ich bei Wiederauftreten fachlich anschlussfähig bin.

## Acceptance Criteria

**Operative Vollständigkeit**
- [ ] Alle v1-Klienten mit Fall/Termin im `operationalSince`-Fenster (Default: alle Jahre) sind in v2 — inkl. **Geburtsdatum, Geschlecht, Telefon, Adresse** ab Erstanlage.
- [ ] Alle v1-Fälle im Fenster existieren in v2; 2025-Fälle als **operative Fälle** (mit DV-Template, ohne Statistik-Pflichtfelder), 2026 mit voller Statistik.
- [ ] Jeder v2-Fall trägt den korrekten **Fallstatus** (`in Beratung`→`active`, `abgeschlossen`→`closed`).
- [ ] Echte Termine hängen am **richtigen Fall** (per-Termin-Auflösung), Dokumentationen am richtigen Termin.
- [ ] **Dokumente** (Klient- + Fall-Anhänge) sind übertragen (Anzahl v1 = v2 je Klient/Fall).

**Fallnummern**
- [ ] `cases.case_number` == v1-Fallnummer für alle migrierten Fälle.
- [ ] `case_number_ranges.current_sequence/current_year` ist auf `max(v1)+1` reconciled → neue Fälle kollidieren nicht.

**Datenmodell**
- [ ] Genau **1 Einrichtung** pro Träger; Standorte als **Departments**; Mitarbeiter als **`admin`** (volle Sichtbarkeit).
- [ ] Genau **1 Satz Report-Definitionen** (NRW-FDE + Erg. Statistik) auf der Einrichtung, der über beide Departments aggregiert.

**Reproduzierbarkeit & Abnahme**
- [ ] Lauf ist **idempotent** (Re-Run erzeugt keine Duplikate) und **resumebar**.
- [ ] `verify-abnahme` erzeugt eine **20-Stichproben-Checkliste** + Aggregat-Abgleich (Summen v1 vs v2 je Entität, Jahr, Department).

## Architektur

### Prinzip 1 — Eine Config pro Träger

`scripts/migrations/v2-migration/config/<traeger>.json` ersetzt alle
verstreuten Hardcodes (`V1_TENANT_ID`, `CASE_TEMPLATE_MAP`, `SERVICE_MAP`,
`COST_CARRIER_ID`, Template-Namen, `REPORT_YEAR`, Rolle, Date-Range,
`V1_CLIENTS_ACTIVE_SINCE`).

```jsonc
{
  "traeger": "donum-vitae-hsk",
  "v1": {
    "tenantId": "<uuid>",
    "apiBaseUrl": "https://api.tagea.app",
    "keycloak": { "realm": "tremaze-prod", "clientId": "tagea-cc" },
    "institutions": { "<v1-inst-A>": "Arnsberg", "<v1-inst-B>": "Meschede" }
  },
  "v2": {
    "tenantId": "<uuid>",
    "baseUrl": "https://api.v2.tagea.app",
    "keycloak": { "url": "...", "clientId": "tagea-beratung" },
    "institutionId": "<die eine Einrichtung>",
    "employeeRole": "admin",
    "institutionMapping": {
      "<v1-inst-A>": { "v2_institution_id": "<HSK>", "v2_department_id": "<Arnsberg>" },
      "<v1-inst-B>": { "v2_institution_id": "<HSK>", "v2_department_id": "<Meschede>" }
    },
    "templates": {
      "case": "donum vitae NRW",
      "appointmentLegacy": "Beratungsgespräch (v1 Migration)",
      "financial": { "bundesstiftung": "Bundesstiftungsantrag", "vmf": "Verhütungsmittelfonds (kommunal)" }
    }
  },
  "scope": { "operationalSince": null, "statisticsReportYear": "2026" },
  "caseNumbers": { "strategy": "overwrite" }
}
```

`scope.operationalSince = null` ⇒ volle Historie. `statisticsReportYear`
steuert **nur** Fachdaten/Statistik (Phasen 1-Index-Fachdaten + 3-Statistik).

### Prinzip 2 — Phasen mit Reconcile inline

| Phase | Inhalt | Idempotenz | ersetzt heute |
| --- | --- | --- | --- |
| **0 Preflight** | Config validieren; v2-Einrichtung + Departments + Seeds + Report-Engine-Extensions prüfen; **fail fast** | read-only | (neu) |
| **1 Index v1** | Mitarbeiter, Klienten **+Stammdaten**, Bezugsmitarbeiter, Fälle (**alle Jahre**), Fachdaten (Berichtsjahr), Termine (**volle Historie**), Dokus, **Datei-Manifest** | Resume je Datei | 01/03/03b/05/10/10b/12/14/15/24/27 |
| **2 Stammdaten** | Mitarbeiter (**Rolle aus Config = admin**); Klienten **mit DOB/Geschlecht/Adresse**; Bezugsmitarbeiter | Mapping-Resume | 02/04/06 **+ 03b/19/22 eingefaltet** |
| **3 Fälle** | 2026 = volle Statistik (CF + Platzhalter + Sachmittel); **2025+ = operativ (Minimal, mit Template)**; **Status inline**; v1-Fallnummer mitgeführt | Mapping-Resume | 16/17/18/18b/20 **+ 23 eingefaltet**, erweitert um 2025-Pfad |
| **4 Termine + Dokus** | echte Termine **mit per-Termin-Fallauflösung**; Dokumentationen | Mapping-Resume | 11/11b/13 **+ Compat-Key-Fix** |
| **5 Dokumente** | Klient-/Fall-Anhänge hochladen, dedupe | Resume je Datei | 28 **als reguläre Phase** |
| **6 Fallnummern** | SQL: `case_number = v1` + Nummernkreis-Reconcile | idempotent (WHERE) | (neu, ersetzt README-Backlog) |
| **7 Verify + Abnahme** | Aggregat-Abgleich + **20 Stichproben** | read-only | 21 erweitert |

### Prinzip 3 — Reconcile ist Default, nicht Recovery

Die Audit-Fähigkeit der heutigen Recovery (menschliche Edits via
`entity_changelog` erkennen, bevor überschrieben wird) bleibt als **Re-Run-Schutz**
erhalten (Phase 2/3 prüfen vor Überschreiben, ob ein Feld nach Migration manuell
geändert wurde → dann skip + Report). Beim Erstlauf auf leerem Tenant ist sie
ein No-op.

## Datenmodell-Regel: 1 Einrichtung + N Departments

- **Vor** Phase 1: v2-Tenant hat **1 Einrichtung** je Träger; jeder v1-Standort
  ist ein **Department** dieser Einrichtung.
- `institutionMapping` (Objekt-Format) bildet jede v1-Einrichtung auf
  `{ v2_institution_id (gleich), v2_department_id (verschieden) }` ab. Skripte
  unterstützen das nativ (`lib/config.ts` normalisiert `v2_department_id`;
  `16-transform:846` setzt `case.department_id`; `04:232` `client.department_id`).
- **„Alle sehen alles"** = Mitarbeiterrolle `admin` (Admin-Elevation umgeht
  Department-Gates) → kein `departments.access_all` nötig.
- **Eine Statistik**: Report-Definitionen sind einrichtungs-skopiert → ein Satz
  Reports auf der Einrichtung aggregiert beide Departments.

## Operativ vs. Statistik (der Kern-Fix)

```
operationalSince (Default null = alles)         statisticsReportYear (z.B. 2026)
        │                                                 │
   Klienten, Fälle, Termine, Dokus, Dokumente        Fachdaten-CFs, Platzhalter-Termine,
   Stammdaten, Status, Fallnummer                    Sachmittel-Records, Statistik-Reports
        │                                                 │
   volle Historie                                    nur Berichtsjahr
```

2025-Fälle durchlaufen den **bestehenden Minimal-Fall-Pfad** (Transform baut
heute schon Minimal-Fälle für 2026er ohne Fachdaten) — wir erweitern nur den
Jahresfilter (`16-transform:749-751`) und hängen **keine** Statistik-Artefakte an.

## Termin→Fall-Auflösung (Compat-Key-Fix)

`11` darf **nicht** `mapping['{client}__{institution}']` nutzen (mehrdeutig bei
mehreren Fällen/Klient über Jahre). Stattdessen pro Termin den **spezifischen
v1-Fall** auflösen:
1. **Primär:** v1-Event trägt Fall-Bezug → direkter `v1_case_id`-Lookup in
   `mapping[v1_case_id]` (das Phase 3 schon schreibt). *(In Phase 1 prüfen,
   ob v1-Events ein Case-Feld führen + wie hoch der Anteil ohne ist.)*
2. **Kein Fall-Bezug am v1-Event (nur Klient):** Termin bleibt **klient-only**
   in v2 (Client-Participant **ohne** `case_id`) — **keine** erzwungene
   Zuordnung. v1 ist hier teils unsauber dokumentiert; eine Datums-Heuristik
   würde Termine falschen Fällen zuhängen. Das ist ein **gewollter** Zustand,
   kein Fehler — viele v1-Termine hängen legitim nur am Klienten.
3. **Optional (per Flag, default aus):** konservativer Datums-Match (Fall des
   Klienten, dessen `[start_date, end_date]` das Termindatum abdeckt; bei
   mehreren der jüngste) — nur als **Vorschlag im Verify-Report**, nie automatisch.
4. **Transparenz:** Zähler „Termine klient-only" je Klient in Verify/Checkliste
   ausweisen, damit der Träger den Anteil sieht und abnimmt.

## v1-Termine: Realität & Scoping (verifiziert an HSK)

Der v1-Endpoint `/users/{id}/events` liefert **thin events**: `users[]` ist
**leer** — keine Teilnehmer. Konsequenzen:

- **Klient-Zuordnung = Shard-Zugehörigkeit** (das Event steht im Kalender von
  Klient X, weil X beteiligt ist), NICHT `event.users[]`. Mitarbeiter aus
  `event.creator` (Fallback, da `users[]` leer).
- **Institutionsweite Events** (Feiertage, Urlaub, Team-Termine, **Gruppen-
  veranstaltungen/Schulbesuche**) erscheinen auf **~allen** Klienten-Kalendern.
  Erkennung über **Reichweite** (in wie vielen Shards das Event vorkommt):
  Reichweite 1 = Einzelberatung; Reichweite ≫ (z.B. >20) = institutionsweit.
- **Das heutige `11-upload` skippt jedes Event ohne USER in `event.users[]`
  (Z. 210-214) → bei thin-events migriert es NICHTS.** Redesign zwingend:
  Klient aus Shard, Mitarbeiter aus creator, institutionsweite via Reichweite
  überspringen.

**Scope der Echt-Termin-Migration (Klienten-Historie):** nur Einzel-/Klein-
Termine (Reichweite ≤ Schwelle). HSK: ~2.232 (2.124 Einzel + ~108 Klein/Paar).
Die **319 institutionsweiten Events** werden NICHT als Klient-Termine migriert.

**Gruppenveranstaltungen laufen über die Statistik-Schiene**, nicht über den
Kalender: die Teilnehmerzahl steht nicht am v1-Event, sondern wird in v2 als
Custom Field `anzahl_der_erreichten_personen` am Gruppenveranstaltung-Termin
erfasst (DV-Seed-Template + Erg. Statistikbogen). Kalender-Gruppenevents
(Schulbesuche etc.) daher im `11`-Pfad überspringen.

## Fallnummern-Reparatur (Phase 6, SQL)

`case_number` ist API-seitig nicht setzbar → **nach** Phase 3/4 per SQL.
Siehe auch `specs/features/case-number-ranges/spec.md`.

1. **Overwrite:**
   ```sql
   UPDATE cases c SET case_number = m.v1_number
   FROM <mapping v2_case_id → v1_number> m
   WHERE c.id = m.v2_case_id;
   ```
   Quelle: `case-migration-result.json` (v1→v2) ⋈ `v1-cases-index.json` (v1→caseNumber).
2. **Constraints respektieren:** `case_number` = `varchar(50)` UNIQUE
   (`cases_case_number_unique` + `idx_cases_case_number`, **global** inkl.
   soft-deleted). v1-Nummern `NNNN-YYYY` sind über den Träger eindeutig (1 Standort-
   übergreifender v1-Nummernkreis) → bei 1 v2-Einrichtung kollisionsfrei.
3. **Counter reconcile:** `case_number_ranges.current_sequence = max(v1-seq des
   laufenden Jahres)+1`, `current_year` setzen. (Backend-`syncSequenceToMax`
   erkennt nur `YY-N`-Form → bei `NNNN-YYYY`-Format nicht verlassen, manuell setzen.)
4. **Trigger:** Validity-Trigger ist No-op bei `case_number`-Änderung (safe).
   Changelog-Trigger schreibt eine NULL-Actor-Zeile je Fall → vor dem UPDATE
   `SET LOCAL app.current_employee_id = '<seed-system>'` setzen, um Audit sauber
   zu halten.

## Verify + Abnahme-Checkliste (Phase 7)

`verify-abnahme.ts`:
- **Aggregat-Abgleich:** Summen v1 vs v2 je Entität (Klienten, Fälle, Termine,
  Dokus, Dokumente), aufgeschlüsselt nach Jahr und Department.
- **20 Stichproben:** reproduzierbar geseedeter RNG (Seed in Config/CLI),
  **stratifiziert** (2025/2026 × beide Standorte × §2/2a + §5/6). Pro Stichprobe
  v1↔v2-Vergleich → `abnahme-<traeger>.md` (+ optional PDF) mit Abhak-Boxen:
  ```
  Fall 0333-2026 (Meschede)
    ☐ v2-Fallnummer = 0333-2026         ☐ Status: abgeschlossen → closed
    ☐ Klient: Geburtsdatum / Geschlecht / Adresse korrekt
    ☐ Termine: v1=7  v2=7                ☐ Dokumente: v1=3  v2=3 (1× öffnen)
    ☐ Statistik-Felder (gesrahm, Migration, Konfliktgrund) korrekt   [nur Berichtsjahr]
  ```

## Skript-Migrationskarte (heute → Soll)

| heute | Soll |
| --- | --- |
| 01,03,03b,05,10,10b,12,14,15,24,27 | **Phase 1** (Index, config-getrieben, volle Historie) |
| 02,04,06 + 19,22 | **Phase 2** (Stammdaten + Master-Data inline) |
| 16,17,18,18b,20 + 23 | **Phase 3** (Fälle, 2025-Pfad ergänzt, Status inline) |
| 11,11b,13 | **Phase 4** (Termine, per-Termin-Fallauflösung) |
| 28 | **Phase 5** (Dokumente regulär) |
| (README-Backlog) | **Phase 6** (Fallnummer-SQL) |
| 21 | **Phase 7** (Verify + 20 Stichproben) |
| 25,26 (Recovery-Re-Derive/Apply) | **entfällt** beim Erstlauf; Audit-Teil → Phase 2/3 Re-Run-Schutz |

## Entscheidungen (festgelegt 2026-06-14)

- Fallnummer: **case_number überschreiben (SQL)** — alte Nummer wird sichtbare Fallnummer/Aktenzeichen.
- 2025-Fälle: **mit DV-Template** (zeigt harmlosen „unvollständig"-Badge `invalid_fields=25`).
- Mitarbeiter: **Rolle `admin`** (Einrichtungsadmins, volle Sichtbarkeit).
- Operativer Scope: **volle Historie**; Statistik **Berichtsjahr** (HSK: 2026).
- Modell: **1 Einrichtung „donum vitae HSK" + 2 Departments (Arnsberg, Meschede)**.
- Vorgehen: **Spec-first**, dann bauen; lokaler Durchlauf auf **Dev-DB** (nicht e2e), Tenant `0f91…`.

## Non-Goals

- Keine UI/Frontend-Arbeit, kein i18n, keine Notifications/Offline (reines Ops-Tool).
- Keine Migration der Erg. Statistik **2025** (andere Formularstruktur) — 2025 nur **operativ**, nicht statistisch.
- Keine automatische Anlage der v2-Einrichtung/Departments (manueller/seed-Vorlauf, in Phase 0 nur validiert).
- Kein Backend-Change an `CreateCaseDto` (Fallnummer bleibt SQL-Repair, kein neues DTO-Feld).

## Edge Cases

- **Fall ohne `statisticIdentifier`** (Berichtsjahr): heute übersprungen → künftig als operativer Fall anlegen, Statistik-Teil auslassen, in Verify markieren.
- **Klient mit Fällen in 2025 **und** 2026**: zwei v2-Fälle; Termin→Fall-Zuordnung pro Termin über den v1-Event-Fall-Bezug.
- **v1-Termin ohne Fall-Bezug (nur Klient)**: legitim — bleibt klient-only in v2, **nicht** auf einen Fall gezwungen; Anteil in Verify ausgewiesen.
- **Mehrere gleichnamige Klienten ohne E-Mail/Telefon**: betrifft nur Re-Derive (Recovery) — beim Erstlauf via v1-ID eindeutig, kein Fuzzy-Match nötig.
- **Dokument-Dateinamen mit Sonderzeichen** (Komma/`%`/`=`): sanitisieren vor v2-Upload (LB/CDN blockt).
- **v1-Token-Ablauf (~5 min)** / v2-Refresh-Ablauf: Auto-Refresh + Resume.

## Permissions & Tenant/Institution

- Läuft als v2-Admin-Token (Refresh-Token). Mitarbeiter werden mit Rolle `admin`
  angelegt → Sichtbarkeit standortübergreifend. Phase 6 läuft als direkter
  SQL-Zugriff auf das Tenant-Schema (`SET search_path TO tenant_<uuid>`).

## i18n Keys / UI States / Notifications / Offline

N/A — Ops-Tool ohne Frontend.

## HSK — Erstlauf (konkret)

- v2-Ziel: Dev-DB `tagea-v2-postgres-dev`, Tenant-Schema `tenant_0f916473-…`.
- Vorlauf: aktuellen falschen Stand (2 Einrichtungen) **wipen** → 1 Einrichtung
  „donum vitae HSK" + Departments „Arnsberg"/„Meschede" → DV-Seeds 1×.
- v1: tenant `e593…`, inst Arnsberg `3e94…`, Meschede `9e7a…` (Creds via Env-Vars).
- Lauf: Phasen 0–7, erst `--dry-run`, dann echt; Verify + Abnahme-Doc erzeugen.

## References

- `specs/features/case-number-ranges/spec.md` — Nummernkreis-Vertrag (Phase 6).
- `scripts/migrations/v2-migration/README.md` + `dv-nrw-migration/README.md` — heutiger Stand.
- `tools/DONUM-VITAE-DEPLOYMENT-ANLEITUNG.md` — Seeds/Go-Live.
- Backend: `cases.service.ts`, `number-range.service.ts`, `case.entity.ts`,
  `create-case.dto.ts` — Fallnummer-Mechanik.
- Memory: `project_dv_hsk_2025_backfill_and_casenumbers` — Befunde + Konkreta.
