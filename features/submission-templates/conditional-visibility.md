# Conditional Visibility für Submissions (Meldungen) — End-to-End-Plan

> Anschlussprojekt nach `phase-e.md` (Repeating-Sections, fertig & gemerged). Conditional Visibility war dort ausdrücklich geparkt. Dieser Plan basiert auf einem verifizierten Readiness-Audit (6 Dimensions-Investigatoren + adversariale Verifikation, 25/26 Blocker/Major-Claims CONFIRMED) und den darauf getroffenen Produktentscheidungen (§0). Stil bewusst analog zu `phase-e.md` (Deutsch, file:line-Belege, PR-Choreografie, Decision-Ledger).

---

## §0 Getroffene Entscheidungen (2026-06-12) — sie tragen den ganzen Plan

| # | Frage | Entscheid | Konsequenz für den Scope |
|---|---|---|---|
| D1 | Werte aktuell **unsichtbarer** Felder | **Serverseitig beim Schreiben strippen** | Server wertet Visibility selbst aus (client-agnostisch, fängt native App/API). Summary wird autoritativ sauber → Export-Gating wird **redundant** (entfällt bis auf optionalen Altdaten-Backfill). |
| D2 | Pflichtfeld-/Vollständigkeitsmodell | **Point-in-time, KEIN Server-Required-Gate** | **Kein** `invalid_fields`-Workstream: keine `count/list_invalid_submission_fields`, keine `invalid_fields`-Spalte, kein `update_submission_validity`. Required bleibt reines FE-Submit-Gate. |
| D3 | Conditions in **Repeating**-Sektionen | **Voll, inkl. per-Row** | Größter FE-Scope: per-Row-Visibility im Renderer (GAP-FE-1), Cross-Group-Trigger robust (GAP-FE-4), `is_visibility_condition_met_in_row` im Strip-Pass verdrahten. |
| D4 | Stale-Receipt (Condition ändert sich nach Einreichung) | **Point-in-time-Snapshot** (keine Regenerierung) | Konsistent mit Phase-E PO #12. Beleg spiegelt Sichtbarkeit zum Einreichzeitpunkt; D1 sorgt dafür, dass der Snapshot zur Create-Zeit bereits sauber ist. |
| D5 | DB-Scoping der Submission-Field-Defs | **Template-basiert (Case-Muster)**, verifiziert | Strip-Prädikate lösen das Template aus der Submission auf: `cfd.template_type='submission' AND cfd.template_id=…` — analog `list_invalid_case_fields` (`20260609120000:60-61`), NICHT der entity-basierte Client-Pfad (`:274`). |

**Kernkonsequenz:** Die Kombination ist in sich konsistent — der Server garantiert, dass gespeicherte Daten der Sichtbarkeit entsprechen (D1-Strip), das FE rendert volle per-Row-Visibility (D3), aber es gibt kein „Vollständigkeit erzwingen"-Subsystem (D2). Das hält den DB-Scope klein und verlagert die Korrektheit auf einen einzigen Strip-Pass.

---

## §1 Kernbefund (aus dem Audit)

**Conditional Visibility funktioniert für `entity_type='submission'` heute end-to-end praktisch gar nicht — nicht wegen fehlender Auswertungslogik, sondern wegen fehlender Verdrahtung an beiden Enden.** Die generische Maschinerie ist bereits entitäts-agnostisch und „submission-ready":

- FE-Evaluator `evaluateVisibilityCondition()` kennt kein client/case (`apps/tagea-frontend/src/app/utils/custom-field-visibility.utils.ts:13-76`).
- DB-Prädikate `is_visibility_condition_met` (`20260423100000:241`), `is_visibility_condition_met_in_row` (`:329`), `is_group_visibility_condition_met` (`:165`) nehmen `p_entity_type TEXT` und lesen `custom_field_values WHERE entity_type = p_entity_type` — mit `'submission'` rechnen sie korrekt.
- Datenvertrag steht: `toCategoryShape` serialisiert `group.visibility_condition` und `field_definitions[].ui_config.visibility_condition` (`apps/tagea-backend/src/submissions/submission-categories.controller.ts:282-297`); der Renderer `tagea-custom-fields.component.ts` wird von Fill- UND Detail-Edit-Form genutzt.

Es brechen drei Schichten — alle adressiert dieser Plan:
1. **Admin kann nichts anlegen** (anderer Editor-Stack ohne `VisibilityConditionEditor`).
2. **Geseedete Conditions greifen nur im einfachsten Fall** (flach + custom_field-Trigger + Web). Repeating/Cross-Group/Read-only brechen.
3. **Server hat null Visibility-Bewusstsein** (Geisterwerte persistieren + lecken in alle Ausgaben).

---

## §2 Architektur-Entscheid

**Eine Quelle der Wahrheit für „ist Feld X sichtbar": die bestehenden SQL-Prädikate.** Kein zweiter (TS-)Evaluator im Backend — das vermeidet Drift gegenüber FE und DB. Drei tragende Mechaniken:

1. **Authoring** reaktiviert den bestehenden, getesteten `VisibilityConditionEditorComponent` im Submission-Admin (Wiederverwendung statt Neubau).
2. **Server-Strip** (D1) nutzt die SQL-Prädikate in einem Lösch-Pass am Ende der Write-TX. Der Phase-E-Cache-Trigger re-materialisiert das Summary daraufhin sauber.
3. **FE-Render** nutzt den bestehenden entity-agnostischen Evaluator, erweitert um die Repeating-Lücken (D3).

**Verworfen:**
- *TS-Evaluator im Backend zum Pre-Filtern vor dem Write* — dupliziert die Visibility-Semantik (Drift-Risiko ggü. SQL/FE), obwohl es DB-Churn spart. Gegen das Reuse-Prinzip.
- *`invalid_fields`-Parität* (D2 verworfen) — würde Submissions an ein Vollständigkeits-Subsystem koppeln, das ihr „einmalige Meldung"-Charakter nicht braucht.
- *Reines Export-Gating ohne Strip* — lässt historische/native-App-Daten dauerhaft schmutzig; jeder neue Summary-Consumer müsste erneut gaten.

---

## §3 Backend — Write-Pfad & Strip (D1)

### §3.1 Visibility-Strip-Pass (das Herzstück)
Nach dem Schreiben aller Werte in der Create-/Save-TX läuft für `entity_type='submission'` ein Strip-Pass, der unsichtbare Werte löscht. Reuse der SQL-Prädikate, ausgeliefert als SQL-Funktion (idempotent, re-runnable) `strip_invisible_submission_values(p_submission_id uuid)`:

- **Flache Felder:** `DELETE FROM custom_field_values v WHERE v.entity_type='submission' AND v.entity_id=p_submission_id AND v.row_id IS NULL AND NOT (is_visibility_condition_met(v.field_definition_id,'submission',p_submission_id) AND is_group_visibility_condition_met(<group_id der def>,'submission',p_submission_id))`.
- **Repeating-Rows (D3):** analog mit `is_visibility_condition_met_in_row(field_def_id,'submission',p_submission_id,row_id)` plus `is_group_visibility_condition_met(group_id,…)`.

Verdrahtung — **ALLE Submission-Schreibpfade müssen strippen** (Review-Befund PR-4: create + save-all allein lassen Bulk/Single/Row-Routen als Geisterwert-Lecks offen — D1 verspricht „fängt native App/API"):
- **Create** (`submissions.service.ts:321`) und **save-all** (`submissions.controller.ts:1021`): in-TX über den `validityFunction`-Hook von `saveAllCustomFields` (`SELECT strip_invisible_submission_values($1)` am TX-Ende, Z. 1395-1396, exakt wie `update_client_validity`). Create braucht das in-TX zwingend (Orphan-Schutz; Receipt sieht danach sauberen Summary, D4).
- **Bulk-PUT, Single-PATCH, Row-POST/PUT/DELETE** (`submissions.controller.ts:888/1101/1316/1372/1423`): diese Service-Methoden tragen keinen validityFunction-Hook → expliziter **post-write** `stripInvisibleSubmissionValues(id)` (eigene kurze TX mit `SET search_path`). Für Edits unkritisch (Submission existiert schon → kein Orphan).
- Gemeinsame Service-Methode `CustomFieldsValueV2Service.stripInvisibleSubmissionValues` spiegelt den bewährten else-branch (`tenantManager.transaction` + `SET search_path` + `SELECT`).

### §3.2 Auswertungs-Ordnung (Implementierungs-Schärfung, MUSS im Spec stehen)
Die Prädikate lesen **persistierte** Werte. Reihenfolge: erst ALLE eingereichten Werte schreiben, dann strippen — so ist der Trigger-Feldwert beim Auswerten der Abhängigen vorhanden.

**Offene Korrektheitsfrage — Ketten-Conditions (A blendet B blendet C):** Strippen löscht B's Wert; hängt C an B, verschwindet C's Trigger-Wert → C-Sichtbarkeit kann kippen. Das FE erreicht per `valueChanges` reaktiv einen Fixpunkt; ein Single-Pass-Strip nicht. **Entscheid für v1:** Single-Pass gegen den eingereichten Snapshot, Ketten-Verhalten dokumentieren; **ODER** Fixpunkt-Iteration (`DELETE` in Schleife bis 0 Rows betroffen, mit Iterationslimit). Empfehlung: Fixpunkt-Iteration mit hartem Limit (z. B. 10) — deckt reale Ketten ab, FE-konsistent, begrenztes Risiko. Implementierungsdetail, kein Produktentscheid.

### §3.3 Kein Required-Gate (D2)
Bewusst NICHT umgesetzt: server-seitige Pflichtfeld-Durchsetzung. `SubmissionsService.create`/save-all übergeben weiterhin **keine** `validityFunction` (anders als Clients/Cases). Im Spec festhalten: *Required ist ein FE-Submit-Affordance; ein verstecktes ODER sichtbares Pflichtfeld blockiert den Submit serverseitig nicht.* Verhindert stille Erwartung eines invalid_fields-Badges.

### §3.4 Output/Export — wird durch D1 redundant
Da der Summary nach D1 für jede neu geschriebene Submission bereits sauber ist (auch native-App/API-Creates durchlaufen den Strip-Pass), brauchen CSV/Receipt/PDF-Fill **kein** eigenes Visibility-Gate.
- **Optionaler Altdaten-Backfill:** einmalige Migration, die `strip_invisible_submission_values` über alle Bestands-Submissions laufen lässt (re-runnable, Volumen-Gate wie Phase-E-E3). Räumt Geisterwerte aus Pre-Feature-/Alt-App-Beständen. Ohne Backfill bleiben nur Altbestände potenziell schmutzig; neue sind sauber.
- Kein Code an `submission-receipt-generation.service.ts` / `submission-pdf-fill.service.ts` / CSV nötig (geprüfte Vereinfachung ggü. der ursprünglichen Audit-Variante „Export-Gate").

---

## §4 DB — Schema, Funktionen, Migrationen

Minimaler Scope dank D2 (kein invalid_fields-Subsystem):

- **M-CV1:** Funktion `strip_invisible_submission_values(uuid)` (§3.1), idempotent, forward-only. `down()` = No-op mit Kommentar.
- **M-CV2 (optional, decision-gated durch Altdaten-Frage):** Backfill-Migration, die M-CV1 über Bestands-Submissions ruft (Volumen-Gate + Advisory-Lock-Muster aus Phase-E-E3 `20260611180000`).
- **KEINE** `ALTER TABLE submissions ADD invalid_fields`, **KEINE** `count/list_invalid_submission_fields`, **KEIN** submission-Zweig in `trigger_custom_field_value_changed` (D2).
- Cache-Trigger `update_entity_custom_fields_cache` (`20260611160100`) bleibt unverändert — er aggregiert visibility-blind, was nach dem Strip korrekt ist (nur sichtbare Werte sind noch da).
- **Vor M-CV1 verifizieren (D5-Restdetail):** dass Submission-Field-Defs tatsächlich mit `template_type='submission'`+`template_id` gespeichert sind und wie `template_id` aus der Submission auflösbar ist (`submission.category_id` → `submission_templates`; vgl. `custom-field-definition.entity.ts:174-184`, M3 `20260610130000`). Bestimmt die `JOIN`/`WHERE`-Klausel der Strip-Funktion.

Tenant-Migrations-Disziplin (aus Memory): kein `SET search_path FROM CURRENT`; `baseline:generate` vor Commit; defensive Casts; Exceptions = Tenant-Wedge, also fail-soft im Backfill.

---

## §5 Frontend

### §5.1 Consumer — Auswertung/Rendering (D3 voll)
- **GAP-FE-1 (Per-Row):** `TageaRepeatingGroupComponent` rendert pro Row alle Felder ohne `visible()`-Guard (`tagea-repeating-group.component.ts:83-89`); Parent überspringt Repeating bei der Verdrahtung (`tagea-custom-fields.component.ts:733-734 if (group.isRepeating) continue;`). → Per-Row-Visibility-Verdrahtung pro Row-Control-Set inkl. `clear/setValidators` + valueChanges-Subs.
- **GAP-FE-4 (Cross-Group-Trigger in Repeating):** group-level setzt `group.visible(false)` dauerhaft (fail-closed), field-level bleibt sichtbar (fail-open) — Inkonsistenz angleichen. Trigger, dessen Quelle in einer Repeating-Sektion liegt, hat semantisch N Werte → **im Admin als Trigger sperren** (§5.2) und im Renderer robust (kein dauerhaftes Verschwinden).
- **GAP-FE-2 (Read-only-Detail, minor):** `submission-detail-page.component.ts:273-285` iteriert `flatFieldDefinitions()` ohne Condition-Prüfung → ausgeblendete Felder als „-"-Zeilen. Read-only visibility-aware machen (Divergenz Edit vs. Read-only schließen).
- **GAP-FE-5 (minor):** Single-Flat-Group-Pfad `transformToFieldGroups` verwirft `visibility_condition`+`groupId` (`teamspace-submissions-page.component.ts:728-745`) — auf `custom-field-group.utils.ts:60-64` angleichen.
- **Hygiene:** Debug-`console.log/warn` im Renderer raus (`tagea-custom-fields.component.ts:378-422,686-697`).

### §5.2 Admin — Authoring (der Entry-Blocker)
- **FE-ADM-1 (blocker) + FE-ADM-3 (zuerst!):** `AdminFieldEditorComponent` (`pages/administration/shared/custom-fields/admin-field-editor.component.ts`) bekommt den bestehenden `VisibilityConditionEditorComponent`. **Kritisch zuerst:** `buildUiConfig` (`:319-328`) baut `ui_config` frisch → würde eine vorhandene `visibility_condition` (und `show_in_profile_card`) beim Speichern **still löschen**; BE ersetzt `ui_config` ganzheitlich ohne Merge (`custom-field-definitions.service.ts:730-734`). Fix = bestehende `ui_config`-Keys erhalten/mergen. **Kein BE-Change** für Feld-Ebene (Schreibkanal `CreateGroupFieldDto.ui_config: Record` trägt schon).
- **FE-ADM-2/4/5 (Section-Ebene):** Gruppen-Editor setzt `visibility_condition:null` hart (`admin-group-editor.component.ts:151`); end-to-end nicht persistierbar, weil **FE+BE-DTOs das Feld nicht führen** und `forbidNonWhitelisted:true` (`main.ts:111-112`) ein Extra-Feld als **400** ablehnt. → FE `SectionWriteDto`/`SubmissionTemplateSection` + BE `Create/UpdateTemplateSectionDto` (`admin-submission-templates.controller.ts:83-127`) + `submission-templates.service` (persistieren/zurückgeben) + Read-Mapping (`toCardModel`/`sectionToModel`). **Section-Conditions brauchen also FE+BE-DTO-Erweiterung** (anders als Feld-Ebene).
- **Trigger-Feld-Auswahl:** template-weite Felder durchreichen (`allFieldsOf(templateId)` existiert, `admin-submission-categories.component.ts:630`, wird nicht übergeben) mit `useCompositeKeys`+`currentGroupId` → kein Cross-Template-Leak.
- **Authoring-Härtung (aus REFUTED GAP-DB-3):** im Submission-Admin **nur `custom_field`-Trigger-Sources** anbieten (Entity-/Cross-Context-Sources sind für Submissions semantisch sinnlos, kein Client/Fall-Bezug) und Repeating-Felder nicht als Trigger (GAP-FE-4).
- **i18n:** entweder generische `genericTemplateManagement.fieldForm.condition*`-Keys wiederverwenden oder neue `administration.submissions.*`-Keys in **allen 16 Locales** (`de.json` = Source-of-Truth, `validate-all.py` grün).

---

## §6 Teststrategie (gestuft)

**Heute:** nur `custom-field-visibility.utils.spec.ts` (reiner Evaluator, entity-agnostisch). Renderer = **0 Specs**, BE-Save = **0** Visibility-Fälle, **0** E2E für conditional field visibility (auch nicht clients/cases), kein Seed-Fixture (`grep visibility_condition apps/tagea-frontend-e2e/src` = 0).

- **Stufe 1 — FE-Unit (höchster Hebel, kein Backend):** neuer `tagea-custom-fields.component.spec.ts`: (a) verstecktes Feld → `clearValidators` → Submit nicht blockiert; (b) Wieder-Einblenden → `setValidators`; (c) Reset-to-Default; (d) `startWith`-Initial-Eval; (e) **per-Row-Visibility** in `TageaRepeatingGroupComponent` (D3). Orakel = bestehende utils-Spec-Szenarien.
- **Stufe 1 — BE-Unit:** `custom-fields-value-v2.service.spec.ts` um Strip-Fälle erweitern: nach Save eines Werts für ein verstecktes Feld ist der Wert **weg** (flat + row); Ketten-Condition-Fall (§3.2); Strip ist idempotent. Charakterisierung „kein Required-Enforcement" (D2) als Drift-Anker.
- **Stufe 1 — DB/Integration:** `strip_invisible_submission_values` gegen Test-DB: versteckter Flat-Wert/Row-Wert gelöscht, sichtbarer bleibt; `is_visibility_condition_met_in_row` greift; Fixpunkt terminiert.
- **Stufe 2 — API-E2E (`submissions-conditional-visibility.spec.ts`, ROPC):** Seed-Fixture mit `visibility_condition` (direkt in DB, da vor §5.2-Fix nicht authorbar). Fälle: (1) Create mit verstecktem Required leer → 201; (2) Create sendet Wert für verstecktes Feld → Wert **nicht** in `custom_field_values`/`summary` (D1 beweisen); (3) native-App-Pfad (flacher Part) mit verstecktem Wert → ebenfalls gestrippt; (4) Repeating-Row mit Condition; (5) Receipt-PDF/CSV enthalten den versteckten Wert nicht. **Liefert das fehlende Seed-Fixture als Baustein.**
- **Stufe 3 — Playwright:** Consumer Trigger→Hide→Submit→Detail (read-only zeigt es nicht); Admin-Round-Trip (Condition setzen → speichern → reload → Hydration; Cross-Template-Leak-Negativtest) **erst nach** §5.2.

**Heikle Kreuzungen, die ein Test gezielt treffen muss:** (i) verstecktes boolean (Default `false`) → nach Strip weg, nicht „Nein" im Receipt; (ii) native-App/API ohne FE-Reset → Server-Strip fängt es; (iii) Repeating-Row-Condition (Phase-E-Kreuzung, D3); (iv) Cross-Group-Trigger in Repeating-Sektion (GAP-FE-4); (v) Ketten-Condition (§3.2).

---

## §7 PR-Folge & Choreografie

| PR | Inhalt | Komponente | Abhängigkeit | Rollback |
|---|---|---|---|---|
| **PR-1** | **Admin-Authoring Feld-Ebene** — `VisibilityConditionEditor` in `AdminFieldEditor`; `buildUiConfig`-Clobber (FE-ADM-3) **zuerst**; Trigger-Felder template-weit (`useCompositeKeys`); nur `custom_field`-Sources. + Stufe-1-FE-Unit. **Kein BE-Change.** | FE | — | FE-only Revert |
| **PR-2** | **Section/Gruppen-Condition** — FE+BE-DTO + `submission-templates.service` + `AdminGroupEditor`-UI + Read-Mapping (FE-ADM-2/4/5) + i18n 16 Locales. + Admin-Round-Trip-E2E. | FE+BE | PR-1 | FE+BE-Revert; DTO additiv |
| **PR-3** | **Renderer-Härtung (D3 voll)** — Per-Row-Visibility (GAP-FE-1), Cross-Group-in-Repeating (GAP-FE-4), Read-only visibility-aware (GAP-FE-2), Single-Flat-Group (GAP-FE-5). **Trifft auch clients/cases → Regressionstest.** | FE (shared) | PR-1 (zum Testen authorbar) | FE-only Revert; Vorsicht Cross-Entity |
| **PR-4** | **Server-Strip (D1)** — `strip_invisible_submission_values` (M-CV1) + Verdrahtung in create/save-all + Fixpunkt-Iteration (§3.2). + Stufe-1-BE/DB-Unit + Stufe-2-API-E2E. | BE+DB | — (parallel zu PR-1..3) | Migration forward-only; Verdrahtung revertierbar |
| **PR-5** | *(optional)* **Altdaten-Backfill** (M-CV2) — Strip über Bestands-Submissions, Volumen-Gate. | DB | PR-4 | No-op-down |

**Choreografie:**
1. PR-1 ist der Schlüssel — ohne Authoring-UI kein end-to-end Test; entriegelt sofort den häufigsten Fall (flaches Feld an flachem Feld).
2. PR-4 (Strip) ist von PR-1..3 **unabhängig** und kann parallel laufen — es härtet die Datenebene unabhängig vom Authoring. Sinnvoll **vor** breiter Tenant-Nutzung live, damit nie Geisterwerte entstehen.
3. PR-3 trifft geteilten Renderer-Code → eigener Regressionslauf clients/cases/appointments.
4. PR-5 nur, wenn Altbestände (Pre-Feature/Alt-App) bereinigt werden sollen.

---

## §8 Risiko-Register

| # | Risiko | Mitigation | Rest-Risiko |
|---|---|---|---|
| R1 | Ketten-Conditions: Single-Pass-Strip divergiert vom FE-Fixpunkt | Fixpunkt-Iteration mit Limit (§3.2) + Test (v) | Sehr tiefe Ketten > Limit (unrealistisch) |
| R2 | PR-3 berührt geteilten Renderer → clients/cases-Regression | Cross-Entity-Regressionstest, FE-Unit als Orakel | Subtile Render-Drift |
| R3 | Strip löscht Wert, den der Nutzer eigentlich sah (Visibility-Fehlkonfiguration) | Strip exakt = FE-Sichtbarkeit (gleiche Prädikate); History-Trigger protokolliert Löschung | Fehlkonfigurierte Condition = Datenverlust by design (gewollt: unsichtbar ⇒ kein Wert) |
| R4 | `forbidNonWhitelisted` 400 bei Section-Condition vor DTO-Erweiterung | PR-2 erweitert FE+BE-DTO atomar | — |
| R5 | i18n-Drift (16 Locales) bricht Pre-Push | `validate-all.py`, `de.json` Source-of-Truth | — |
| R6 | Strip-Funktion `template_id`-Auflösung falsch (D5-Restdetail) | Vor M-CV1 Schema verifizieren (§4) + DB-Integrationstest | — |
| R7 | native-App schickt Wert für (ihr unbekanntes) Trigger-/verstecktes Feld | Server-Strip ist client-agnostisch → fängt es; Phase-E-field_definitions-Exclusion bleibt | Alt-App sieht Condition-Effekt nicht (akzeptiert, wie Repeating) |

---

## §9 Was NICHT in Scope ist (bewusst)
- `invalid_fields`/Vollständigkeits-Subsystem für Submissions (D2).
- Export-seitiges Visibility-Gating als eigener Pfad (durch D1-Strip redundant; nur optionaler Backfill PR-5).
- Entity-/Cross-Context-Trigger für Submissions (semantisch sinnlos; im Admin gesperrt). GAP-DB-3 ist als Bug **REFUTED** — die Evaluatoren werden für submission nie aufgerufen; bleibt reine Authoring-Härtung.
- Row-Level-History (`row_id` in `custom_field_values_history`) — bereits in Phase-E PO #10 als separates Ticket geparkt; betrifft auch Cases.

---

> **Spec-Status:** Plan/Design, noch kein Code. Quelle der Befunde: Readiness-Audit 2026-06-12 (Workflow `submissions-conditional-visibility-audit`, 33 Agenten, file:line-verifiziert). Memory-Pointer: `project_submissions_conditional_visibility_audit`. Submodul-Hinweis: Datei liegt im `specs`-Tree neben `phase-e.md`; Branch-/Commit-Strategie offen (beim Schreiben war `specs` auf `spec/appointment-series-anchor` ausgecheckt, nicht `spec/submission-templates`).
