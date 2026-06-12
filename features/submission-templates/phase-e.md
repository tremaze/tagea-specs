Alle tragenden Critique-Behauptungen wurden vor der Synthese stichprobenartig im Code nachverifiziert: `saveAllCustomFields` hat keinen `manager`-Parameter und öffnet die eigene TX (`custom-fields-value-v2.service.ts:944-950, 1259`); der Cache-Trigger filtert `WHERE cfg.key IS NOT NULL` in BEIDEN Pässen (`20260317100001:114` und `:317`); der Flach-Write existiert (`submissions.service.ts:197-198`); `showRepeating=false` an exakt 3 Submission-Sites (`admin-submission-category-dialog.component.ts:92`, `admin-submission-categories.component.ts:468, 500`), Editor-Default `true` (`admin-group-editor.component.ts:80`), vierte Site in `planung/template-group-edit-dialog.component.ts:30` (`?? true`). Damit der finale Plan:

---

# Phase E — Repeating-Sections für Submissions: Finaler End-to-End-Plan

## §1 Kernbefunde & Überraschungen (was die Hypothese geändert hat)

**Die Planungs-Hypothese („EAV + Cache-Trigger M4 + Backfill bauen") ist in 2 von 3 Teilen falsifiziert:**

1. **EAV ist fertig und live.** `custom_field_values` mit `row_id` (`custom-field-value.entity.ts:79-88`, Migration `20260224120000`), V2-Service mit `entity_type='submission'` in allen Methoden, Row-CRUD-Routen live (`submissions.controller.ts:974-1057`), History/at-time live (`:863`), E2E-getestet (`submissions-content-edit.spec.ts:251-305`). Dev-DB beweist 4 EAV-Rows für 2 Submissions.
2. **„M4" existiert bereits.** Neueste Trigger-Version ist `20260317100001-UpdateCacheTriggerForIbanBic.ts` (nicht `20260224130000`): Submission-Case (Z. 163-167) + Repeating-Pass (Z. 84-124) vorhanden. Kein neuer Trigger nötig — aber zwei Trigger-Gaps (Keying, Ordnung, s. §3).
3. **Backfill ist nötig — aber aus einem anderen Grund als gedacht:** nicht für Repeating, sondern um den **heute schon scharfen PATCH-Wipe-Bug** zu entschärfen: `createSubmission` schreibt nur flach JSONB (`submissions.service.ts:197-198`); der erste v2-Single-PATCH (`submissions.controller.ts:798`) rebuildet das Summary komplett aus EAV und **löscht alle Create-Werte**.

**Vier Überraschungen, die den Plan tragen:**
- **Dev-Rätsel `summary={}` trotz EAV-Rows gelöst:** beide Submission-Gruppen haben `key=NULL`; der Trigger droppt keylose Gruppen stumm (`WHERE cfg.key IS NOT NULL`, `20260317100001:114/317`). Keys werden nirgends auto-generiert (`custom-field-groups.service.ts:199`).
- **Alle drei Submission-Reader brechen an EAV-Shapes:** Trigger schreibt verarbeitete Select-Objekte (`{selected_id, selected_label, …}`) ins Summary; CSV (`submissions.service.ts:2358-2406`), PDF-Fill (`submission-pdf-fill.service.ts:426-448`) und Receipt (`submission-receipt-generation.service.ts:375-411`) erwarten rohe Strings → `[object Object]` in versandten Beleg-PDFs — **heute schon nach jedem v2-Edit reproduzierbar**.
- **Row-Routen sind IDOR-offen:** POST/PUT/DELETE rows machen keinen Ownership-Check (`submissions.controller.ts:992-1057`), `saveRepeatingGroupRow` prüft weder Template-Bindung noch `group.entity_type` (`custom-fields-value-v2.service.ts:728-734`).
- **„In derselben TX" ist mit heutigen Signaturen unmöglich:** Create läuft über `tenantWriteService.executeWrite` (eigene Write-Connection, `tenant-write.service.ts:247-303`), `saveAllCustomFields` öffnet die eigene TX auf anderem Pool (`custom-fields-value-v2.service.ts:1259`).

## §2 Architektur-Entscheid (mit verworfenen Alternativen)

**Entscheid: EAV-first (Vollumstieg). JSONB `custom_fields_summary/full` wird reiner Trigger-gepflegter Read-Cache.** Create schreibt Werte über `saveAllCustomFields` — **nach Refactor mit externem `EntityManager`-Parameter** (Muster: `deleteCustomFieldValue`-manager-Param `custom-fields-value-v2.service.ts:554`; Präzedenz: OutlookSync-Refactor) — innerhalb der `executeWrite`-TX des Creates. Der Trigger materialisiert summary/full in derselben TX; Reader lesen weiter den Cache.

**Verworfene Alternativen:**
- **Dual-Write (JSONB direkt + EAV parallel):** Der Trigger überschreibt den direkt geschriebenen JSONB beim nächsten EAV-Write komplett — erzeugt exakt die beobachtete Divergenz und den Wipe-Bug. Zwei Wahrheiten, ein destruktiver Rebuild.
- **Flat-only + Rows in JSONB einbetten:** bricht History-Trigger, bricht die live geschalteten Row-Routen, Kollisions-Guard müsste Row-Strukturen verstehen, null Wiederverwendung des Case-Musters.
- **Submission-eigene Persistenz:** generische Maschinerie (Rows, History, at-time, Cache) existiert und ist getestet — Neubau verstößt gegen Wiederverwendung.
- **„saveAll nach executeWrite aufrufen" (nicht-atomar):** verworfen wegen Orphan-Submissions ohne Werte bei CF-Save-Fehler, Receipt/Notify liefen mit leeren Feldern (Rollout-Kritik F1, Szenario B).
- **Aufruf innerhalb executeWrite OHNE Manager-Refactor:** verworfen — CFV-TX auf fremder Connection sieht die uncommittete Submission-Row nicht, Trigger-UPDATE matcht 0 Rows, bei Rollback EAV-Orphans (kein FK auf submissions).

## §3 Datenmodell / Trigger / Migrationen

**Kein neuer Trigger, keine neue Tabelle (außer optional Backfill-Log). Drei Migrationen (M-E1…M-E3) + ein Service-Refactor.**

### M-E1a — `BackfillSubmissionGroupKeys` (in PR-E1)
- Inhalt: Für `custom_field_groups` mit `entity_type='submission' AND is_repeating=true AND key IS NULL` Slug aus dem Namen generieren (Muster `slugifyRelationshipType`/Fallback `client-report-docx.service.ts:302,317`).
- **Kollisionsprüfung M:N-korrekt (Rollout-F7):** Slug gegen field_keys UND fremde Gruppen-Keys **aller Templates, an denen die Gruppe via `template_custom_field_groups` hängt**, dedupen; bei Kollision Suffix `-2`, `-3`… + `RAISE WARNING`-Report. Grund: DB erzwingt Eindeutigkeit für Submission-Gruppen NICHT (`idx_custom_field_groups_key_institution_unique` greift wegen `institution_id=NULL`/NULLs-distinct nicht — Daten-F13), und der Trigger `GROUP BY cfg.key` (`20260317100001:115`) vermischt gleich-keyige Gruppen stumm zu einem rows-Array.
- Idempotent: nur `key IS NULL` wird angefasst; Re-Run = No-op.
- down(): No-op (Keys stören nicht; Revert-Hinweis s. Risiko R10/Rollout-F14).

### M-E1b — `UpdateCacheTriggerRowOrdering` (in PR-E1, übernimmt Daten-F9)
- Inhalt: Cache-Trigger-Funktion neu deployen mit deterministischer Row-Ordnung `ORDER BY MIN(cfv.created_at), row_id` statt `ORDER BY row_data->>'row_id'` (`20260317100001:96`) — sonst wechseln CSV-Spalten-/AcroField-Zuordnungen („Eintrag n") nach jedem Row-Add, und Cache-Read (Zufallsorder) divergiert vom Live-Read (`created_at ASC`, `custom-fields-value-v2.service.ts:621`).
- **Cross-Entity-Risiko bewusst akzeptiert** (Kritik-Vorbehalt): Änderung ist rein ordnungsverbessernd; Absicherung über Client-Report-DOCX-Snapshot-Tests (`client-report-docx.slug.spec.ts`) + Case-Repeating-E2E. Alternative (alle Submission-Reader auf Live-Read umstellen) verworfen: N Extra-Queries, Shape-Divergenz bliebe für FE-Cache-Reads bestehen.
- **NICHT enthalten (verworfen, ex-PO #5):** `COALESCE(cfg.key, slug(name))`-Fallback im Trigger. Begründung: Key-Pflicht wird app-seitig erzwungen (M-E1a + Guard); Trigger-seitige Key-Erfindung würde Keys erzeugen, die nirgends in Definitionen/Guards existieren → Kollisions-Guard liefe ins Leere. Keylose Gruppen anderer Entity-Typen = separates Ticket (PO #9).
- down(): vorherige Funktionsversion wiederherstellen (Trigger-Migrationen tragen den alten Body, Bestandsmuster).
- **Touch-Pass am Ende (Daten-F8):** `UPDATE custom_field_values SET updated_at=updated_at WHERE entity_type='submission'` (eine Row pro Entity genügt) — materialisiert Bestands-Summaries der Repeating-Submissions (Dev: 2× `{}`), denn der Trigger feuert nur auf CFV-Writes. Kein History-Spam: History-Trigger prüft nur value-Spalten via `IS DISTINCT FROM` (`20251123000002:261-265`).

### M-E3 — `BackfillSubmissionCustomFieldValues` (in PR-E3)
- **Auslieferung als idempotente, re-runnable SQL-Funktion** (z. B. `backfill_submission_custom_field_values()`), Migration ruft sie nur auf (Rollout-F5: nach einem E2-Revert+Re-Deploy muss der Backfill pro Tenant wiederholbar sein, die Migration läuft nicht erneut).
- Quelle: `submissions.custom_fields_summary`, Join auf `custom_field_definitions` über `field_key` der via `template_custom_field_groups` ans Template (`category_id` → `submission_templates` seit M3 `20260610130000`) attachten Gruppen.
- **Shape-erhaltend (Daten-F2, ersetzt Architekten-Annahme „Zielformat"):** Legacy-Summaries enthalten ROHE FE-Shapes (select=String, multiselect=string[], date=`YYYY-MM-DD`, number — `tagea-custom-fields.component.ts:1388-1427`; Create transformiert nichts, `submissions.service.ts:146-148`). Rohe Werte gehen 1:1 nach `value_json` bzw. typed columns; **keine Objekt-Rekonstruktion** (`selected_at` wäre Datenerfindung). Der Trigger-Rebuild reproduziert dann exakt das heutige Summary → Reader-Verhalten ändert sich nicht; die Objekt-Shapes ab dem ersten Edit fängt PR-E0 ab.
- **Konfliktbehandlung (Daten-F7+F14):** `INSERT … ON CONFLICT (entity_type, entity_id, field_definition_id) WHERE row_id IS NULL DO NOTHING` — gezielt auf den **partiellen** Index `UQ_cfv_entity_field_standard` (das alte `UQ_cfv_entity_field` wurde durch `20260225100000` gedroppt; Architekten-Zitat war stale). Zusätzlich `pg_advisory_xact_lock(hashtext(schema))` am Funktionsanfang — Tenant-Migrationen locken im Gegensatz zu Meta-Migrationen NICHT (`tenant-connection.service.ts:282` vs. `:445-470`); zwei Backend-Instanzen dürfen den Tenant nicht wedgen.
- **Defensive Casts (Daten-F12, ersetzt „fail-loud bei Werten"):** Create hat nie validiert → `"12,5"` in number, Garbage-Dates, `"true"`-Strings sind möglich. Werte werden regex-/`jsonb_typeof`-geprüft gecastet; nicht-castbare Werte → Orphan-Log, NIEMALS Exception (Memory-Lehre: Migrations-Exception = Tenant-Wedge). Fail-loud nur für Strukturfehler (Tabelle/Spalte fehlt).
- Definition-Join: **NICHT** `is_active=true` filtern (Werte deaktivierter Felder sind keine Orphans); `{rows:…}`-Objekte (post-E2-Summaries) und `field_type='label'` ausnehmen (Daten-F12).
- Orphan-`field_keys` (Wert ohne Definition, SKB-Muster): Original-JSONB-Snapshot pro betroffener Submission in `custom_fields_backfill_log` + `RAISE WARNING` + Sentry, dann aus dem Live-Cache fallen lassen (PO #3). Wichtig, weil der Trigger-Rebuild beim Backfill-INSERT Orphans aus dem Summary entfernt.
- **History-Nebenwirkungen dokumentieren:** Einträge mit `changed_by=NULL` (Test: History-Tabelle erlaubt NULL, `getFieldHistory`-Employee-Join ist LEFT — Rollout-F10) und `changed_at=NOW()` → at-time-Anfragen vor Migrationszeitpunkt liefern `{}` für Legacy-Submissions; akzeptiert, dokumentiert (Daten-F15; `changed_at=submitted_at` via Trigger-Suppression verworfen: zu invasiv).
- **Kosten (Daten-F17, Rollout-F8):** Tenant-Migrationen laufen in EINER Sammel-TX beim Connect (`runMigrations()` ohne Optionen, `tenant-connection.service.ts:458`); Trigger rebuildet O(rows²) pro Entity + History-Row + Row-Lock auf `submissions`. Vor Prod: Count-Sweep über alle Tenants (Submissions × Keys); über definiertem Schwellwert registriert die Migration nur die Funktion, Run erfolgt manuell (PO #11). Inserts pro Entity bündeln.
- **Touch-Pass** für Entities ohne flache Werte aber mit EAV-Rows (Rest aus M-E1b-Lücke), idempotent.
- down(): No-op mit Kommentar (forward-only Datenmigration; EAV ist additive Obermenge).
- **Explizit KEINE Heilung bereits gewipter Bestände (Daten-F5):** Submissions, die vor E3 einen v2-Write sahen, haben Create-Werte unwiederbringlich aus summary UND full verloren (History existiert für sie nicht). Vor Prod-E3: Betroffene identifizieren (EAV-Key-Menge < Template-Feldmenge) und Verlust dokumentieren; einzige Restquelle ist der Beleg-PDF in S3. Der Plan behauptet NICHT mehr, E3 „entschärfe" rückwirkend.

## §4 Write-Pfad & Wire-Format (inkl. Alt-App-Kompatibilität)

**a) Service-Refactor (Voraussetzung, Daten-F3 = Rollout-F1):** `saveAllCustomFields(…, manager?: EntityManager)` — TX nur selbst öffnen, wenn kein Manager übergeben (Muster `deleteCustomFieldValue` Z. 548-559). Achtung auf die dokumentierte Pool-Falle „Reads in fremder TX brauchen den TX-Manager" (`custom-field-definitions.service.ts:885-889`): Phase-1-Validierungs-Reads müssen entweder vor TX-Begin oder über den übergebenen Manager laufen. **CFV-Writes ans TX-Ende** legen: `trg_custom_field_value_changed` setzt `SET LOCAL search_path` für den TX-Rest (Daten-F16) — nach dem ersten CFV-Write keine unqualifizierten public-/Meta-Zugriffe mehr.

**b) createSubmission (`submissions.service.ts:102-271`):** Submission-Row in der `executeWrite`-TX anlegen (summary/full starten `{}`; direkte Zuweisung Z. 197-198 entfällt), dann `saveAllCustomFields(submission.id, 'submission', {fields, repeating_groups}, employeeId, undefined, txManager)` am TX-Ende. Receipt (`generateAndSaveReceipt` Z. 234-246) und Notify (Z. 252-268) erst NACH dem CF-Save (sehen Trigger-gefüllte Werte).

**c) Lenient-Create-Semantik (Daten-F4 = Rollout-F3 — Verhaltensbruch abgefangen):** Heute akzeptiert Create JEDEN JSON; `saveAllCustomFields` macht bei einem failedField early-return mit `success:false` und NULL Writes (`custom-fields-value-v2.service.ts:1237-1251`). Beides ist für Create falsch (Submission ohne jegliche Werte ODER 400 wo heute 201 — Alt-App-Regression unabhängig von Repeating). Create bekommt einen **Lenient-Modus**: ungültige/unbekannte/inaktive Felder pro Feld droppen + Sentry-loggen, Rest speichern (PO #5 entscheidet zwischen drop+log und `validation_state='invalid'`). Pflicht-E2E: Create mit Orphan-Key → restliche Werte landen in EAV+Summary.

**d) Template-scoped Definition-Resolution (Daten-F6):** `getFieldDefinitionByKey` löst global per Key auf (`custom-field-definitions.service.ts:891-919`, kein Template-Scope, kein Ordering) — bei legal duplizierten field_keys über Templates gewinnt eine arbiträre Definition (falsche group → falsche is_repeating-Skip-Entscheidung Z. 1000-1006). Create/save-all für Submissions lösen Definitionen über die Junction des Templates (`category_id`) auf.

**e) Wire-Format Create (multipart, `submissions.controller.ts:178-195`):**
- Part `custom_field_values` (JSON-String, flach) bleibt EXAKT wie heute.
- **Fail-loud statt silent skip (Rollout-F2a):** Enthält der flache Part field_keys aus Repeating-Gruppen → **400 mit klarer Meldung** (nur im Create-Pfad; der generische `continue`-Skip in `custom-fields-value-v2.service.ts:999-1007` bleibt für bulk unverändert). Alte App darf Repeating-Daten niemals kommentarlos verlieren.
- Neuer optionaler Part `custom_field_repeating`: `Record<groupId, {created: [{tempId, fields}], updated: [], deleted: []}>` (FE-Pending-Format `tagea-custom-fields.component.ts:19-24`); non-empty `updated/deleted` beim Create → 400. JSON.parse beider Parts try/catch → 400 (Muster Z. 182-191).
- **Capability-Marker (Rollout-F2b):** Neues FE sendet den Part IMMER (auch leer `{}`). Part fehlt + Template hat Repeating-Gruppen → Sentry-Warning + Zähler (macht Alt-App-Nutzung UND Rolling-Deploy-Fenster sichtbar, Rollout-F6).
- **Server-Flag (Rollout-F4+F9):** Der Repeating-Part wird erst akzeptiert (sonst 400 „Feature nicht aktiv"), wenn das serverseitige Submission-Repeating-Gate offen ist — Gate schließt gemeinsam: Create-Part, save-all-repeating, Row-Write-Routen. Das ist der echte Kill-Switch; der FE-Toggle ist keiner.

**f) Edit-Pfade:** PUT bulk (`:748`, skippt Repeating bewusst ✅), PATCH single (`:798`), Row-Routen (`:974-1057`) bleiben. **Neu: PUT `:id/custom-fields/v2/save-all`** spiegelbildlich zu `cases.controller.ts:886` (gleiches `SaveAllCustomFieldsRequest`-DTO).

**g) Ownership/Binding-Härtung (Daten-F10 — heute schon offen, zieht nach vorn in PR-E0):** Alle vier Row-Routen + neue save-all-Route: `findOne(id, teamspaceId)`-Access-Check (wie GET rows `:988`) UND „groupId ∈ template_custom_field_groups(category_id)" UND `group.entity_type='submission'`. Ohne das schreibt Teamspace A in Submissions von Teamspace B bzw. hängt Client-Gruppen an Submissions, deren Keys der Trigger klaglos ins Summary merged.

**h) History/at-time für Repeating (Daten-F11):** `custom_field_values_history` hat keine `row_id`-Spalte (`20251123000002:32-154`); at-time multipliziert über den row-blinden Join (`custom-fields-value-v2.service.ts:1601-1676`), `getFieldHistory` mischt alle Rows. **Phase-E-Entscheid: Repeating-Definitionen aus history/at-time-Antworten explizit ausschließen + dokumentieren** (PR-E4); row_id-Nachrüstung in History-Tabelle+Trigger = Follow-up (PO #10). Begründung: betrifft auch Cases (Repeating dort schon live), gehört nicht in den Submission-Cut.

## §5 Ausgabe-Pfade je Kanal

**Vorab — PR-E0 Shape-Normalisierung (Daten-F1, BLOCKER, vor allem anderen):** Alle drei Reader normalisieren EAV-Shapes (Objekt → `selected_label` bzw. `selected[].label`, analog `getDisplayValue()` `custom-field-value.entity.ts:307-353`):
- CSV `formatCustomFieldValue` (`submissions.service.ts:2358-2406`)
- PDF-Fill (`submission-pdf-fill.service.ts:426-448`)
- Receipt `formatFieldValue` (`submission-receipt-generation.service.ts:375-411`)
Heute produziert jeder v2-Edit `[object Object]` in per Mail versandten Belegen; mit E2 wäre es 100 % der Neuanlagen. FE ist ok (Normalisierung existiert, `tagea-custom-fields.component.ts:872-875`).

| Kanal | Umsetzung | Anmerkungen |
|---|---|---|
| **CSV** (`submissions.service.ts:2012-2296`) | Eine Zeile pro Submission; pro Gruppe nummerierte Spalten `<groupKey>_<n>_<fieldKey>` + `<groupKey>_count`. **Deterministische Spaltenzahl** (Rollout-F12): `max_rows` der Gruppe, sonst dokumentiertes Cap — NICHT Max-Row-Count des jeweiligen Exports (bräche BI-Konsumenten zwischen Exporten). Iteration über Gruppen-Defs, Werte aus `summary[group.key].rows` (Ordnung deterministisch dank M-E1b). | PO #1 |
| **PDF-Fill / AcroForm** (`submission-pdf-fill.service.ts:119-284`) | AcroField-Konvention `<groupKey>_<n>_<fieldKey>`; überzählige Rows still gekappt (dokumentiert) — AcroForms sind statisch. | PO #2 |
| **Receipt-PDF** (`submission-receipt-generation.service.ts:39-432`) | Voll: pro Row ein Unterabschnitt („<Gruppenname> — Eintrag n") über die `addFormFields`-Logik. **Receipts sind create-time-persistiert** (`submissions.service.ts:234-246`) → E5 MUSS vor der Öffnung des Repeating-Parts live sein (Rollout-F9), sonst sind Belege betroffener Submissions permanent unvollständig. Receipt-Regeneration-Tool für Altfälle: PO #12. | — |
| **E-Mail-Notification** (`submissions.service.ts:1748-1808`) | Nichts tun — Werte gehen nur als PDF-Anhang mit; Repeating via Receipt automatisch drin. | PO #7 |
| **Client-Report DOCX** (`client-report-docx.service.ts:306-327`) | Nichts tun — Loop-Pattern existiert, dient als Keying-Referenz; Snapshot-Tests sichern M-E1b ab. | — |
| **FE-Detailansicht** | Read-only aus `summary[group.key].rows` (Cache-Read), Select-Objekte normalisiert; Edit-Modus über `TageaCustomFieldsComponent` + save-all. Keine Metadaten für Rows versprechen: `full` trägt für Repeating KEINE Wrapper (`full := standard_full \|\| repeating_summary`, `20260317100001:124`; FE-Fallback `submission-mappers.ts:130`) — Daten-F18. | — |
| **DetailExportService (Cases)** | Out of scope (eigene Welle). | PO #9 |

## §6 Frontend (Admin + Consumer)

1. **Admin-Toggle — alle DREI Sites flippen (Rollout-F4):** `admin-submission-category-dialog.component.ts:92` UND `admin-submission-categories.component.ts:468, 500`. Vierte Site `planung/template-group-edit-dialog.component.ts:30` (`?? true`) vor E7 verifizieren, dass sie unberührt bleibt (Rollout-Minor 13). Beim Aktivieren von `is_repeating`: Key-Generierung backend-seitig, FE zeigt Key read-only; Admin-Warnhinweis zur Alt-App (PO #6).
2. **Consumer-Form (`teamspace-submissions-page.component.ts:732-735`):** vor `createSubmission()` zusätzlich `getRepeatingGroupChanges()` lesen (`tagea-custom-fields.component.ts:1248-1254`), in `createSubmissionFormData` (`submission-mappers.ts:261-281`) als zweiten JSON-Part serialisieren — **immer, auch leer** (Capability-Marker). Keine neue Komponente: `TageaCustomFieldsComponent` rendert Repeating bereits; `mapTemplateGroupsToFieldGroups` leitet `is_repeating/max_rows/row_label_template` durch (`custom-field-group.utils.ts:61-63`).
3. **Verwalter-Edit:** Case-Muster (`case-falldaten-tab.component.ts:617-623, 721-729`): `saveAllCustomFieldsV2()` mit `{fields, repeating_groups}` gegen die Submission-save-all-Route; nach Save `markAsPristine()` (`tagea-custom-fields.component.ts:1286-1302`).
4. **Detailansicht read-only:** Rows aus `summary[group.key].rows`, Stil an Case-Detail.

## §7 PR-Folge + Deploy-Choreografie

| PR | Inhalt | Migrationen | Tests / Verifikation | Rollback |
|---|---|---|---|---|
| **E0 — Sofort-Härtung** (unabhängig von Phase E, zeitnah) | (a) Shape-Normalisierung CSV/PDF-Fill/Receipt (Daten-F1); (b) Ownership+Binding-Checks auf allen 4 Row-Routen (Daten-F10) | keine | Unit Formatter (Select/Multiselect-Objekt→Label); API-E2E: v2-PATCH auf Select-Feld → CSV/Receipt zeigt Label; 403/404 für fremden Teamspace + fremde Gruppe | gefahrlos revertierbar; (b) NICHT reverten (Security) |
| **E1 — Keys, Ordnung & Guard** | Key-Autogenerierung+Pflicht für Submission-Repeating-Gruppen (inkl. template-scoped-Lücke `custom-field-groups.service.ts:199`); Kollisions-Guard um Gruppen-Keys erweitern (`submission-templates.service.ts:376-414`) **auch im Update-Pfad** (Rename umgeht Attach-Guard, Rollout-F7b) | M-E1a (Key-Backfill, M:N-kollisionsfest) + M-E1b (Trigger-Ordnung + Touch-Pass) | Unit Slug/Kollision/409 (attach+update); Migration-Idempotenz-Spec; DOCX-Snapshot (Cross-Entity-Ordnung); Dev-DB: summary der 2 Repeating-Submissions ≠ `{}` | Code-Revert harmlos (Keys bleiben); Achtung: Guard verschwindet mit → Re-Deploy-Backfill muss kollisionsfest re-runnen (ist er; Rollout-F14) |
| **E2′ — Create-Pfad EAV-first** | `saveAllCustomFields`-Manager-Refactor (F3); Create via TX-Manager, CFV-Writes ans TX-Ende (F16); Lenient-Create (F4, nach PO #5); Fail-loud flache Repeating-Keys (Rollout-F2a); Template-scoped Resolution (F6); Part `custom_field_repeating` **hinter Server-Flag, initial ZU** (Rollout-F4/F9); Capability-Marker-Logging (F2b); Receipt/Notify nach CF-Save | keine | Unit Refactor (TX-Manager-Pfad); API-E2E: create flach→Summary via Trigger gefüllt; Orphan-Key→Rest gespeichert+Sentry; flacher Repeating-Key→400; Part bei geschlossenem Flag→400; History-Einträge vorhanden; Alt-Format-Regression grün | Revert stellt Z. 197-198 wieder her; **nur gemeinsam mit E3-Repair-Run revertierbar** (s. Choreografie) |
| **E3 — Bestands-Backfill** | Re-runnable SQL-Funktion + Migration-Aufruf; ON CONFLICT auf `UQ_cfv_entity_field_standard` + Advisory-Lock; defensive Casts; shape-erhaltend; Orphan-Log; Touch-Pass; Wiped-Kohorten-Report vorab | M-E3 (+ `custom_fields_backfill_log`) | Migration-Spec: Idempotenz, Orphan-Pfad, Garbage-Werte (kein Throw), `changed_by=NULL`-History sichtbar; **Property-Test Summary-Diff vorher/nachher pro Submission** (Rollout-F11); QS-Smoke: PATCH auf Bestands-Submission wipet nicht mehr | forward-only, No-op-down; Funktion bleibt für Repair-Runs |
| **E4 — save-all + Edit-Härtung** | PUT save-all (Spiegel `cases.controller.ts:886`) mit Ownership+Binding-Checks; `max_rows`-Enforcement in `saveRepeatingGroupRow` verifizieren/nachrüsten; Repeating-Ausschluss in history/at-time (F11) | keine | API-E2E: save-all flach+Rows+delete; 403; max_rows-Fehler; history/at-time ohne Repeating-Keys | Route entfernen; Row-Einzelrouten bleiben (gehärtet aus E0) |
| **E5 — Outputs** | Receipt-Rows; CSV deterministische nummerierte Spalten; PDF-Fill-Konvention (nach PO #1/#2) | keine | Unit CSV-Spaltenbau (fixe Spaltenzahl); Snapshot Receipt mit 2 Rows; PDF-Mapping-Spec | additiv, gefahrlos |
| **E6 — FE Consumer + Verwalter** | Submit-Wiring (Part immer senden), Detail-read-only, Verwalter-save-all | keine | FE-Unit Mapper; Playwright: Submission mit 2 Rows → Detail zeigt Rows → Receipt enthält Rows | FE-only Revert |
| **E7 — Unlock + E2E-Welle** | Server-Flag öffnen + alle 3 `showRepeating`-Sites; Admin-E2E (Toggle, Key-Anzeige, 409 im UI); `submissions-content-edit.spec.ts` um Row-Welle erweitern (dort Z. 11 ausgeklammert) | keine | volle Kette Admin→Consumer→Edit→Export | Server-Flag schließen = echter Kill-Switch (FE-Revert allein gated nur NEUE Konfiguration, nicht das Feature — Rollout-F4) |

### §7a E2′-Review-Findings als Input für E4/E5/E7 (Code-Review 2026-06-11, latent hinter geschlossenem Flag)

1. **Deaktiviertes Repeating-Feld = Catch-22 (E4):** Rows validieren in `saveAllCustomFields` gegen `is_active=true`-Definitionen → kürzlich deaktiviertes Feld in einer Row ⇒ „Unknown field" ⇒ 400 + Rollback der ganzen Submission. Es gibt (anders als flach, PO #5) keinen Lenient-Pfad für Rows. E4 muss die HYBRID-Semantik auf den Rows-Zweig ausdehnen, bevor E7 das Flag öffnet.
2. **Phantom-Row (E4, betrifft auch Cases heute):** Eine created Row, deren Werte sämtlich leer sind, schreibt 0 `custom_field_values`, zählt aber `repeating_groups_created` hoch und verfälscht die max_rows-Rechnung derselben Request. Leere created-Rows vor dem Write filtern.
3. **Row-Write-Batching (E5-Perf):** Pro Value ein einzelner `save()` ⇒ Cache-Trigger O(k²) pro Create/save-all. Für große Templates Inserts pro Entity bündeln (deckt sich mit M-E3-Hinweis „Inserts pro Entity bündeln").
4. **Flag-Konsistenz dokumentiert:** Create-Part wirft 400 (Plan §4e wörtlich), Row-Routen werfen 403 (konsistent zu Modul-Guards). Bewusste Asymmetrie, kein Bug.
5. **Gruppen-Governance (aus E4+E5-Review, Follow-up-Ticket):** `is_repeating` ist nach Anlage mutierbar — ein Flip flat→repeating mit Bestandsdaten versteckt die alten Flach-Werte in den Exporten, ein Flip repeating→flat lässt Row-History wieder in history/at-time einsickern. Phase E behandelt Flips populierter Gruppen als unsupported; ein Guard im Gruppen-Update gehört in ein eigenes Ticket.

### §7b E6-Review-Findings (Code-Review 2026-06-12) — gefixt vs. E7-Pflicht

**In E6 gefixt:** Consumer-Form nutzt den Gruppen-Renderer jetzt auch bei EINER Repeating-Sektion (sonst flacher Render → Create-400); Submit liest flache Werte via `getCurrentValues()` (kein Debounce-Stale mehr); Detail-Read-only filtert geflättete Repeating-Felder raus (kein Doppel-Render) und `repeatingSections` filtert `is_active`; Save-Reload-Fehler bleibt nicht mehr stumm (Edit-Modus offen + Warnung).

**E7-Pflicht (vor Flag-Öffnung verifizieren):**
1. **Consumer-Repeating-UI im Flag-Fenster:** Solange `FEATURE_SUBMISSION_REPEATING_SECTIONS` zu ist, kann ein gefüllter Row-Submit nur einen generischen „submitFailed"-Snackbar zeigen (Backend 400 „nicht aktiv"). E7 muss entweder die Row-UI hinter eine server-getriebene Capability gaten oder die spezifische 400-Meldung durchreichen. (Heute nicht auslösbar, weil der `is_repeating`-Toggle bis E7 versteckt ist — kein Template hat Repeating-Sektionen.)
2. **Save-all-Edit-Pfad löst flache Keys GLOBAL auf (E4-Lücke):** Die save-all-Route prüft Template-Binding, ruft `saveAllCustomFields` aber im strikten Modus mit `getFieldDefinitionByKey` (global, kein Template-Scope). Bei legal duplizierten aktiven `field_key`s über zwei Submission-Templates kann die EAV-Row unter der fremden Definition landen. Fix = template-scoped STRIKT-Modus (kein Lenient) im Edit-Pfad. Selbe Klasse wie F6, aber auf dem Edit- statt Create-Pfad.

**Akzeptiert/pre-existing (kein E6-Fix):** Date-TZ-Round-Trip bei unberührten Datumsfeldern im Edit (`new Date('YYYY-MM-DD')` UTC vs. lokale Re-Serialisierung — geteilte `TageaCustomFieldsComponent`, betrifft Cases gleichermaßen); auto-added leere Rows im Consumer (Backend-Phantom-Guard aus E4 verwirft sie); fehlende Required-Validatoren auf Row-Controls (geteilte Komponente).

**Deploy-Choreografie (zwingend, übernimmt Rollout-Sequenz):**
1. E0 sofort (Live-Bugs).
2. E1.
3. E2′ (Part geschlossen) — auf **beiden** Prod-Backends verifiziert (Version-/Health-Check), wegen lautlosem Part-Drop alter Instanzen (Rollout-F6).
4. E3 unmittelbar nach E2′-QS-Verifikation; vorher Prod-Volumen-Sweep (Rollout-F8). **E2′↔E3 = Deploy-Paar:** E2′-Revert nach gelaufenem E3 erzeugt eine nie-wieder-gebackfillte flat-only-Kohorte → Playbook: nach Re-Deploy Backfill-Funktion pro Tenant re-runnen (Rollout-F5).
5. E4 + E5 parallel; **E5 ist Voraussetzung für die Part-Öffnung** (Rollout-F9: sonst permanent unvollständige Belege).
6. E6 erst wenn E2′/E4/E5 auf beiden Backends live.
7. E7: Flag + 3 FE-Sites; Tenant-Freischaltung abhängig von Alt-App-Strategie (PO #6).

## §8 Risiko-Register

| # | Risiko | Mitigation | Rest-Risiko |
|---|---|---|---|
| R1 | PATCH-Wipe-Bug live (v2-Edit löscht Create-Werte aus Summary) | E2′+E3 zeitnah; bis dahin: bekannt, v2-Edits auf Bestands-Submissions vermeiden | Bereits gewipte Bestände unwiederbringlich (F5); Rest-Quelle Beleg-PDF |
| R2 | `[object Object]` in versandten Belegen nach jedem v2-Edit | PR-E0 zuerst | Bereits versandte fehlerhafte PDFs |
| R3 | IDOR auf Row-Write-Routen (heute live) | PR-E0 (b) | bis Deploy offen |
| R4 | Alt-App verliert Repeating-Daten silent | Fail-loud 400 + Capability-Marker + Server-Flag + PO #6 | Tenant schaltet trotz Alt-App-Nutzern frei → 400-UX statt Datenverlust (akzeptiert) |
| R5 | Backfill-Race bei 2 Instanzen wedgt Tenant | ON CONFLICT (partieller Index!) + Advisory-xact-Lock | minimal |
| R6 | Garbage-Werte werfen in Migration → Tenant-Connect blockiert | defensive Casts, Orphan-Log statt Throw | Orphans fehlen im Live-Cache (geloggt, PO #3) |
| R7 | Rolling-Deploy-Fenster: neues FE → alter Backend droppt Part stumm | Deploy-Reihenfolge + Both-Instances-Check + serverseitiges Marker-Logging | kurzes Fenster sichtbar, nicht verhindert |
| R8 | E2′-Revert nach E3 → flat-only-Kohorte | Backfill als re-runnable Funktion + Revert-Playbook | Playbook muss befolgt werden |
| R9 | Gruppen-Key-Kollision vermischt rows-Arrays still (keine DB-Constraint) | M-E1a-Dedupe + erweiterter Guard (attach+update) | DB erzwingt nicht; Restlücke direkte DB-Manipulation |
| R10 | E1-Revert entfernt Guard → kollidierende Attaches im Revert-Fenster | Backfill-Funktion kollisionsfest re-runnable | gering |
| R11 | history/at-time falsch für Repeating | Ausschluss + Doku (E4); row_id-History als Follow-up | kein Row-Audit bis Follow-up (PO #10) |
| R12 | Migrations-TX-Dauer bei Ausreißer-Tenants (Trigger O(rows²), Sammel-TX im Connect-Pfad) | Volumen-Sweep + Schwellwert→manueller Run (PO #11); Inserts pro Entity bündeln | erster Request des Tenants wartet (Sekundenbereich) |
| R13 | „Eintrag n"-Zuordnung instabil vor M-E1b | M-E1b vor allen Outputs (E5) | Rows aus Dev-/Frühphase shiften einmalig beim Umstellen |
| R14 | Trigger-Ordnungs-Änderung wirkt cross-entity (Clients/Cases-Caches) | DOCX-Snapshot- + Case-E2E-Absicherung; rein ordnungsverbessernd | gering, bewusst akzeptiert |

## §9 OFFENE PO-ENTSCHEIDUNGEN

1. **CSV-Format für Rows** — Optionen: (a) nummerierte Spalten `<groupKey>_<n>_<fieldKey>` + `_count` mit fixer Spaltenzahl (`max_rows` bzw. Cap), (b) aggregierte Textspalte, (c) Zeile-pro-Row, (d) weglassen. **Empfehlung: (a).** Konsequenz: stabile BI-Verträge, breite Files bei großen Caps.
2. **PDF-AcroFill für Rows** — Optionen: (a) Konvention `<groupKey>_<n>_<fieldKey>` mit stillem Cap, (b) Repeating in v1 ausnehmen. **Empfehlung: (a).** Konsequenz: Template-Autoren müssen Konvention kennen; Cap dokumentieren.
3. **Orphan-field_keys beim Backfill** — Optionen: (a) Log-Tabelle + Sentry, aus Cache fallen lassen, (b) hart abbrechen. **Empfehlung: (a)** — Exporte zeigen Orphans heute schon nicht (Reader iterieren über Definitionen); (b) wedgt Tenants. Konsequenz: Orphan-Werte nur noch im Log.
4. **`custom_fields_full` für Submissions** — Optionen: (a) unverändert lassen, (b) deprecaten. **Empfehlung: (a)** (vestigial, harmlos; keine Reader). Konsequenz: Doppel-Pflege bleibt.
5. **Create-Lenienz-Semantik** (neu, aus F4/Rollout-F3) — Optionen: (a) ungültige Felder droppen + Sentry, Rest speichern, (b) speichern mit `validation_state='invalid'` (konsistent mit /tasks-Invalid-Zählern), (c) all-or-nothing 400. **Empfehlung: (b)**, Fallback (a) für unbekannte Keys. Konsequenz: (c) wäre Alt-App-Regression; (b) macht Drift in den Aufgaben-Zählern sichtbar.
6. **Alt-App-Strategie für Toggle-Freischaltung** (neu, aus Rollout-F2c) — Optionen: (a) Tenant-Freischaltung erst nach App-Mindestversion/Forced-Update, (b) Admin-UI-Warnhinweis beim Aktivieren + 400-Schutz reicht, (c) global sofort. **Empfehlung: (b)** (400-Schutz aus E2′ verhindert Datenverlust; Warnung managt UX). Konsequenz: Alt-App-Nutzer sehen Fehlermeldung statt Silent-Loss.
7. **Feldwerte (inkl. Rows) im Mail-Body** — **Empfehlung: nein**, weiterhin nur PDF-Anhang.
8. **`max_rows`-Default für Submission-Gruppen** — **Empfehlung: admin-konfigurierbar, Default unbegrenzt** (wie Cases).
9. **Keylose Repeating-Gruppen anderer Entity-Typen + Trigger-`COALESCE`-Härtung** — **Empfehlung: separates Ticket, nicht Phase E** (Cases-Reader nutzen EAV-direkt bzw. DOCX-Slug-Fallback `client-report-docx.service.ts:317`).
10. **Row-History** (neu, aus F11) — Optionen: (a) Phase E: Repeating aus history/at-time ausschließen + Follow-up-Ticket für `row_id` in `custom_field_values_history`+Trigger, (b) sofort nachrüsten. **Empfehlung: (a).** Konsequenz: kein Row-Audit vorerst; betrifft auch Cases.
11. **Backfill-Auslieferung** — Optionen: (a) auto-Migration ruft re-runnable Funktion, mit Volumen-Schwellwert→manueller Run, (b) komplett manuell pro Tenant. **Empfehlung: (a).** Konsequenz: (b) nur falls PO Orphan-Risiko vorab sichten will.
12. **Receipt-Regeneration für Altfälle** (neu, aus Rollout-F9) — Optionen: (a) Tool bauen, (b) verzichten. **Empfehlung: (b)**, solange das Server-Flag die Part-Öffnung sauber hinter E5 hält (dann gibt es keine Altfälle). Konsequenz: nur relevant bei Flag-Disziplin-Bruch.

## §9a PO-ENTSCHEIDUNGEN — GETROFFEN (2026-06-11)

| # | Entscheid | Abweichung von Empfehlung |
|---|---|---|
| 1 | (a) nummerierte Spalten `<groupKey>_<n>_<fieldKey>` + `_count`, fixe Spaltenzahl | — |
| 2 | (a) AcroField-Konvention mit dokumentiertem Cap | — |
| 3 | (a) Orphans loggen + weiter | **NUR Log-Tabelle, KEIN Sentry** |
| 4 | (a) `custom_fields_full` unverändert | — |
| 5 | **HYBRID** (geschärft): Regelverstoß auf aktivem, bekanntem Feld → **400 mit Feldfehlern**; unbekannter field_key → **verwerfen + Log** (EAV braucht ohnehin eine Definition); kürzlich deaktiviertes Feld → **speichern** (Eingabe nicht verlieren). Implementierungs-Schärfung (E2′): deaktiviertes Feld mit INVALIDEM Wert → **verwerfen + Log** statt 400 — der Nutzer kann ein nicht mehr gerendertes Feld nicht korrigieren, ein 400 wäre eine Sackgasse | ersetzt (b); §4c entsprechend anpassen — kein `validation_state='invalid'`-Pfad im Create, kein Sentry für Drift-Events |
| 6 | (b) 400-Schutz | **OHNE Admin-Warnhinweis** (kein UI-Hinweis, keine i18n-Keys dafür) |
| 7 | Nein — Werte nur als PDF-Anhang | — |
| 8 | `max_rows` admin-konfigurierbar, Default unbegrenzt | — |
| 9 | Separates Ticket (nicht Phase E) | — |
| 10 | (a) Repeating aus history/at-time ausschließen + Follow-up-Ticket row_id-History | — |
| 11 | (a) Auto-Migration mit re-runnable Funktion + Volumen-Schwellwert | — |
| 12 | (b) kein Receipt-Regenerations-Tool | — |

Konsistenz-Folge aus #3/#5: Drift-Events (Orphan-Keys, gedropte Werte) gehen in App-Log/Log-Tabelle, NICHT nach Sentry; der Capability-Marker (Rollout-F2b) wird ebenfalls als Log-Zähler statt Sentry-Warning geführt.

## §10 Aufwands-Hausnummer je PR

| PR | Größe | Treiber |
|---|---|---|
| E0 | **M** | 3 Reader-Formatter + 5 Routen-Guards + E2E |
| E1 | **M** | 2 Migrationen (M:N-Kollisionslogik!), Guard attach+update, Cross-Entity-Snapshots |
| E2′ | **L** | Service-Refactor (Manager-Param, TX-Reihenfolge, Pool-Fallen), Lenient-Semantik, Template-Resolution, Server-Flag, breite E2E |
| E3 | **L** | SQL-Funktion mit defensiven Casts/Orphan-Log/ON CONFLICT/Lock, Property-Tests, Prod-Sweep |
| E4 | **M** | Route-Spiegel + Guards + max_rows + history-Ausschluss |
| E5 | **L** | 3 Output-Kanäle, deterministische Spaltenlogik, Snapshots |
| E6 | **M** | Wiring nach Case-Muster, Detail-read-only, Playwright |
| E7 | **S–M** | Flag + 3 Sites + E2E-Welle (Welle ist der M-Anteil) |

**Einarbeitung der Critique-Findings — Vollständigkeitsnachweis:** Daten/Trigger F1–F18 sämtlich übernommen (F11 in der Ausschluss-Variante, row_id-History deferred mit Begründung §4h/PO #10; F9 in der Trigger-Variante mit begründeter Risiko-Akzeptanz §3/M-E1b). Rollout/Kompat 1–14 sämtlich übernommen (12 als fixe Spaltenzahl präzisiert; 13 als Verifikationsschritt in E7). **Explizit verworfen:** Architekten-Formulierungen „selbe TX ohne Refactor", „Reader unverändert", „Summary im Zielformat", „fail-loud bei Wert-Garbage", „E7 = 1-Zeilen-Revert", „E3 entschärft rückwirkend" — jeweils mit Korrektur an der zitierten Stelle; Trigger-`COALESCE`-Fallback für Phase E verworfen (§3/M-E1b, PO #9); Mail-Body-Werte verworfen (PO #7); `selected_at`-Rekonstruktion im Backfill verworfen (§3/M-E3, Datenerfindung); Receipt-Regeneration-Tool zurückgestellt (PO #12).