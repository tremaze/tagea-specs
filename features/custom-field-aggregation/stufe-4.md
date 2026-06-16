# Custom Field Aggregation — Stufe 4 (Aggregate as a first-class value)

> **Status:** ✅ Implemented & verified 2026-06-16 (UNCOMMITTED) — S4a predicate migration + trigger-order fix; S4b R6 fix + synthetic report field; S4c detail_export seam (verification-only); FE authoring on submission categories (appointment templates N/A — see §5). Load-bearing forks **confirmed 2026-06-16**: G5 column-only-by-default, G4 R6-folded-into-S4b, S4-before-S3.
> **Owner:** baumgart
> Builds on Stufe 1 ([spec.md](./spec.md), ✅) and Stufe 2 ([stufe-2.md](./stufe-2.md), ✅). Recon ground truth: workflow `positionsliste-code-recon` (2026-06-16), all load-bearing claims `verified:high`. Re-verified against the as-built S2b trigger (`20260616130000`).

## Scope

Make the materialized section aggregate (`<group_key>__<source_field_key>__sum`, a top-level scalar in `custom_fields_summary`) usable as a **first-class value** by the three subsystems that today cannot see it, **plus** fix the latent query-builder silent-zero (R6).

Four parts, planned together, sequenced inside this spec:

- **S4a — Predicate-readable aggregate (visibility trigger).** A custom field can be shown/hidden by a condition on a section's running total — "show *Begründung* if *Summe der Belege* > 1.000". The SQL visibility predicates read raw `custom_field_values`, so the JSONB scalar is invisible to them today. This is the only genuinely new DB work. **It is also the entire `invalid_fields`/statistics story** (see S4c).
- **S4b — Report builder offers the aggregate (+ R6 fix).** The query-builder/`detail_export` engine already *can* read the top-level scalar (`SUM((summary->>'key')::NUMERIC)`, plain `summary->>'key'` column) — it just isn't *offered* by the field registry, and the registry currently offers the wrong things (repeating-member fields that silently read NULL → 0, R6). Fix the registry: suppress repeating members, expose the group aggregate.
- **S4c — `detail_export` seam (no double-sum).** Köln/Gronau Leistungsnachweise total via **Excel formulas inside the template `.xlsx`** (`=SUM(col)`), not in TS. The per-entity aggregate is already in `custom_fields_summary`; selecting it as a column lets the existing footer formula total it. Inventory each template before injecting so we never write into a formula-covered cell.
- **R6 — latent silent-zero bug.** Folded into S4b (it is the same registry change). May ship independently.

Out of scope (later / separate): normalization + per-category subtotals (S3 — still pending, ordered before or after S4 at the user's discretion); Stack-B/C admin authoring of aggregation (shared follow-up with conditional-visibility); an open formula language (parked).

## §0 Decisions — confirm or correct

| # | Question | Decision (★ recommended) | Consequence |
|---|----------|--------------------------|-------------|
| **G1** | How does the aggregate become **predicate-readable** (R5 — the biggest fork)? | ★ **New `trigger_source = 'group_aggregate'`** resolved by SQL, **not** a synthetic `custom_field_values` row. A small `STABLE` helper `resolve_group_aggregate_value(grp_key, source_field_key, entity_type, entity_id)` dispatches the 11 host tables and reads `custom_fields_summary->>'<grp>__<col>__sum'`. The three visibility functions call it on the existing `trigger_source != 'custom_field'` branch (exactly how `resolve_entity_trigger_value` is already wired in `20260423100000`). | No `chk_single_value` conflict; no forged value; **one** source of truth (the trigger output). The aggregate stays display-derived everywhere; the predicate just *reads* it. |
| **G2** | Numeric comparison correctness (R16 — trailing-zeros trap) | ★ **Numeric-only operators for `group_aggregate`.** The aggregate is `NUMERIC(20,6)` serialized as e.g. `1200.000000`; TEXT `equals`/`in` would mismatch `1200`. Allow only `greater_than[_or_equal]`, `less_than[_or_equal]`, `is_empty`/`is_not_empty`, and a **numeric-cast** `equals`/`not_equals`. The existing evaluation block already `::numeric`-casts the `>`/`<` family (`20260423100000:68-79`); extend the equals/in branch to cast when the source is `group_aggregate`. | No false hide/show from text mismatch. Authoring UI offers only the numeric operators for an aggregate trigger. |
| **G3** | Trigger-order / convergence (the R5 chain: row → sum → visibility → count) | ★ **Reorder the validity trigger to fire after the cache trigger** (corrected during implementation — see below). Both are `AFTER … ROW ON custom_field_values`; Postgres fires them in **alphabetical name order**, and the validity trigger `trg_custom_field_value_changed` (→ `update_{case,appointment,client}_validity` → `count_invalid_*` → the predicates) sorted *before* the cache trigger `trg_update_custom_fields_cache`. Pre-S4 that was harmless (predicates read raw `cfv` rows, order-independent); once a predicate reads the materialized summary, the recount would observe the **stale** aggregate. Fix: rename the validity trigger → `trg_validate_custom_field_value` (sorts after `trg_update…`). The aggregate-driven predicate is never called *from* the cache trigger, so there is no feedback cycle. | Migration also **re-backfills** `count_invalid_*` once (like `20260423100000:428-445`). The rename is safe for the existing raw-row predicates (the cache trigger never writes `custom_field_values`). **Future migrations:** the validity trigger is now `trg_validate_custom_field_value`; the function `trigger_custom_field_value_changed()` keeps its name. |
| **G4** | R6 fix shape — what does the report registry offer? | ★ **Suppress repeating-member fields; expose one synthetic aggregate field per configured section.** In `getCustomFields` (`field-registry.service.ts:270-318`), a field whose group `is_repeating = true` is dropped from the offered list (its value is nested in `summary->'<grp>'->'rows'`, never a flat `summary->>'member_key'` → today silently 0). For each group carrying `aggregation_config`, add a synthetic field `custom_fields.<grp>__<col>__sum` (number, label from group + column) — the real, readable first-class value. | Kills the silent-zero footgun **and** delivers the report value in one change. Saved report configs that referenced a member key keep reading NULL→0 (no worse than today); document the BI-contract note. |
| **G5** | Is the aggregate **engine-aggregatable** (SUM across entities) or **column-only**? (R3 double-sum) | ★ **Selectable + groupable + filterable; engine-aggregatable = opt-in, off by default.** The synthetic field's per-entity value is the section total; selecting it as a `detail_export` column lets the template's `=SUM(col)` footer total it — no double count. A cross-entity engine SUM (`SUM(SUM_per_entity)`) is *valid* but only when the chosen template has **no** `=SUM` footer on that cell. Default `aggregatable: false` (mirrors collection fields' "use collection aggregations instead"); turning it on is a deliberate report-author choice. | Prevents the R3 double-sum by default. Requires a per-template `.xlsx` footer inventory before mapping the aggregate into any formula-covered column. |
| **G6** | Does the aggregate itself get an `invalid_fields` / required gate? | ★ **No.** A derived value can't be "unfilled" (consistent with S2b E1: computed/derived fields are skipped in strip/required/missing-count). S4's statistics/`invalid_fields` integration is **entirely** the visibility-trigger chain (G1): an aggregate-driven `visibility_condition` on a *normal* field flips that field's required/statistic-relevant counting through the **existing** predicate→counter wiring. No counter-function body change beyond G1 + the re-backfill. | The counters (`count_invalid_*`) already call `is_visibility_condition_met`; once the predicate resolves `group_aggregate`, statistics "just work". No new statistic primitive. |

**Confirmed 2026-06-16:** G4 (R6 folded into S4b — one registry commit), G5 (column-only by default; cross-entity engine SUM opt-in only on a footer-formula-free template), and the **S4-before-S3** sequencing. G1/G2/G3/G6 are architecture-determined recommendations (no genuine fork) and stand unless corrected during implementation.

**Core consequence:** G1 is the keystone — it is simultaneously the *visibility trigger* (S4a) and the *statistics/`invalid_fields`* story (S4c via G6), because the counters are built on the predicates. G4 (R6 fix) is what makes the already-readable scalar *reachable* in the report builder (S4b). G3 + G5 are the two "don't create a second source of truth / don't double-count" guards.

## §1 Implementation order (justified)

Dependency-and-risk order, smallest trustworthy DB change first:

1. **S4a — predicate resolver + `group_aggregate` trigger source** (G1, G2, G3). *Foundation.* New migration: `resolve_group_aggregate_value(...)` STABLE helper + the `trigger_source != 'custom_field'` branch in all three visibility functions routes to it when `trigger_source = 'group_aggregate'`; re-backfill the `invalid_fields` counters. This single migration unlocks **both** the visibility trigger **and** the statistics/`invalid_fields` chain (G6). No FE yet — testable purely in SQL against the baseline harness.
2. **R6 fix + synthetic aggregate report field** (G4). *Independent, ship-anytime.* Pure `field-registry.service.ts` change (suppress repeating members, emit `custom_fields.<grp>__<col>__sum`). No migration. The query-builder filter/group-by/select/SUM paths already handle a top-level scalar key (`query-builder.service.ts:484-565, 793-795, 842-844, 1273-1279`), so once the field is offered, filter + group-by + (opt-in) cross-entity SUM work with no engine change.
3. **S4c — `detail_export` seam verification** (G5). *Consumes step 2.* Inventory each Leistungsnachweis template `.xlsx` footer (`reports/providers/template-excel-export.provider.ts`); confirm the per-entity aggregate column maps to a non-formula cell or to the column the `=SUM` footer already totals. No new summing.
4. **S4a authoring (FE)** (G1, G2). *User-facing surface, last.* Add `'group_aggregate'` to the `VisibilityTriggerSource` union (BE `custom-fields.types.ts:195` + FE `models/custom-fields.model.ts:94`) and surface it in the Stack-A visibility editor as a trigger option (group + numeric-column picker + numeric operators only, G2). DTO is additive; the predicate already exists from step 1.

Each step strictly builds on the prior; step 1 is independently valuable (statistics) even if FE authoring (step 4) slips.

## §2 S4a — predicate-readable aggregate (foundation)

### The problem (R5, re-verified)
The three visibility functions in `20260423100000-AddEntityFieldVisibilityTrigger.ts` resolve the trigger's *actual value* from **raw `custom_field_values`** (`is_group_visibility_condition_met:224-230`, `is_visibility_condition_met:312-318`, `is_visibility_condition_met_in_row:403-419`), keyed by a `field_definition_id` and `row_id IS NULL`. The aggregate has **no definition row and no value row** — it lives only in the host table's `custom_fields_summary` JSONB scalar. So no visibility predicate, and therefore no `count_invalid_*` / `list_invalid_*` counter that calls them (`20260609120000`), can see it today.

### The resolver (mirrors `resolve_entity_trigger_value`)
A new `STABLE` PL/pgSQL helper that dispatches the host table by `entity_type` and reads the scalar:

```sql
CREATE OR REPLACE FUNCTION resolve_group_aggregate_value(
    p_group_key TEXT, p_source_field_key TEXT, p_entity_type TEXT, p_entity_id UUID
) RETURNS TEXT AS $$
DECLARE v_summary JSONB; v_key TEXT;
BEGIN
    v_key := p_group_key || '__' || p_source_field_key || '__sum';
    CASE p_entity_type
        WHEN 'client' THEN SELECT custom_fields_summary INTO v_summary FROM clients WHERE id = p_entity_id;
        WHEN 'case'   THEN SELECT custom_fields_summary INTO v_summary FROM cases   WHERE id = p_entity_id;
        -- … the same 11-entity dispatch the cache trigger uses (20260616130000:37-64) …
        ELSE RETURN '';
    END CASE;
    RETURN COALESCE(v_summary->>v_key, '');  -- '' → empty-trigger fallback hides the field (safe default)
END; $$ LANGUAGE plpgsql STABLE;
```

- Returns TEXT (the predicate's `v_actual_value` is TEXT); the **evaluation block compares numerically** (G2). The `>`/`<` family already casts `::numeric` with a regex guard (`20260423100000:68-79`); for `group_aggregate`, route `equals`/`not_equals` through the same numeric cast instead of TEXT equality.
- **Condition shape:** `{ trigger_source: 'group_aggregate', trigger_field_group_key: '<grp>', trigger_field_key: '<source_col>', operator: 'greater_than', value: '1000' }`. (Reuse `trigger_field_key` for the source column; add `trigger_field_group_key` so the resolver can build the scalar key without a `group_id` lookup. Alternatively pass the full scalar key as `trigger_field_key` — decide in authoring, §5.)

### Wiring into the three functions
Each function already has the branch `IF v_trigger_source != 'custom_field' THEN v_actual_value := resolve_entity_trigger_value(...)`. Extend it to switch on the source: `client`/`case`/`institution` → `resolve_entity_trigger_value`; `group_aggregate` → `resolve_group_aggregate_value`. The shared `evaluationBlock` then runs unchanged (with the G2 numeric-equals tweak).

### Trigger-order / convergence (G3, R5 chain)
- **Cycle safety:** the cache trigger writes the aggregate but never calls the visibility predicates; the predicates read the aggregate but never write values. So row-change → aggregate recompute → predicate read is a one-way DAG, not a loop. An aggregate-driven `visibility_condition` cannot alter the aggregate it reads (the hidden/shown field is a *different* field; if a hidden field's value is stripped and that field happens to be the summed column, the next write re-materializes — still converges, document this corner).
- **Ordering:** `value write (cache trigger fires per row) → service-layer validity/strip recompute reads post-write summary`. This is already the order in the write lifecycle (`custom-fields-value-v2.service.ts`). The migration's one-time re-backfill (`UPDATE … SET invalid_fields = count_invalid_*`) brings existing entities current against the new resolver.

## §3 S4b — report builder offers the aggregate (+ R6 fix)

### R6 — the latent silent-zero (re-verified)
`getCustomFields` (`field-registry.service.ts:270-318`) offers **every** active definition as `custom_fields.<field_key>` with `aggregatable = isAggregatable(field_type)` (line 294). A repeating-member number field is thus offered, but the query-builder reads `summary->>'<member_key>'` (`query-builder.service.ts:795/844/1276`) which is **NULL** for a member (its value is nested in `summary->'<grp>'->'rows'`) → `SUM(NULL)` → silently **0**. ~7 `->>` call sites all share this assumption.

### The fix (G4)
In `getCustomFields`, load the group relation (`CustomFieldDefinition.group` / `group_id`, entity lines 157-166) and:
1. **Suppress repeating members** — `if (def.group?.is_repeating) continue;` (and skip computed fields too, S2b E1 — they have no value row). They are not flat-column reportable.
2. **Emit the synthetic aggregate field** for each group with `aggregation_config`:
   ```ts
   { path: `custom_fields.${grp.key}__${cfg.source_field_key}__sum`,
     label: `${grp.name} — Summe`, type: 'number', is_custom: true,
     filterable: true, groupable: false, aggregatable: false /* G5: opt-in */ }
   ```
   The path's `field_key` segment is the reserved-namespace scalar key, so the existing select/filter/group-by/SUM builders resolve it with **zero engine change** (D-A's forward-compatibility paying off).

### Why no query-builder change
- **Filter** (`query-builder.service.ts:484-565`): numeric operators already cast `(summary->>'key')::NUMERIC` (lines 520-553) → aggregate filters (`Summe > 1000`) work. (Note line 489 `=` is TEXT — for an aggregate, prefer the numeric `>=`/`<=` BETWEEN; document, mirror G2.)
- **Select** (`:793-795`) / **group-by** (`:842-844`): emit `summary->>'key'` — the per-entity total as a column (detail_export's seam, §4).
- **Aggregation** (`:1268-1286`): `SUM((summary->>'key')::NUMERIC)` — cross-entity total, valid when opted in (G5).

## §4 S4c — `detail_export` seam (no double-sum)

### The constraint (R3, re-verified)
`detail-export.service.ts` selects `custom_fields_summary` wholesale (`:65/74/108`) and the engine sums **nothing in TS** — footer totals are `=SUM(col)` formulas baked into the template `.xlsx`, reference-shifted by `template-excel-export.provider.ts` (`shiftFormulaReferences`). Writing an aggregate value into a cell already covered by `=SUM(col)` double-counts.

### The plan (G5)
- The per-entity aggregate is **already present** in the selected `custom_fields_summary` (no service change). Mapping `custom_fields.<grp>__<col>__sum` to a detail column emits the section total per row.
- **Footer inventory (required, manual):** template formulas are binary/not greppable. Before mapping the aggregate into any column, open each Leistungsnachweis template and confirm: either the aggregate column has no footer formula, or it maps to exactly the column the existing `=SUM` totals (so the formula sums per-entity totals — correct), never a value injected into a SUM-covered cell. `log()`/document each template's disposition.
- **Cross-entity SUM stays opt-in** (G5): never auto-enable engine SUM on a template that already has a footer formula.

### Verified 2026-06-16 — no code change needed
- **The aggregate is reachable in detail_export with zero code change.** Static (case-level) mappings resolve `source: 'custom_field'` by reading the loaded `case_custom_fields` blob by `custom_field_key` (`detail-export.service.ts:257-262`); dynamic (appointment-level) columns do the same against `appointment_custom_fields` (`detail-export-columns.ts:200-205`). `extractCustomFieldKey` returns a non-object scalar as-is (`detail-export-columns.ts:96-103`), so the numeric aggregate renders correctly. A Leistungsnachweis maps the section total via `{ source: 'custom_field', custom_field_key: '<grp>__<col>__sum' }`.
- **No live double-sum today.** No existing detail_export config references an aggregate (`__sum`) key — configs live in per-customer seed SQL (`seed-detail-export-{koeln,ac-stadt,morgensonne}.sql`); so there is no template cell currently both injected with an aggregate and covered by `=SUM`. The double-sum guard (G5) becomes relevant only when a future per-customer config maps the aggregate.
- **Template inventory** (footer check applies when mapping the aggregate): `templates/{leistungsnachweis-flex-koeln, lwl-mantelbogen, lt-d-beenderstatistik, erg-statistikbogen, fachdatenerhebung-nrw}.xlsx`.
- **Display formatting** is a template-cell concern: detail_export renders the raw numeric value (no `number_format`/`applyPrecision` in the engine), so currency display (`1.300,00 €`) is set on the target `.xlsx` cell, not in code.

## §5 Authoring (FE, Stack A) — visibility trigger on an aggregate

- **Type union:** add `'group_aggregate'` to `VisibilityTriggerSource` (BE `custom-fields.types.ts:195`, FE `models/custom-fields.model.ts:94`). Additive; the validated nested visibility DTO already tolerates the extra fields (it accepts the `trigger_source` enum).
- **Editor:** in the Stack-A visibility editor (same surface as conditional-visibility F1), when the author picks "Summe einer Positionsliste" as the trigger, offer (a) a picker of repeating groups *that carry `aggregation_config`* in the current stack, and (b) **numeric operators only** (G2). The picked group + its `source_field_key` populate `trigger_field_group_key` + `trigger_field_key`.
- **Scope (as built 2026-06-16):** Submission categories AND **appointment templates** — both condition surfaces (field-level `admin-field-editor` and group-level `admin-group-editor`/`template-group-edit-dialog`). Appointment support required a follow-on (see below) to make appointment templates author repeating + sum sections in the first place; once that landed, the same `aggregatableGroups` wiring applies. Stacks B/C (clients/cases via `generic-group-form`/`client-group-form`) deferred.
- **Appointment Positionsliste enablement (follow-on, 2026-06-16):** appointment templates previously treated groups as flat. Made fit for repeating + sums: (1) BE — generalized `ensureSubmissionRepeatingKey`→`ensureRepeatingGroupKey` (drops the submission-only gate; ANY repeating group gets a key — the cache trigger requires it; latent fix for cases too) with institution-global + target-template key dedup against the `(key, institution_id)` unique index and the summary-clobber siblings (R9); widened the generic `admin-template-groups.controller` Create/Update section DTOs with is_repeating/max_rows/row_label_template/aggregation_config/visibility_condition (gated on is_repeating). (2) FE — extended `TemplateGroup`/payloads (incl. `key`), `toGroupModel` reads the real fields (was hardcoded false/null), create/update forward them; shared `admin-group-editor` sum-column picker now sources from the section's own fields (`group().fields`) instead of `triggerableFields` — fixes a latent quirk for submission too. Verified: BE tsc + 174 BE tests; appointment functional SQL test (repeating section → auto-key → aggregate `325.50` materialized + resolver reads it); FE build + 839 tests + i18n.
- **Self-reference guard:** a section's *own* group-level visibility condition must not trigger on its own sum (circular); `aggregatableGroupsFor(card, excludeGroupId)` drops it for the group editor. Field-level self-reference (a field shown by its own section's total) stays valid.
- **Four contract mirrors** must carry the new union member + `trigger_field_group_key`: BE type, BE DTO, FE `models/custom-fields.model.ts`, **and FE `admin/models/custom-fields.model.ts`** — the shared editor imports the *admin* mirror (the easy-to-miss one; it had no `trigger_source` at all before).
- **Key-shape decision (open, pick in authoring):** carry `{ trigger_field_group_key, trigger_field_key }` (resolver concatenates) **vs.** carry the full `<grp>__<col>__sum` scalar key in `trigger_field_key`. ★ Recommend the two-field shape — it mirrors the cross-group custom-field trigger (`trigger_field_group_id` + `trigger_field_key`) and keeps the reserved-namespace concatenation server-side (single place to change if the key format ever moves).

## §6 Risk register (S4-specific)

| # | Risk | Mitigation |
|---|------|------------|
| R-S4-1 | Aggregate invisible to SQL predicates/counters (R5) — the whole point | G1 resolver reads `summary->>'key'` with 11-entity dispatch; counters inherit it via the predicates (G6). |
| R-S4-2 | Trailing-zeros TEXT mismatch (R16): `1200.000000` ≠ `1200` | G2 numeric-only operators; the aggregate branch parses both sides with a nested `BEGIN/EXCEPTION` `::numeric` cast (incl. equals) — **not** a regex guard. *(Discovered while testing: the shared `evaluationBlock` regex `'^-?[0-9]+\\.?[0-9]*$'` is escaping-broken — the `\\\\` in TS source stores a double backslash that matches no number, so the existing `custom_field`/entity **numeric** visibility operators silently fail the guard → hide. Pre-existing, out of S4 scope; the aggregate path sidesteps it with the exception-parse. Flagged to the user / handoff.)* |
| R-S4-3 | Trigger-order staleness (R5 chain) — validity recount reads the aggregate before the cache trigger writes it | **Fixed & verified:** rename the validity trigger to fire after the cache trigger (`trg_validate_custom_field_value` > `trg_update_custom_fields_cache`). Runtime test: a single `betrag=1500` write makes `cases.invalid_fields` reflect the aggregate-gated required field immediately (broken order → 0). No feedback loop (cache trigger never calls predicates). |
| R-S4-4 | Report silent-zero (R6) persists / saved configs reference member keys | G4 suppresses members + emits the synthetic aggregate; saved configs read NULL→0 unchanged (no regression); BI-contract note. |
| R-S4-5 | `detail_export` double-sum into a formula-covered cell (R3) | G5 default `aggregatable:false`; per-template footer inventory before mapping; never inject into a `=SUM` cell. |
| R-S4-6 | Resolver dispatch drifts from the 11-entity list the cache trigger uses | Generate the `CASE` from the same entity list as `20260616130000:37-64`; cover ≥2 hosts in the SQL test (client + submission). |
| R-S4-7 | Performance: `STABLE` resolver called per definition × per entity during a counter re-backfill | One scalar read per call (indexed by PK); counters already iterate definitions. Backfill is one-time/admin-rare (mirrors `20260423100000`). |
| R-S4-8 | Aggregate key absent (group keyless / no `aggregation_config` / pre-S2 entity / zero rows) → resolver returns `''` | The aggregate branch coalesces `''` → `0` (D-B: zero contributing rows = real 0), so `Summe < X` correctly shows on an empty section and `Summe > X` hides it. R14 re-materialization (S2) backfills the scalar on config change. *(Refined from the initial "absent → hide" — `0` is the D-B-consistent value, and an aggregate trigger is only authored against an aggregation-carrying group.)* |

## §7 Test strategy

- **S4a (SQL, extend the baseline harness):** insert a client + a repeating group with `aggregation_config`, populate rows so `summary->>'<grp>__<col>__sum'` materializes; add a sibling field with `visibility_condition { trigger_source:'group_aggregate', operator:'greater_than', value:'1000' }`; assert `is_visibility_condition_met` flips at the threshold (NUMERIC, no trailing-zero mismatch — the R-S4-2 oracle). Repeat on a **second host** (submission) for R-S4-6. Assert `count_invalid_*` recounts when the threshold gates a required field (G6 chain).
- **R6 / S4b (unit):** `field-registry.getCustomFields` — a repeating-member number field is **absent** from the offered list; a group with `aggregation_config` yields exactly one `custom_fields.<grp>__<col>__sum` field with `aggregatable:false`. Query-builder builds `summary->>'key'` select + numeric filter for it (no engine change asserted).
- **S4c (integration / manual):** for each Leistungsnachweis template, a detail_export with the aggregate column produces the per-entity total in the column **and** the existing `=SUM` footer equals the column sum (no double count). Document each template's footer disposition.
- **Money:** the threshold/total stay NUMERIC end-to-end (no `parseFloat`/`applyPrecision` in the predicate or the select); a 2-dp currency aggregate compares exact at the boundary.

## §8 Contracts (additive)

- **`VisibilityCondition.trigger_source`** gains `'group_aggregate'` (BE + FE union). New optional `trigger_field_group_key?: string` (the repeating group's `key`); `trigger_field_key` carries the summed `source_field_key`. Validated; no `as any`.
- **SQL function (new):** `resolve_group_aggregate_value(grp_key TEXT, source_field_key TEXT, entity_type TEXT, entity_id UUID) RETURNS TEXT` (`STABLE`). The three `is_*_visibility_condition_met[_in_row]` functions route to it on `trigger_source='group_aggregate'`.
- **Report field (new, registry-emitted):** `custom_fields.<group_key>__<source_field_key>__sum` — `type:'number'`, `filterable:true`, `groupable:false`, `aggregatable:false` (opt-in). Repeating-member field paths are **removed** from the offered set (BI-contract note: previously offered, always read NULL→0).
- **No new endpoints.** Group/section write DTOs already carry `aggregation_config`; the visibility condition rides the existing field/group `visibility_condition` write path. The report field set is server-derived (no client contract change beyond the new field appearing in the catalog).

> **Spec-status:** plan/design for Stufe 4, sequenced (predicate resolver → registry/R6 → detail_export seam → FE authoring). Grounded in the `positionsliste-code-recon` dossier + the as-built S2b trigger (`20260616130000`) + the visibility functions (`20260423100000`) + the report engine (`field-registry`/`query-builder`/`detail-export`). No code yet — §0 decisions await confirm-or-correct.
