# Feature: Termin-Abschluss-Aufgaben (Status & Doku)

> **Status:** ✅ Implemented & verified (branch `feat/appointment-completion-tasks`)
> **Owner:** baumgart
> **Last updated:** 2026-06-14
>
> **Implementiert:** Migration `20260614120000-AppointmentCompletionTasks` (Tabelle
> `appointment_completion_requirements`, `sync_…`/`list_…`-Erweiterung, Doku-Trigger,
> Backfill, down()); Interface-Flags + R1-Guards; Tasks-DTO `client_participant_id`;
> Köln-Seed (inkl. `excluded_response_statuses` für Absagen); Frontend-Inline-Controls
> (R2) + 16 Locales; Recompute-Sweep (R5). Tenant-Baseline regeneriert (532 Migr. grün).
> **Tests:** Unit-Guard grün (36/36 report-validation); SQL-Logik-E2E
> `appointment-completion-sentinels.spec.ts`. **TS-Overlay-Mirror der Regeln A/B bewusst
> verschoben** (sekundäre Fläche; row-vs-appointment-Refactor-Risiko) — SQL-Pfad autoritativ.

## Vision (Elevator Pitch)

Ein vergangener Termin, bei dem niemand einen Teilnahme-Status gesetzt oder
keine Doku geschrieben hat, ist fachlich **unerledigt** — und macht den
Leistungsnachweis (z.B. Jugendamt Köln) lückenhaft. Diese Spec erweitert das
bestehende report-getriebene Validierungs-/Aufgaben-System um zwei neue,
**pro Termin-Template opt-in** definierbare Regeln:

1. **Status nicht gesetzt** — vergangener Termin, Klient-Teilnehmer noch `scheduled`.
2. **Doku fehlt** — vergangener Termin, der stattgefunden hat, ohne Doku-Inhalt.

Beide tauchen automatisch in der Aufgaben-Liste, den Badges und der „Offene
Dokumentation"-KPI auf — ohne globale Verhaltensänderung: Tenants ohne die
Regel bleiben unberührt, weil die Regel an der Report-/Template-Konfiguration
hängt.

## Kontext: Warum hier und nicht im Report

Das System trennt heute schon sauber:

- **`report_definitions.configuration->'validation_rules'`** definieren, was als
  „invalid" gilt (report-/template-definiert, also pro Tenant opt-in).
- Trigger-berechnete Spalten **`appointments.invalid_fields`** /
  **`cases.invalid_appointments`** speisen die Aufgaben-Liste + Badges.
- Der **„vergangen?"-Filter** (`end_datetime <= now()`) liegt bewusst zur
  Query-Zeit in `tasks.service.ts`, weil kein Trigger feuert, wenn `now()` über
  die Endzeit läuft.

Die beiden neuen Regeln reihen sich exakt in dieses Muster ein. Der
detail_export-Report (Köln-Leistungsnachweis) bleibt unangetastet — er ist ein
Dokument, kein Arbeitsvorrat.

## User Stories

- Als **Berater:in** möchte ich vergangene Termine ohne gesetzten Status als
  offene Aufgabe sehen, damit kein Termin undokumentiert „verschwindet".
- Als **Berater:in** möchte ich vergangene, durchgeführte Termine ohne Doku als
  offene Aufgabe sehen, damit der Leistungsnachweis vollständig wird.
- Als **Träger-Admin (Köln)** möchte ich diese Pflichten nur für die FLS-relevanten
  Fall-/Termin-Templates aktivieren, ohne andere Tenants/Templates zu beeinflussen.

## Regel-Semantik

Eine Termin-Teilnahme/-Doku ist **offen**, wenn die jeweiligen Bedingungen
**alle** zutreffen. Bezugspunkt ist immer der **Klient-Teilnehmer**
(`appointment_participants.participant_type = 'client'`, der zugleich die
Fall-Verknüpfung via `case_id` trägt).

### Regel A — Status nicht gesetzt (`require_response_status_set`)

- Termin-Template hat `require_response_status_set = true`.
- `end_datetime <= now()` (vergangen, keine Karenz).
- **mind. ein** Klient-Teilnehmer hat `response_status = 'scheduled'` (ANY).

→ emittiert Sentinel-Feld **`__response_status`**.

Open-Set ist fix `{scheduled}` (= „kein Status gesetzt"; `scheduled` ist der
Default jeder Teilnahme, `hasResponded()` ⇔ `response_status != 'scheduled'`).

### Regel B — Doku fehlt (`require_documentation`)

- Termin-Template hat `require_documentation = true`.
- `end_datetime <= now()`.
- **mind. ein** Klient-Teilnehmer hat **stattgefunden**: `response_status`
  ist **nicht** `scheduled` **und nicht** in der report-definierten
  Exclusion-Menge (`statistic_excluded_appointment_statuses`, heute = Absagen).
- **Kein** Doku-Inhalt: keine `appointment_documentations`-Zeile mit
  nicht-leerem `content` (HTML strippen + trim, > 0 — spiegelt `hasContent()`).

→ emittiert Sentinel-Feld **`__documentation`**.

### Disjunktheit (kein Doppel-Count)

Regel A verlangt `scheduled`, Regel B verlangt „nicht `scheduled` und nicht
excluded". Die Status-Achsen sind disjunkt → ein Termin kann nie beide Sentinels
zugleich erzeugen. Es entsteht eine natürliche Progression:

```
scheduled (vergangen)      → __response_status        (erst Status setzen)
completed/no_show, keine Doku → __documentation        (dann dokumentieren)
completed/no_show, mit Doku  → keine Aufgabe           (erledigt)
abgesagt (excluded)          → keine Aufgabe
zukünftig                    → keine Aufgabe
```

> **Hinweis:** „Hat stattgefunden" wird über die **bestehende Exclusion-Config**
> abgeleitet, nicht separat konfiguriert. Schließt ein Tenant No-Shows aus der
> Statistik aus, entfällt für sie auch die Doku-Pflicht; tut er's nicht (wie Köln,
> das Ausfallzeit + Notiz führt), wird Doku verlangt. Eine Stellschraube, zwei
> konsistente Effekte.

## Konfiguration (validation_rules)

Neue, **unabhängige, optionale** Flags pro `appointment_rules[]`-Eintrag in
`report-validation.interfaces.ts`:

```ts
appointment_rules?: Array<{
  template_name: string;
  required_custom_fields?: Array<{ field_key: string; label: string }>; // wird optional → [] gültig
  excluded_response_statuses?: ParticipantResponseStatus[];
  require_response_status_set?: boolean; // Regel A; default false
  require_documentation?: boolean;       // Regel B; default false
}>;
```

`required_custom_fields` wird optional (heute non-optional), damit ein Template
**nur** Status/Doku verlangen kann, ohne erfundene Pflichtfelder.

> **⚠️ Pflicht-Guards beim Optional-Machen (verifiziert 2026-06-14):**
> - `report-validation.service.ts:356` und `:677` iterieren `apptRule.required_custom_fields`
>   **ungesichert** → mit `?? []` absichern, sonst Crash (KI-Doku-Katalog + Overlay).
> - SQL `sync_statistic_relevant_fields()` extrahiert via `jsonb_array_elements((rule->'required_custom_fields')::jsonb)`
>   → in `COALESCE(rule->'required_custom_fields','[]'::jsonb)` wrappen (Muster wie bei `excluded_response_statuses`).

### Köln-Aktivierung

An die Köln-Report-Definition (der `validation_rules`-Loader liest aus *jeder*
Definition, unabhängig vom `report_type`):

```jsonc
"validation_rules": {
  "case_template_name": "Ambulante Jugendhilfe",
  "appointment_rules": [
    { "template_name": "Co-Arbeit mit weiterer Kollegin/ weiterem Kollegen im Fall",
      "required_custom_fields": [], "require_response_status_set": true, "require_documentation": true },
    { "template_name": "Erstellen des Sachstands",
      "required_custom_fields": [], "require_response_status_set": true, "require_documentation": true },
    { "template_name": "Erstellen des Sachstands mit Kollegin/ Kollegen",
      "required_custom_fields": [], "require_response_status_set": true, "require_documentation": true },
    { "template_name": "Fallarbeit",
      "required_custom_fields": [], "require_response_status_set": true, "require_documentation": true }
  ]
}
```

> **Verifikationsstand (2026-06-14, Köln-Tenant-Abfrage):**
> `Fallarbeit` (21 Termine) und `Co-Arbeit mit weiterer Kollegin/ weiterem Kollegen
> im Fall` (2) existieren byte-genau. **`Erstellen des Sachstands` und
> `Erstellen des Sachstands mit Kollegin/ Kollegen` lieferten 0 Treffer** → vor
> Seed exakte Namen klären (s. Open Questions). Nur fall-verknüpfte Termine
> (Klient-TN vorhanden) sind im Scope.

## Datenmodell-Änderungen

### Materialisierungs-Tabelle

```sql
CREATE TABLE IF NOT EXISTS appointment_completion_requirements (
  template_name TEXT PRIMARY KEY,
  require_status        BOOLEAN NOT NULL DEFAULT false,
  require_documentation BOOLEAN NOT NULL DEFAULT false
);
```

Befüllt in `sync_statistic_relevant_fields()` aus den neuen Flags (TRUNCATE +
INSERT … `ON CONFLICT (template_name) DO UPDATE SET require_status = EXCLUDED.require_status
OR appointment_completion_requirements.require_status, …` — OR-Merge bei
Mehrfach-Referenz). Spiegelt das bestehende Muster von
`statistic_excluded_appointment_statuses`.

### `list_invalid_appointment_fields()` — zwei neue Zweige

Nach dem bestehenden Exclusion-Frühabbruch, jeweils mit `end_datetime <= now()`:

- Regel A → `RETURN QUERY SELECT '__response_status', NULL, NULL, NULL, 'response_status';`
- Regel B → `RETURN QUERY SELECT '__documentation', NULL, NULL, NULL, 'documentation';`

`count_invalid_appointment_fields` = `COUNT(*)` über `list_…` → Sentinels zählen
automatisch in Badge / Liste / `cases.invalid_appointments`.

**Präzisions-Anforderungen an die Zweige (Review 2026-06-14):**
- **Nach** dem Exclusion-Frühabbruch platzieren (dann ist garantiert ≥1 nicht-excluded Klient-TN).
- **Klient-TN-Guard:** beide Zweige nur, wenn `EXISTS (… participant_type='client')` — sonst leaken fall-lose Termine (out of scope). Spiegelt das Datenmodell (Fall-Link nur via Klient-TN).
- **Zeitvergleich `<=`** (nicht `<`) — Off-by-one bei Terminende exakt `now()`.
- **Rule B „took place"** = `response_status IS NOT NULL AND response_status <> 'scheduled' AND response_status NOT IN (excluded)`. `NULL` zählt **nicht** als stattgefunden.
- **`source`-Tag** (`'response_status'` / `'documentation'`) ist bewusst distinkt von `'custom'/'repeating'/'entity'` — damit Consumer (z.B. der Schwangerschaftsberatungs-KPI `countOpenDocumentation`) Sentinels bei Bedarf ausfiltern können.

### Neuer Trigger auf `appointment_documentations`

Insert/Update/Delete auf `appointment_documentations` muss
`update_appointment_validity(appointment_id)` aufrufen (analog zum
`trg_appointment_participant_changed` aus `20260603130000`) — sonst flippt
„Doku geschrieben" den Zähler nicht.

### Zeit-Gate & Staleness (Design-Entscheidung)

`end_datetime <= now()` liegt **in der SQL-Funktion** (nicht nur in der
Tasks-Query), weil der Fall-Zähler `count_invalid_case_appointments` `invalid_fields`
**ohne** Zeit-Gate liest — sonst würde jeder zukünftige Termin (alle starten auf
`scheduled`) die Fall-Zähler aufblähen. Preis: die gespeicherte Spalte wird
*stale*, wenn `now()` die Endzeit überschreitet.

**Mitigation:** täglicher Recompute-Sweep (bestehende BullMQ-Scheduler-Infra) über
kürzlich beendete, noch offene Termine status-pflichtiger Templates →
`UPDATE appointments SET invalid_fields = count_invalid_appointment_fields(id)`.
Nicht echtzeitkritisch (Doku-Erinnerung).

### TS-Spiegelung

`report-validation.service.ts` (appointment_rules-Loop) bildet dieselben Regeln
nach, damit KI-Doku-Katalog / Validierungs-Overlay konsistent bleiben (das
SQL↔TS-Spiegeln ist gewollte Konvention, siehe `20260603130000`).

## Acceptance Criteria

- [ ] **Given** ein vergangener Termin eines status-pflichtigen Templates mit
      Klient-TN `scheduled` **When** die Aufgaben geladen werden **Then**
      erscheint der Termin als Aufgabe mit `__response_status`.
- [ ] **Given** derselbe Termin **When** der Status auf `completed` gesetzt wird
      **Then** verschwindet `__response_status` und (falls Doku-pflichtig & ohne
      Inhalt) erscheint `__documentation`.
- [ ] **Given** ein vergangener `completed`-Termin eines doku-pflichtigen Templates
      ohne Doku-Inhalt **When** die Aufgaben geladen werden **Then** erscheint
      `__documentation`; **When** Doku-Inhalt geschrieben wird **Then** verschwindet sie.
- [ ] **Given** ein **zukünftiger** Termin (`scheduled`) **Then** entsteht **keine**
      Aufgabe und der Fall-Zähler `invalid_appointments` bläht **nicht** auf.
- [ ] **Given** ein vollständig abgesagter Termin (alle Klient-TN excluded) **Then**
      entsteht **keine** Aufgabe (weder Status noch Doku).
- [ ] **Given** ein Tenant/Template **ohne** die neuen Flags **Then** ist das
      Verhalten unverändert (kein neuer Task).
- [ ] **Given** der Köln-Tenant **When** die `validation_rules` aktiv sind **Then**
      greifen die Regeln für genau die vier FLS-Templates am Fall-Template
      „Ambulante Jugendhilfe".

## UI States

| State | When? | Was sieht der/die Nutzer:in? | A11y |
| ----- | ----- | ---------------------------- | ---- |
| Aufgabe Status | `__response_status` im Panel | Geteilter Status-Dropdown (`mat-select`, alle 7 Status wie am Termin — `PARTICIPANT_STATUS_OPTIONS`) | Fokus-fähig, Label „Teilnahmestatus setzen" |
| Aufgabe Doku | `__documentation` im Panel | Inline „Doku schreiben"-Aktion / Quick-Text | Label „Dokumentation schreiben" |
| Erledigt | nach Setzen/Schreiben | Eintrag verschwindet, Badge -1 | Live-Region-Update |

Das Frontend special-cased Sentinel-Keys über den `__`-Präfix; reguläre
`invalid_field_keys` (Custom Fields) bleiben unverändert im Feld-Editor.

## Non-Goals

- Keine Änderung am detail_export-Report / Köln-Excel selbst.
- Keine Karenzzeit (sofort nach Terminende).
- Keine Echtzeit-Stale-Auflösung in der Sekunde des Terminendes (Sweep deckt's ab).
- Keine neue Regel für `confirmed`-aber-nie-finalisierte vergangene Termine
  (bewusst nur `scheduled`, siehe Open Questions).
- **Termine ohne Klient-TN (kein Fallbezug) — out of scope** (gewollt intern,
  Entscheidung 2026-06-14); kein appointment-level-Status-Pfad. Eine etwaige
  pro-Mitarbeiter-Worklist für fall-lose Termine wäre ein eigenes Feature.

## Edge Cases

- **Mehrere Klient-TN (verwaltetes Kind):** ANY-Semantik — ein offener TN flaggt.
- **Termin ohne Klient-TN (rein interne Tätigkeit):** Regeln greifen **nicht** —
  und sollen nicht. Solche Termine haben **keinen Fallbezug** (die einzige
  Termin↔Fall-Verknüpfung ist `appointment_participants.case_id` am Klient-TN;
  es gibt keine `appointment.case_id` und keine Join-Tabelle). Sie erscheinen
  schon heute nicht im Leistungsnachweis und haben kein Client→Fall→Termin-Gerüst
  für die Aufgaben-Liste. **Entscheidung 2026-06-14:** bewusst out of scope (kein
  `appointments.status`-Pfad in v1). Empirie Köln-Tenant: Co-Arbeit 1/2, Fallarbeit
  3/21 ohne Klient-TN → als gewollt-intern eingestuft.
- **Doku-Zeile mit leerem/HTML-only `content`:** zählt als „keine Doku".
- **Staleness** nach Terminende bis nächster Trigger/Sweep: Aufgabe erscheint ggf.
  erst mit Verzögerung (≤ 1 Tag).
- **Migration-Backfill:** einmaliger Recompute aller Termine (wie bestehende Migrationen).

## Regressionsrisiken & Mitigationen (Review 2026-06-14)

Aus einem 5-Dimensionen-Risiko-Review; High-Funde an existierendem Code nachgeprüft.

### Verifiziert — Pflicht-Mitigationen (sonst Crash/Regression)
| # | Risiko | Evidenz | Mitigation |
|---|--------|---------|------------|
| R1 | Ungesicherte Loops über `required_custom_fields` → Crash, wenn optional | report-validation.service.ts:356, :677 (Z.676 guardet nur das äußere Array) | `?? []` an beiden Stellen |
| R2 | Frontend-Sackgasse: Appointment-Sentinels → `showProfileFallback`, aber `profileLink=null` → kein Inline-Control | task-field-section.component.ts:364-375 (Filter), :422-431 (unmappedKeys), :434-445 | `__`-Präfix **vor** Field-Matching erkennen; Sentinels aus `displayFieldGroups`/`unmappedKeys`/`coreFieldKeys` ausschließen; eigene Inline-Controls; Sentinels sichtbar rendern, damit Header-Count ≡ sichtbare Items |
| R3 | SQL `jsonb_array_elements` auf fehlendem `required_custom_fields` droppt Regel still | 20260603130000:101 | `COALESCE(…,'[]'::jsonb)` |
| R4 | `down()` muss `list_/count_invalid_appointment_fields` ohne Sentinels wiederherstellen | 20260609120000 (Body-Vorlage) | exakte Vorgänger-Bodies in `down()` |
| R10 | **PG15 `RETURN QUERY` `varchar(255)` vs `text`** (E2E gefunden): sobald der `text`-Literal-Sentinel-Zweig *zuerst* den Ergebnis-Descriptor auf `text` fixiert, scheitert ein späterer `varchar(255)`-Zweig (`build_attrmap_by_position`). Baseline-Lauf verdeckt es (leerer Tenant). | E2E-Fehler `structure of query does not match function result type`, reproduziert | `field_key::text` in Custom-/Repeating-Zweigen. **Geschwister-Funktionen (`list_invalid_case/client_fields`) NICHT betroffen** (varchar-Zweig zuerst → kompatibel; empirisch 0 rows, kein Error). |

**Verifikation (2026-06-14, lokaler E2E-Stack, PG 15.15):** `appointment-completion-sentinels.spec.ts` **grün (1 passed, 57s)** — Rule A, Rule B, Zeit-Gate (Zukunft aus), Exclusion (abgesagt), Doku-vorhanden, Staff-only (kein Klient-TN), Stored-Counter nach Sweep-Recompute. Backend/Frontend typecheck clean; 36/36 report-validation Unit grün; i18n-Parität grün; Tenant-Baseline regeneriert (532 Migr.).

### Per Design entschärft (Zeit-Gate in der Funktion)
- `count_invalid_case_appointments` hat **kein** Zeit-Gate (20260408100000:40 — bestätigt). Genau deshalb liegt `end_datetime <= now()` **in** `list_invalid_appointment_fields`, sodass Zukunftstermine erst gar kein Sentinel-`invalid_fields` bekommen. Damit greifen `cases.service.ts has_tasks` und `report-validation loadAppointments` (beide ohne Zeit-Gate) nicht auf Sentinels — **Hinweis:** für **Feld-Mängel** zählen diese Pfade Zukunftstermine schon heute (pre-existing, nicht durch dieses Feature verursacht).

### Bekannte Trade-offs / Restrisiken
| # | Risiko | Schwere | Behandlung |
|---|--------|---------|-----------|
| R5 | Staleness: gespeicherte `invalid_fields` aktualisiert erst beim Sweep, wenn `now()` die Endzeit kreuzt | mittel | täglicher BullMQ-Sweep (Pflicht); Monitoring/Alert bei Job-Fehler |
| R6 | KPI `countOpenDocumentation` (Schwangerschaftsberatung `Fall §2/2a`,`Fall §5/6`) zählt `invalid_fields` ohne Zeit-Gate | mittel, **eng** | nur relevant, wenn *derselbe* Tenant unsere Flags auf diese Templates setzt (nicht Köln). Bei Bedarf via `source`-Tag ausfiltern |
| R7 | Trigger-Kaskade appointment_documentations→appointments→trigger_appointment_changed | niedrig | `IS DISTINCT FROM`-Guard (20260408100000:65) bricht die Kaskade; Trigger nutzt `COALESCE(NEW,OLD).appointment_id` |
| R8 | Backfill `UPDATE appointments SET invalid_fields=…` langsam auf großen Tenants | niedrig | bestehendes Muster; optional auf `end_datetime <= now()` einschränken; Wartungsfenster |
| R9 | `invalid_fields`-Label „Offene Felder" in field-registry zählt Sentinels mit | kosmetisch | `source`-Tag ermöglicht spätere Trennung; v1 akzeptiert |

## Test- & E2E-Plan

### Unit (Backend, Jest, Mock-Repos — Muster: `tasks.service.spec.ts`, `report-validation.service.spec.ts`)
- TS-Regeln A/B in `report-validation.service.ts`: scheduled/past → `__response_status`; completed-ohne-Doku → `__documentation`; future → nichts; voll-excluded → nichts; NULL-Status → kein „took place".
- Optionalität: `appointment_rules`-Eintrag ohne / mit `[]` `required_custom_fields` → kein Crash (deckt R1).
- Disjunktheit: ein Termin erzeugt nie beide Sentinels.

### SQL-Integration (gegen echte PG — Muster: `withE2eClient`, s. `…profil-tab-badge-reads-server-counter.spec.ts`)
> **Lücke:** heute keine direkten SQL-Funktions-Tests. Hier zwingend, weil High-Precision-SQL.
- `list_/count_invalid_appointment_fields` direkt: Rule A/B Emission, Zeit-Gate `<=`, Klient-TN-Guard, `source`-Werte, OR-Merge in `appointment_completion_requirements`.
- Migration up()/down(): Tabelle angelegt+materialisiert; nach down() Bodies ohne Sentinels (deckt R4).
- Trigger appointment_documentations: INSERT/UPDATE/DELETE → `invalid_fields` recomputed (deckt R7).

### E2E (Playwright — Muster: `einrichtungs-berater-quick-completes-case-fields.spec.ts`; Persona `einrichtungs-berater` via `tenantFactory`)
Neue Specs unter `apps/tagea-frontend-e2e/src/tests/tasks/`:
- `…-status-nicht-gesetzt`: past+scheduled → Task erscheint → Inline-Status setzen → Task weg.
- `…-doku-fehlt`: past+completed ohne Doku → Task → Doku schreiben → Task weg.
- `…-zeit-gate`: past vs. future → nur past erscheint; Fall-Badge bläht nicht (deckt R5-Design).
- `…-ohne-klient-tn`: staff-only Termin erscheint **nicht** (deckt out-of-scope).
- Sentinel-UI: `__`-Key rendert Inline-Control, **nicht** Profil-Fallback (deckt R2).
- i18n: alle 16 Locales haben die neuen Keys (CLAUDE.md-Gate).

### Manuelle lokale Verifikation (E2E-Stack)
`nx run tagea-frontend-e2e:start-e2e-stack` (PG :5433, Redis :6380, Keycloak :8081, MinIO :9100) + `nx serve tagea-backend` (:3333) + `nx serve tagea-frontend` (:4200) + `nx run tagea-frontend-e2e:e2e-ui`. Persona via `tenantFactory({ users:['einrichtungs-berater'] })`. **Bekannter Blocker:** Stack bootet lokal nicht immer zuverlässig (siehe Memory).

## Permissions & Tenant/Institution

- **Required roles:** wie bestehende Aufgaben-Liste (`/tasks`, institution-scoped,
  `EMPLOYEE_PERMISSIONS`-basiert via `TasksService.hasInstitutionPermission`).
- **Institution context:** unverändert — Aufgaben sind institution-aware.
- **Opt-in:** rein über `validation_rules` an der Report-Definition → kein globaler Effekt.

## Open Questions

- [ ] **Exakte Namen für „Erstellen des Sachstands" / „… mit Kollegin/ Kollegen":**
  beide lieferten **0 Treffer** in der Tenant-Abfrage (2026-06-14) → entweder (noch)
  keine Termine oder Name nicht byte-genau. Vor Seed klären:
  `SELECT name FROM appointment_templates WHERE name ILIKE '%Sachstand%'`.
- [x] ~~Tragen die Templates einen Klient-TN?~~ Geklärt 2026-06-14: nicht alle.
  No-Klient-TN-Termine bewusst out of scope (s. Edge Cases / Non-Goals).
- [ ] Soll später auch `confirmed`-vergangen-nicht-finalisiert als Status-Aufgabe gelten?

## References

- **Report-Validierung (TS):** `apps/tagea-backend/src/reports/services/report-validation.service.ts`
- **Interfaces:** `apps/tagea-backend/src/reports/interfaces/report-validation.interfaces.ts`
- **Trigger-Vorbild (Status-aware):** `apps/tagea-backend/src/database/tenant-migrations/20260603130000-StatusAwareAppointmentAndClientCaseValidation.ts`
- **Listen-Funktionen:** `apps/tagea-backend/src/database/tenant-migrations/20260609120000-AddInvalidFieldKeysListFunctions.ts`
- **Fall-Zähler (ohne Zeit-Gate):** `apps/tagea-backend/src/database/tenant-migrations/20260408100000-UpdateValidationTriggersForParticipantCase.ts`
- **Tasks-Service & DTO:** `apps/tagea-backend/src/tasks/tasks.service.ts`, `apps/tagea-backend/src/tasks/dto/client-task-detail.dto.ts`
- **Doku-Entity:** `apps/tagea-backend/src/appointments/entities/appointment-documentation.entity.ts`
- **Köln-Report-Seed:** `apps/tagea-backend/src/reports/seed-detail-export-koeln.sql`

## Implementierungs-Reihenfolge

1. Migration: Tabelle (`appointment_completion_requirements`) + `sync_…`-Erweiterung (mit `COALESCE`-Guard, R3) + `list_…`-Zweige (Präzisions-Anforderungen oben) + Doku-Trigger (`COALESCE(NEW,OLD).appointment_id`, R7) + Backfill + vollständiges `down()` (R4).
2. Interface (`required_custom_fields` optional) + **Guards `?? []`** (R1) + TS-Spiegelung der Regeln A/B in `report-validation.service.ts`.
3. Tasks-DTO/Sentinel-Handling (Labels, `__`-Präfix).
4. Köln-Seed (`validation_rules`-Block) — Sachstand-Namen erst byte-genau klären (Open Questions).
5. Frontend-Refactor `task-field-section.component.ts` (R2): `__`-Erkennung vor Field-Matching + Inline-Controls (`__response_status`, `__documentation`) + Header-Count ≡ sichtbare Items + i18n 16 Locales.
6. Tests: Unit · SQL-Integration (R4/R7 + Rule-Logik, neue Lücke schließen) · E2E (`/tasks`, s. Test-Plan).
7. Recompute-Sweep (BullMQ, R5) + Monitoring.
