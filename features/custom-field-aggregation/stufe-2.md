# Custom Field Aggregation — Stufe 2 (Exports + parametric computed columns)

> **Status:** ✅ Stufe 2 implemented & verified 2026-06-16 — R14 (re-materialization) + S2a (exports in CSV/PDF/receipt) + S2b (computed columns: data, render, aggregate-over-computed, admin authoring) all complete
> **Owner:** baumgart
> **Last updated:** 2026-06-16
> Builds on Stufe 1 ([spec.md](./spec.md), ✅ implemented). Recon ground truth: workflow `positionsliste-code-recon` (2026-06-16), all load-bearing claims `verified:high`.

## Scope

Two halves, planned together, sequenced inside this spec:

- **S2a — Aggregate in exports.** The Stufe-1 section total flows into the three repeating-section export channels (CSV, PDF AcroForm, receipt). This is the **first consumer** of the server-materialized aggregate — so it carries a hard prerequisite (**R14, re-materialization on config change**) that Stufe 1 could defer because its display computes from rows.
- **S2b — Parametric computed columns.** A repeating row can carry a **derived** numeric column from a **closed parametric set** — `product` (e.g. Menge × Einzelpreis) and `percent` (e.g. Netto → Brutto). Derived, never an open formula language. A computed column can itself be the summed column, coupling it to the Stufe-1 aggregate.

Out of scope (later stages): normalization / per-category subtotals (S3); aggregate as a first-class queryable/statistic/visibility-trigger value and `detail_export` report consumption (S4).

## §0 Decisions — confirm or correct

| # | Question | Decision (★ recommended) | Consequence |
|---|----------|--------------------------|-------------|
| **E1** | Are computed columns **stored** or **derived**? | ★ **Derived, never stored.** A computed column is a real `custom_field_definition` (field_type `number`) carrying `ui_config.computed`; it has **no** `custom_field_values` row. It is derived **once in the cache trigger** into the summary `row_data`, and **client-side** in the renderer for live read-only display. Same single-source pattern as the Stufe-1 aggregate. | No `chk_single_value` conflict; no forged-value risk; strip/visibility/missing-count must **skip** computed fields (no value to require). |
| **E2** | Aggregate **over** a computed column? | ★ **Yes, supported.** When `aggregation_config.source_field_key` names a computed column, the trigger SUMs the **derived expression** (not `value_number`, which doesn't exist for it). The aggregate logic branches on whether the source is computed. | Couples S2b ↔ the Stufe-1 aggregate in the trigger; specified in §3. |
| **E3** | Make the **materialized** aggregate trustworthy for pre-existing entities (R14)? | ★ **Yes — re-materialize on config change.** When an admin sets/changes `aggregation_config` (or a computed config) on a group, the group-write service re-fires the cache trigger for every entity that uses that group (touch-pass scoped to the group's field definitions). | Required by S2a: an export of an entity whose config was set *after* its data was written would otherwise be empty/stale. Stufe 1 didn't need this (it computed from rows). |
| **E4** | Do export channels **read** the materialized aggregate or **re-sum** the rows? | ★ **Read the materialized value** (one source of truth). Channels do **not** re-sum. | Makes E3 load-bearing; keeps FE / export / (future) report consistent. |
| **E5** | Formula expressiveness | ★ **Closed parametric set only** (`product`, `percent`). No open formula language (parked, per Stufe-1 conceptual decision). | Each kind is deterministically mirrored in SQL (trigger) and TS (renderer) — no parser, no precedence/rounding drift. |
| **E6** | CSV column shape | ★ **One total column per group**, named `<groupKey>_total_<sourceFieldKey>`, appended **after** the `<groupKey>_count` column — never interleaved into the `<groupKey>_<n>_<fieldKey>` block. Computed columns ride the existing per-row `defs` block (they widen it by `cap` columns, like any field). | Versioned, deliberate BI-contract change (R8). |

**Core consequence:** E1+E2 put both computed columns and the aggregate-over-computed into the **same** trigger pass (single source); E3+E4 make the materialized value the authoritative figure that exports (and later reports) read; E5 keeps the SQL/TS mirror tractable.

## §1 Implementation order (justified)

Dependency-and-risk order, smallest trustworthy foundation first:

1. ✅ **R14 — re-materialization on config change** (E3). *Foundation.* **Implemented** in `CustomFieldGroupsService.update` (`rematerializeEntitiesForGroup`, scoped touch-pass, DISTINCT ON per entity). **Verified** functionally against the baseline: aggregate key absent before config → still absent after config-change alone (proves the trigger gap) → `1500.000000` after the touch-pass (materializes for a pre-existing entity without a value re-save).
2. ✅ **S2a — exports** (E4, E6). *First consumer.* **Implemented** in all three channels via shared `repeating-export.util` (`totalExportName`, `getRepeatingAggregate` — reads the materialized value, never re-sums): CSV total column after `_count`, PDF AcroField `<grp>_total_<col>`, receipt "Summe:" line. **Verified:** backend `tsc`; 17 existing export tests green (no regression) + 4 new util tests.
3. 🚧 **S2b — computed columns** (E1, E5) + aggregate-over-computed (E2). *Data + render ✅ done & verified; admin authoring UI pending.*
   - ✅ **Data core** (migration `20260616130000`): `compute_row_value(config, row_data)` IMMUTABLE helper (product/percent); trigger folds computed keys into each `row_data`; aggregate reshaped to sum `(row_data->>source)::numeric` per group — **uniformly handles stored AND computed source columns** (supersedes the S1 separate query). **Functionally verified** against the baseline: product `[39.98, 20.00, null]`, percent `[119.00, 238.00, null]`, aggregate-over-computed = `59.98` (NUMERIC-exact, missing factor → NULL → skipped).
   - ✅ **FE render + save-skip**: `tagea-repeating-group` renders computed columns read-only & live (`computedDisplay` via `evaluateComputedValue`, mirrors the SQL); computed fields skipped wherever values/controls are built (no control, never persisted, not counted). FE build + unit tests green.
   - ✅ **Admin authoring UI**: a "Berechnung" section in the Stack-A field editor (kind Produkt/Prozent + factor multi-select / base+rate of sibling numeric fields), writing `ui_config.computed` via the existing `buildUiConfig` passthrough (no BE change). i18n 9 keys × 16 locales. FE build + 836 FE tests green.

Each step strictly builds on the prior; no step invalidates an earlier one.

## §2 R14 — re-materialization (foundation)

The cache trigger fires only on `custom_field_values` DML, never on `custom_field_groups`. So changing a group's `aggregation_config` / computed config does not re-materialize existing entities.

- **Where:** the group-write path that already persists the config — `CustomFieldGroupsService.update` (generic) and the submission-templates `updateSection`/`createAndAttachGroup`. After the config delta is saved, if `aggregation_config` (or any computed-column config) changed, run a scoped touch-pass.
- **Touch-pass:** `UPDATE custom_field_values SET updated_at = updated_at WHERE field_definition_id IN (SELECT id FROM custom_field_definitions WHERE group_id = :groupId)` — one re-fire per affected entity (the trigger rebuilds that entity's whole summary). Mirrors the existing migration touch-pass (`20260611160100:188-197`) but scoped to one group's entities.
- **Cost (R13/R14):** the trigger is `FOR EACH ROW`; a touch over a large group re-aggregates per row. Acceptable for an admin config change (rare); if a group spans many entities, consider a `DISTINCT ON (entity_id)` single-row touch per entity (as the migration does) to bound it.
- **Test:** populate an entity, set `aggregation_config` afterwards, assert the summary aggregate key materializes without re-saving the entity's values.

## §3 S2b — computed columns + aggregate-over-computed

### Config (E1, E5)
A computed column is a `number` field definition with `ui_config.computed`:

```ts
type ComputedConfig =
  | { kind: 'product'; factors: string[] }          // value = ∏ factor field values
  | { kind: 'percent'; base: string; rate_percent: number }; // value = base × (1 + rate/100)
```

- Stored on `ui_config` (additive; `buildUiConfig` already preserves unknown keys). Reserved: a computed field's `field_key` lives in the same namespace as siblings — it must **not** collide; the trigger writes its derived value under that key (R9 — computed keys overwrite real keys via `||` if equal; guard by construction in the admin: a computed field's key is unique like any field).
- Authored in the **field** editor (Stack A `admin-field-editor`), only for `field_type: number`, with a picker of sibling numeric fields of the same section (the editor already enumerates siblings for visibility triggers).

### Derivation — trigger (single source)
The per-row CTE (`20260611160100:122-138`) groups by `row_id` and builds `row_data = jsonb_build_object('row_id', …) || jsonb_object_agg(field_key, value)`. The individual sibling scalars are **not** columns at that level — they live inside the aggregated object. So a computed column must re-extract from `row_data` in a wrapping step:

```sql
-- after row_data is built, inject computed keys:
row_data || jsonb_build_object(
  '<computed_key>',
  to_jsonb( (row_data->>'<factor_a>')::numeric * (row_data->>'<factor_b>')::numeric )
)
```

- **NUMERIC throughout** (no JS float). Rounding to the computed field's `number_format` decimals at one pinned point (the value is a JSON number; display rounds — same as the aggregate).
- **NULL semantics:** a missing factor → the product is NULL (the whole computed value drops for that row), consistent with D-B at the row level. Document.
- The set of computed columns per group is read from `custom_field_definitions.ui_config->'computed'` — the trigger joins definitions it already has.

### Derivation — renderer (live read-only)
`tagea-repeating-group` renders a computed column as a **read-only display cell** (not a FormControl — R12: a control would persist + dirty). It recomputes from the row's input controls on each CD (same liveness mechanism as the total). Same closed-set arithmetic in TS, mirroring the SQL.

### Aggregate over a computed column (E2)
When `aggregation_config.source_field_key` is a computed field:
- The Stufe-1 aggregate query sums `value_number` of the source column — but a computed column has no `value_number`. So the aggregate must sum the **derived expression** instead. Branch in the trigger's aggregate block: if the source field has `ui_config.computed`, SUM the computed expression over the rows; else SUM `value_number` (the Stufe-1 path, unchanged).
- Skip strip / visibility / missing-count for computed fields (they have no stored value to require or strip).

## §4 S2a — exports (injection plan, file:line)

All three channels read the trigger summary via the shared `repeating-export.util.ts`. Add a total descriptor + per-channel emit; **read the materialized aggregate**, never re-sum (E4).

- **Shared util** (`repeating-export.util.ts`): add `totalExportName(groupKey, sourceFieldKey) => `<groupKey>_total_<sourceFieldKey>`` and a helper to read the materialized scalar from the summary (`summary['<groupKey>__<sourceFieldKey>__sum']`). Computed columns flow through `RepeatingExportPlan.defs` automatically (they are field definitions).
- **CSV** (`submissions.service.ts` ~2178-2458, metadata + value): append the total column **after** `<groupKey>_count` (E6, R8 — fixed single column, never interleaved). Computed columns appear in the per-row `<groupKey>_<n>_<computedKey>` block like any field (they widen the block by `cap`).
- **PDF AcroForm** (`submission-pdf-fill.service.ts` `fillRepeatingAcroFields`): fill `<groupKey>_total_<sourceFieldKey>` if the template has that AcroField (silent skip otherwise); computed columns fill `<groupKey>_<n>_<computedKey>`.
- **Receipt** (`submission-receipt-generation.service.ts`): a "Summe: X" line after the section's rows, formatted per the source field's `number_format`.

**Hard constraint:** the CSV block is a **fixed-column BI contract** (`cap` = `max_rows` else `DEFAULT_REPEATING_EXPORT_ROWS=10`, including inactive defs). The total is one extra descriptor; computed columns add `cap` columns each. Both are deliberate, versioned shape changes — `log()`/document for BI consumers.

## §5 Risk register (S2-specific)

| # | Risk | Mitigation |
|---|------|------------|
| R-S2-1 | Computed/aggregate keys collide with real field keys in the summary `||` merge (R9) | Reserved namespace / admin-enforced unique keys; the aggregate already uses the `__…__sum` namespace. |
| R-S2-2 | Money precision in product/percent (float) | All derivation in SQL NUMERIC; round at display only; `value_number` is NUMERIC(20,6). |
| R-S2-3 | CSV BI contract reshape (R8) | Total = single column after `_count`; computed columns documented as `cap`-width additions; version the contract. |
| R-S2-4 | R14 touch-pass cost on large groups (R13) | `DISTINCT ON (entity_id)` single-row touch; admin-triggered, rare. |
| R-S2-5 | detail_export double-sum (R3) is an **S4** concern, not S2 — but confirm S2a exports (submission CSV/PDF/receipt) are disjoint from the `detail_export` Excel-formula totals | They are: submission exports ≠ the Köln/Gronau `detail_export` engine. No overlap in S2. |
| R-S2-6 | A computed column referenced by a visibility condition / required gate | Skip computed fields in strip/required/missing-count; they are display-only derived values. |

## §6 Test strategy

- **R14:** integration — set config on populated entity → materialized aggregate appears; functional SQL test against the baseline (extend the Stufe-1 harness).
- **Computed columns:** trigger functional test (product, percent, NULL factor → NULL); renderer unit test (live read-only value); aggregate-over-computed (sum of a product column).
- **Exports:** the existing CSV/PDF/receipt repeating-export tests extended with a total column + a computed column; assert fixed column count + correct values; assert the total reads the materialized value (not re-summed).
- **Money:** a 2-dp currency product across rows sums exact (no 0.1+0.2 drift) — the recon's R2 oracle.

## §7 Contracts (additive)

- `custom_field_definitions.ui_config.computed` — the `ComputedConfig` union (FE + BE DTO; validated discriminated union, no `as any`).
- Summary JSONB: computed key inside each `row_data`; aggregate scalar unchanged (`<grp>__<col>__sum`), now possibly summing a computed expression.
- Export columns: `<groupKey>_total_<sourceFieldKey>` (after `_count`); `<groupKey>_<n>_<computedKey>` (per-row block).
- No new endpoints; group/section write DTOs already carry `aggregation_config`; the computed config rides the existing field write DTO's `ui_config`.

> **Spec-status:** plan/design for Stufe 2, sequenced (R14 → exports → computed columns). Grounded in the `positionsliste-code-recon` dossier + `repeating-export.util.ts`. No code yet.
