# Feature: Custom Field Aggregation — Positionslisten (Stufe 1)

> **Status:** ✅ Stufe 1 implemented 2026-06-16 — admin authoring on Stack A (submission + appointment templates); clients/cases/institution authoring deferred (shared follow-up with conditional visibility, which is also Stack-A-only)
> **Owner:** baumgart
> **Last updated:** 2026-06-16

## Scope of this spec

This spec covers **Stufe 1 only**: a repeating custom-field section can be marked to **sum one numeric column** across its rows, and that total is shown in the fill form and the read-only detail, on **every** custom-field host (clients, cases, appointments, submissions/Meldungen, …). Computed columns, exports, normalization, subtotals, and the aggregate-as-first-class-value (statistics / report engine / visibility trigger) are explicit **Non-Goals** here and live on the roadmap (§ Roadmap). Stufe 1 is deliberately the slice with the smallest DB blast radius and no entanglement with the export, report, or visibility subsystems.

Ground truth for every file:line reference below is the verified code-reconnaissance dossier (workflow `positionsliste-code-recon`, 2026-06-16); see § Decision Ledger for the load-bearing facts that shaped the design.

## Vision (Elevator Pitch)

Customers capture lists of like items — several income sources, the line items of a cost reimbursement — as repeating custom-field sections. Today those rows just sit there; a human has to add them up. With aggregation, an admin marks one numeric column of a repeating section as "sum me", and the total is computed **once** server-side and shown wherever the section is rendered. No spreadsheets, no manual addition, no drift between screens.

## User Stories

- As an **admin** I want to mark a numeric column of a repeating section to be summed, so that staff and clients see the total of all rows without adding them up by hand.
- As a **staff member or client** filling a repeating "Positionsliste" I want to see a running total under the rows as I add and edit them, so that I can sanity-check the amount before saving.
- As a **staff member** viewing a submitted/saved entity in the read-only detail I want the section to show its computed total, so that the figure is authoritative and matches what was entered.
- As a **product owner** I want the total computed in exactly one place server-side, so that every surface (form, detail, and — later — exports and reports) shows the same number.

## Decisions (Stufe 1) — confirmed

These three decisions were **confirmed on 2026-06-16** (following the recommendations). They are encoded in the acceptance criteria below.

- **D-A — Where the aggregate lives + key format (the one S1 decision with S4 leverage). ★ Confirmed:** the trigger emits the aggregate as a **top-level scalar key** in the host's `custom_fields_summary` JSONB, named `<group_key>__<source_field_key>__sum`, in a **reserved double-underscore namespace** so it can never collide with a real `field_key`. Rationale: a top-level scalar is directly readable by the read paths and is already forward-compatible with the S4 query-builder/report path (`summary->>'key'`), avoiding a second trigger migration later. (It does **not** make the aggregate readable by the SQL visibility predicates — those read raw `custom_field_values` rows; that remains an S4 concern regardless of key format.)
- **D-B — NULL / blank semantics. ★ Confirmed:** a blank/empty numeric cell contributes **nothing** to the sum (it is skipped, not treated as a forced 0). A column where every row is blank, or a section with zero rows, sums to **0** and is displayed as a real `0` (e.g. `0,00 €`), never blank.
- **D-C — Frontend display source. ★ Confirmed:** the **server-delivered** aggregate is the source of truth for the persisted/detail value; the form **additionally** shows an **optional client-local live total** (recomputed from the row controls) for immediate feedback while typing, before save. The local total is display-only — it is never persisted, never marks the form dirty, and is reconciled to the server value after save.

## Implementation notes (Stufe 1, as built 2026-06-16)

Two clarifications from the build that refine — not contradict — the decisions:

- **Display computes from rows; the materialized aggregate is forward-investment.** In Stufe 1 the only consumer of the total is the UI, and both the fill form (live, from row controls) and the read-only detail (from the summary rows) compute it client-side. Because they sum the same values the server does (and round at display), the shown figure equals the server total. The server-materialized summary key (`<group_key>__<source_field_key>__sum`) is built and verified now, but becomes load-bearing only in S2 (exports) / S4 (reports, query-builder). This keeps S1 free of any materialization-timing dependency (an existing entity shows the right total immediately, no re-save needed).
- **No config-change backfill in Stufe 1 (consequence of the above).** At migration time no group carries `aggregation_config`, so the new trigger yields byte-identical summaries; and since the UI computes from rows, there is nothing stale to backfill. A runtime re-materialization on config change becomes necessary only when S2 makes the materialized value user-visible.

Verified: tenant migrations apply (`baseline:generate`, 543 migrations); functional trigger test (sum exact, blank-skip D-B, no `custom_fields_full` leak); backend `tsc`; frontend build; `tagea-repeating-group` unit tests incl. aggregate total; i18n `validate-all.py` across 16 locales.

## Acceptance Criteria

> Given/When/Then — observable behavior, platform-agnostic.

### Admin — authoring the aggregation

- [ ] **Given** an admin edits a **repeating** custom-field section, **When** the section editor renders, **Then** an "Summe berechnen" toggle is shown; the option is hidden for non-repeating groups.
- [ ] **Given** the aggregation toggle is enabled, **When** the sub-form renders, **Then** the admin can pick exactly one **numeric** column of that section as the summed column (`source_field_key`); only `number`-type fields of the same section are offered.
- [ ] **Given** the admin enables aggregation, **When** the section is saved, **Then** the section's `key` is guaranteed to be set (the aggregation never works on a keyless group — see Edge Cases), and the aggregation config is persisted as `aggregation_config = { kind: 'sum', source_field_key }` on the group.
- [ ] **Given** the admin disables aggregation, **When** the section is saved, **Then** `aggregation_config` is cleared (null) and the total disappears from all surfaces after the next materialization.
- [x] **Given** a repeating **submission template** section in the admin (Stack A), **When** the editor renders and the section has ≥1 numeric column, **Then** the aggregation toggle + column picker are shown. *(Scope note: authored on Stack A only — the same group-form stack that owns conditional-visibility authoring. Stacks B/C (clients/cases/institution) have neither editor yet; adding field-aware authoring there is a shared follow-up for both features. The data + render layers already work on every host regardless of where the config is set.)*
- [ ] **Given** the admin changes only the `aggregation_config` of a section that already has saved entities, **When** the change is deployed, **Then** existing entities' totals are refreshed by the migration's backfill pass (the value trigger does not re-fire on a group-config change — see Edge Cases).

### End-user — fill form

- [ ] **Given** a repeating section with `aggregation_config.kind = 'sum'`, **When** the section renders in the fill form (inline list **and** side-panel dialog), **Then** a total row "Summe: X" is shown beneath the rows, formatted per the summed field's `number_format` (e.g. `1.250,00 €` for a currency column).
- [ ] **Given** the user adds, edits, or removes a row, **When** the row's summed cell changes, **Then** the client-local live total updates immediately (D-C), driven by the row controls (not the 300 ms-debounced form change).
- [ ] **Given** a row's summed cell is empty, **When** the total is computed, **Then** that row contributes nothing (D-B); a section with all-empty or zero rows shows `0` (e.g. `0,00 €`).
- [ ] **Given** a row is hidden by a per-row visibility condition (its summed cell is blanked/stripped), **When** the total is computed, **Then** the hidden row does not contribute (consistent with the visibility strip — hidden values do not exist).
- [ ] **Given** the user saves, **When** the save completes and the server total is reloaded, **Then** the displayed total reconciles to the **server-computed** value; the client-local total never persists and never marks the section dirty (D-C).

### Read-only detail

- [ ] **Given** a saved/submitted entity is opened in the read-only detail, **When** a repeating section with aggregation renders, **Then** the section shows its server-computed total formatted per `number_format`.
- [ ] **Given** the section has no `aggregation_config`, **When** the detail renders, **Then** no total row is shown (unchanged from today).

### Server — single source of truth & money correctness

- [ ] **Given** any write path that mutates a row value (create, save-all, bulk, single-field, row create/update/delete), **When** the materialization trigger runs, **Then** the aggregate is recomputed in **SQL** as `SUM(value_number)` over the configured column (NUMERIC, exact), never in JavaScript.
- [ ] **Given** a currency-formatted summed column, **When** the aggregate is materialized, **Then** rounding to the format's decimals (currency = 2) happens at exactly one pinned point; no intermediate float rounding occurs (no `parseFloat`/`applyPrecision` in the sum path).
- [ ] **Given** the aggregate is materialized, **When** the read paths serialize the section, **Then** every surface (form, detail) consumes the **same** materialized value; no surface recomputes the sum independently.
- [ ] **Given** a host that writes its `custom_fields_summary` via a legacy DTO shortcut rather than the EAV `custom_field_values` table, **When** evaluated for Stufe 1, **Then** it is out of scope (Stufe 1 targets only sections stored through the EAV value path; see Edge Cases R15).

### Cross-host parity

- [ ] **Given** the aggregation is configured on a section, **When** that section is rendered on **any** host entity (client, case, appointment, submission, …), **Then** the total behaves identically — the feature is implemented once on the shared EAV/trigger/renderer layer, not per entity.

## UI States

### Admin editor — aggregation section

| State                  | When?                                            | What does the user see?                                                     | A11y notes              |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------- |
| Aggregation unavailable | Section is non-repeating                          | No aggregation toggle                                                        | —                       |
| Aggregation off         | Repeating section, toggle off (default)           | "Summe berechnen" toggle, off                                               | `aria-label` on toggle  |
| Aggregation on          | Toggle on                                         | Column picker (numeric columns of this section only)                         | labelled select         |
| No numeric column       | Toggle on, but section has no number field        | Toggle on, picker shows an empty/disabled state with a hint                  | hint text               |

### Fill form / detail — total row

| State                | When?                                         | What does the user see?                                                | A11y notes        |
| -------------------- | --------------------------------------------- | ---------------------------------------------------------------------- | ----------------- |
| No aggregation       | Section without `aggregation_config`           | Rows only, no total row (unchanged)                                     | —                 |
| Total, populated     | Aggregation on, ≥1 contributing row            | "Summe: 1.250,00 €" beneath the rows                                    | total announced   |
| Total, zero          | Aggregation on, no contributing rows           | "Summe: 0,00 €"                                                         | —                 |
| Live (editing)       | User editing rows (fill form)                  | Total updates immediately as cells change (client-local, D-C)          | live region       |

## Flows

```
Admin: edit repeating section → enable "Summe berechnen" → pick numeric column → save
   └─ persists aggregation_config on custom_field_groups; ensures group.key set
   └─ migration backfill refreshes totals for existing entities

User fill: open entity → render repeating section
   └─ rows render (unchanged)
   └─ total row renders from server-materialized aggregate
   └─ user edits a cell → client-local live total updates
   └─ save → values written via EAV → AFTER-ROW trigger recomputes SUM in SQL
            → summary JSONB updated → reload → displayed total = server value

Detail (read-only): open entity → section renders rows + server-computed total
```

## Non-Goals (Stufe 1)

Explicitly **not** in this spec — each is a later stage (§ Roadmap):

- **Computed columns** (product `menge × einzelpreis`, percent `netto → brutto`) — Stufe 2. (Note: there is a real SQL-structure constraint here — the per-row CTE does not expose the individual scalars as columns; deferred deliberately.)
- **Aggregate in CSV / PDF / receipt exports** — Stufe 2. The CSV column layout is a fixed BI contract; a versioned, deliberate change.
- **Normalization** (monthly/yearly factor) and **per-category subtotals** — Stufe 3.
- **Aggregate as a first-class queryable value** — Stufe 4: statistics / `invalid_fields`, the `detail_export` report engine, and visibility triggers ("show field if Summe > X"). The SQL visibility predicates and statistics counters read raw `custom_field_values` rows, so a summary-JSONB aggregate is invisible to them; wiring that is the largest fork and is out of scope here.
- **Open formula language** — parked indefinitely; only the closed parametric set (Stufe 2+) is planned.
- **Fixing the pre-existing query-builder silent-zero bug** (repeating-member fields are offered as aggregatable and read NULL → silently 0): a **separate** bug, tracked independently of this feature (see § Decision Ledger R6).

## Edge Cases

- **Keyless groups never materialize.** The cache trigger is gated on `group.key IS NOT NULL`; a keyless repeating group produces no summary, hence no aggregate. The admin preset **must** set `custom_field_groups.key` when aggregation is enabled. (R7)
- **Reserved key namespace.** The aggregate key uses a reserved double-underscore namespace (`<group_key>__<col>__sum`) so it can never be clobbered by, or clobber, a real `field_key` in the summary JSONB merge. (R9)
- **Aggregate also lands in `custom_fields_full`.** The trigger writes the same repeating object into both `custom_fields_summary` and `custom_fields_full`; the aggregate key therefore appears in both. Snapshot tests of the full cache (e.g. client-report DOCX snapshots) must be regenerated. (R10)
- **Empty cell ≠ EAV row.** An empty numeric cell stores no `custom_field_values` row; `SUM(value_number)` simply skips it. This realizes D-B (blank contributes nothing). Documented, intentional.
- **Hidden rows excluded.** A row hidden by a per-row visibility condition has its value stripped/blanked; it contributes nothing to the sum, consistent with the rest of the visibility system.
- **Config change does not re-fire the value trigger.** The trigger fires on `custom_field_values`, not on `custom_field_groups`. Changing `aggregation_config` requires the migration's per-host backfill/touch pass to refresh existing entities; new writes materialize lazily. (R14)
- **No computed FormControl.** The client-local live total must be a display value, not a FormControl — a control would be collected into the saved bag and would mark rows dirty. (R12)
- **Flat → repeating flip is unsupported on a populated group.** Toggling an existing populated group into a repeating "Positionsliste" inherits the documented flat→repeating governance limit; the preset should create repeating sections fresh, not convert populated flat groups.
- **Money precision.** `value_number` is `NUMERIC(20,6)` (exact). The sum stays in SQL/NUMERIC; every JS hop (`applyPrecision`, `parseFloat`, `Number()`) is float-lossy and must be kept out of the sum path. (R2)

## Permissions & Tenant/Institution — authoring surfaces

- **Required roles:** authoring an aggregation requires the same admin permission that already gates editing the host's custom-field group (no new permission introduced). Filling/viewing requires the existing permission for the host entity.
- **Institution context:** unchanged — inherited from the host entity's existing rules.
- **Surfaces (load-bearing):** the section/group editor is **forked into three stacks**, and the aggregation UI must be added to all of them:
  - **Stack A** (newest Side-Card editor): `admin-group-editor.component.ts` — appointment templates + submission categories.
  - **Stack B**: `generic-group-form.component.ts` — cases + report + financial-support; **also** the appointment-template editor reached via `/einstellungen/terminvorlagen` (appointments straddle A and B).
  - **Stack C**: `client-group-form.component.ts` — clients + institution.
  - A shared aggregation-config type belongs in `custom-fields.model.ts` to prevent three-way drift.

## i18n Keys

User-facing strings stay in German. New keys span the **three** admin i18n namespaces (one per group-form stack) plus the renderer/detail namespace, and must be added to **all 16 locales** (`de.json` source of truth; `validate-all.py` gate). Indicative keys:

- `customFields.aggregation.enableLabel` — "Summe berechnen"
- `customFields.aggregation.columnLabel` — "Summen-Spalte"
- `customFields.aggregation.noNumericColumnHint` — hint when no numeric column exists
- `customFields.repeatingGroup.sumLabel` — "Summe" (renderer/detail total row)

## Roadmap (out of scope here, for context)

| Stufe | Content | Key risk it pulls in |
| ----- | ------- | -------------------- |
| **S1 (this spec)** | Simple column sum + form/detail display | smallest; avoids export/report/visibility |
| S2 | Sum in CSV/PDF/receipt + parametric computed columns — spec: [stufe-2.md](./stufe-2.md) | BI fixed-column contract; per-row CTE scalar-availability; R14 re-materialization |
| S3 | Normalization (monthly/yearly) + per-category subtotals | factor source; possible 2-pass trigger |
| S4 | Aggregate as first-class value: statistics, `detail_export`, visibility trigger — spec: [stufe-4.md](./stufe-4.md) | predicates read raw cfv rows; report double-sum seam (Excel formula totals); largest fork |

## Decision Ledger — load-bearing facts (recon-verified)

The design rests on these verified facts (workflow `positionsliste-code-recon`, all claims `verified:high`):

- **No summary table.** The "materialization" is the PL/pgSQL trigger `update_entity_custom_fields_cache()` writing `custom_fields_summary` / `custom_fields_full` JSONB columns on each host table (11 entity types), gated on `cfg.key IS NOT NULL`. Keystone: `20260611160100-UpdateCacheTriggerRowOrdering.ts:114-138`. **The single injection point for the aggregate.**
- **`value_number` is `NUMERIC(20,6)`** — money is exact in storage; keep the sum in SQL (R2).
- **Three forked admin stacks**, appointments straddle two (R1) — see § Surfaces.
- **Two divergent read paths** (trigger-summary vs. live `getRepeatingGroupRows`), different value shapes and row order, 11 hosts on the live path; the live path must read the materialized aggregate through, not recompute (R4).
- **R5 (S4):** SQL visibility predicates + statistics counters read raw `custom_field_values` rows → a JSONB aggregate is invisible to them → S4 needs a predicate-readable materialization; deferred.
- **R6 (separate bug):** the query-builder already offers repeating-member fields as aggregatable and reads NULL → silently 0, across 7 `->>` call sites. Tracked independently.
- **R7 keyless groups, R9 key collision, R10 full-cache, R12 no computed control, R14 config-change backfill, R15 legacy DTO shortcuts** — see Edge Cases.

## References

- **Backend — keystone trigger:** `apps/tagea-backend/src/database/tenant-migrations/20260611160100-UpdateCacheTriggerRowOrdering.ts:114-138`
- **Backend — group config home:** `apps/tagea-backend/src/custom-fields/entities/custom-field-group.entity.ts:199`
- **Backend — value storage / money:** `apps/tagea-backend/src/custom-fields/entities/custom-field-value.entity.ts:104-105`
- **Backend — write lifecycle:** `apps/tagea-backend/src/custom-fields/services/custom-fields-value-v2.service.ts:973-1434`
- **Frontend — renderer + total slot:** `apps/tagea-frontend/src/app/components/tagea-form/components/tagea-repeating-group.component.ts:95`, `tagea-custom-fields.component.ts`
- **Frontend — admin group forms (3 stacks):** `admin-group-editor.component.ts` · `generic-group-form.component.ts` · `client-group-form.component.ts`
- **Wire contracts:** see [contracts.md](./contracts.md)
- **Angular implementation / parity:** see [parity.md](./parity.md)
