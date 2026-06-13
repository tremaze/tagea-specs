# Implementation Plan — Series Anchor Template Supersession

Companion to `spec.md`. Model B: the anchor is a pure template; the first
occurrence is an exception like any other; the fix hides the **superseded** anchor
from link-keyed views. Ordered phases, each independently reviewable
(`/code-review` after each). File:line refs are to the current tree.

## What is NOT needed (vs the earlier Model-A draft)

- ❌ No "show the anchor as the first occurrence" display rewrite.
- ❌ No anchor-date skip in the occurrence generators (the first occurrence
  *should* be virtual until edited).
- ❌ No `materializeFromAnchor` in-place guard (we *want* it to create the
  exception child).
- ❌ No destructive data migration (the exception child is the real occurrence;
  superseded anchors self-heal via the suppression filter).

## Guiding rule

The supersession test lives in **exactly one** place — a shared predicate — and
is reused by every link-keyed surface. Do not inline the `excluded_dates`
membership check per call-site.

---

## Phase 0 — Pin behavior with failing tests (TDD)

Add to `appointments.service.series-tz.spec.ts` (or the approval-links/budget
specs) cases that **fail** today:
- After materializing the first occurrence, `getLinksForApproval` returns **two**
  links for the same date (should be one — the exception child).
- Budget recalculation double-counts the superseded anchor (should count once).
- Editing the first occurrence "nur diesen" leaves later occurrences unchanged
  (already true — guard against regression).

---

## Phase 1 — Superseded-anchor suppression (the fix)

1. **Shared predicate.** Add `isAnchorOccurrenceSuperseded(appointment)` returning
   `recurrence_rule != null && excluded_dates?.includes(occurrenceKey(start_datetime))`.
   Place it where both services can reuse it (e.g. a small helper on the series
   generator, which already owns `occurrenceKey`, or a shared util). Must use the
   canonical UTC date key, not raw date math (TZ-safe).
2. **Approval linked-appointments list.** In `getLinksForApproval`
   (`appointment-approval-links.service.ts:325-331`) extend the existing
   `.filter(...)` to also drop links whose `appointment` is a superseded anchor.
   The relation `['appointment']` is already loaded; ensure `excluded_dates` and
   `recurrence_rule` are selected.
3. **Budget recalculation.** Apply the same predicate in the three budget
   filters — `recalculateBudget`, `getBudgetSummaries`, `verifyBudgetConsistency`
   — which already load `relations: ['appointment']` and filter
   `!appointment.is_deleted`. (Keep `?.` on the appointment, not a hard
   `link.appointment &&` guard: a budget link sums its own quantity/amount and
   must count even when the relation is not hydrated — existing tests pin this.)
4. **SQL twin for database-side aggregations.** Add `notSupersededAnchorSql(alias)`
   to the util and drop it into the surfaces that aggregate in SQL and cannot
   hydrate + filter in JS:
   - `billing-appointments.service.ts` `baseQuery()` — `.andWhere(...'appointment')`.
   - `detail-export.service.ts` `loadPriorMonthsUsage` — raw SQL `AND ...('a')`.
   - `time-account.service.ts` institution + employee KPI sums — raw SQL `AND ...('a')`.
   Validate the twin against Postgres (it must agree with the JS predicate on
   superseded/live/child/non-series rows, the UTC-midnight boundary and NULL
   `excluded_dates`).
5. **Do NOT touch `getLinksForAppointment`** — it is the inheritance reader.

**Review checkpoint 1:** Phase-0 tests go green; a series whose first occurrence
was edited shows the appointment once in "Verknüpfte Termine", counts once in
budget, appears once in the billing list, and is summed once in report/KPI
totals; a series with no first-occurrence exception is unchanged; inheritance to
later occurrences still works.

---

## Phase 2 — Calendar status convergence (optional, can ship separately)

1. In `getCalendarAppointments` (`appointments.service.ts:1144-1182`), replace the
   inline virtual-occurrence construction with the shared
   `generateVirtualOccurrencesForList` / `createVirtualAppointmentFromOccurrence`
   helpers (`:8579-8655`) so virtual status comes from `anchor.status` (deletes
   the hardcoded `'scheduled'` at `:1167` and removes duplicated dedup/mapping).

**Review checkpoint 2:** calendar virtuals carry `anchor.status`; a
`default_status='completed'` series reads `completed` in the calendar too. Diff a
known series before/after.

---

## Phase 3 — Frontend verification (likely no code change)

- The first occurrence already routes through `getVirtualOccurrence`
  (`isVirtual:true`) → `materializeVirtualOccurrence`
  (`appointment-dialog-v2.component.ts:2530-2537`). Confirm "nur diesen" on the
  first element creates an exception and does not edit the anchor.
- The virtual-occurrence approval editing in the participant panel
  (already landed: `usesDeferredApprovalSelection`) remains correct under Model B.
- Optional: forward `anchor_start_datetime` into FullCalendar `extendedProps`
  (`calendar-event.service.ts:66`) — only relevant for the "this and following"
  gating, independent of this fix.

**Review checkpoint 3:** manual run — edit first element "nur diesen", approval
lists once, later occurrences unchanged; edit a later element, it materializes.

---

## Phase 4 — Self-heal verification + optional recalc

- **No migration** to create. Verify on QS that a pre-existing duplicate (anchor
  superseded + exception child, both linked) now shows once and counts once after
  deploy — purely from the Phase-1 filters.
- **Optional one-time budget recalc** for approvals that currently double-count a
  superseded anchor, to refresh stored totals immediately rather than on the next
  link change. Read-only detection first:

  ```sql
  SELECT a.id AS anchor_id, c.id AS child_id
  FROM appointments a
  JOIN appointments c ON c.anchor_appointment_id = a.id
  WHERE a.recurrence_rule IS NOT NULL
    AND a.anchor_appointment_id IS NULL
    AND a.is_deleted = false AND c.is_deleted = false
    AND (c.start_datetime AT TIME ZONE 'UTC')::date
        = (a.start_datetime AT TIME ZONE 'UTC')::date;
  ```

---

## Phase 5 — Full verification

- `nx test tagea-backend` + `nx test tagea-frontend` green.
- E2E extension (`teamspace-calendar-series-operations.spec.ts`).
- QS smoke: create series + approval → edit first element "nur diesen" → approval
  lists once, later occurrences unchanged; confirm the earlier test's duplicate is
  gone without any migration.

---

## Sequencing & risk notes

- Phase 1 is the whole duplicate fix and is tiny (two filter predicates + one
  shared helper). Ship it first.
- Phase 2 (status) is independent and user-visible (calendar) — ship separately
  with its own change-log note if desired.
- Keep the long-term "separate `series` entity" refactor out of scope (spec
  Non-Goals).
