# Feature: Series Anchor — Template Supersession (no duplicate occurrence)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** baumgart
> **Last updated:** 2026-06-12

## Vision (Elevator Pitch)

Recurring appointments use an **anchor pattern**: one `appointments` row is the
anchor — it holds the `recurrence_rule` and is the **series template**. Every
date the rule produces (including the very first) is shown as a **virtual
occurrence** until the user edits it; editing "this occurrence only" then
**materializes a standalone exception** (a real child row,
`child.anchor_appointment_id = anchor.id`), and the anchor's own date for that
occurrence is added to `excluded_dates`. This mirrors how Outlook/Google treat
"this event only" on any occurrence, including the first.

The model is sound; one consequence was not handled: after the first occurrence
is materialized as an exception, the anchor's **own** date is excluded — the
anchor is now a **pure template** — but its approval link is still listed. Lists
keyed by approval link (the approval's "Verknüpfte Termine" view and budget) then
show the appointment **twice**: once via the superseded anchor, once via the
exception child.

This feature defines and enforces one **invariant**:

> **A series anchor whose own occurrence date has been superseded by a
> materialized exception (its own canonical date ∈ `excluded_dates`) is a pure
> template. It must not appear as an occurrence in any appointment listing, the
> approval's linked-appointments view, or budget. The materialized exception
> represents that occurrence.**

Editing the first occurrence therefore behaves exactly like editing any other:
it creates an isolated exception; the series template and all later occurrences
are untouched.

## Problem & Root Cause

The anchor row is **overloaded**: series template **and** the data-bearing first
instance. While the anchor's own date is still live it legitimately *is* the
first occurrence. Once that occurrence is materialized as an exception, the
anchor becomes template-only — but nothing hides it from link-keyed views.

### Concrete defect

After `materializeFromAnchor` creates the exception child for the anchor's date,
the write-back adds that date to `anchor.excluded_dates`
(`appointments.service.ts:3474-3497`) and `copyApprovalLinksFromAnchor`
(`:3560`, `:3623`) copies the anchor's approval link onto the child. Now **both**
the (superseded) anchor and the child carry a link to the approval.
`getLinksForApproval` (`appointment-approval-links.service.ts:325-331`) and the
budget recalculation (`approval-budget.service.ts:51-58`, `:267-275`) list/sum
links filtering only `!appointment.is_deleted` — so the superseded anchor's link
is shown and counted → the appointment appears twice and budget double-counts.

## Where the duplicate surfaces (and where it doesn't)

Safe by construction — these never render the anchor as a billable occurrence:
- **Calendar** (`appointments.service.ts:1116-1182`) uses anchors only to
  generate virtuals and respects `excluded_dates`; once the anchor date is
  excluded, no virtual is emitted for it and only the child shows. The anchor row
  is never rendered as itself.
- **Client list** (`getClientAppointments`, `:4577`) and **case list**
  (`getCaseAppointments`, `:5175`) explicitly exclude anchors
  (`recurrence_rule IS NULL OR anchor_appointment_id IS NOT NULL`).

Affected — these list/sum by **approval link** (or join appointments to links)
and do not know the anchor/template distinction, so a superseded anchor whose
link is still present is shown/summed alongside its exception child:
- **Approval "Verknüpfte Termine"** — `getLinksForApproval`
  (`appointment-approval-links.service.ts`). *The reported bug.*
- **Approval budget** — `recalculateBudget`, `getBudgetSummaries`,
  `verifyBudgetConsistency` (`approval-budget.service.ts`).
- **Billing appointments list** — `billing-appointments.service.ts` `baseQuery`
  (only when the anchor is `status='completed'`).
- **Report prior-months usage** — `detail-export.service.ts`
  `loadPriorMonthsUsage` (raw SQL `SUM`).
- **Workforce KPIs** — `time-account.service.ts` institution + employee billable
  minutes (raw SQL `SUM`).

**Not affected — must NOT be filtered:** `getLinksForAppointment(appointmentId)`
returns *an appointment's own* links and is the inheritance reader (the dialog
seeds a virtual occurrence's approvals from the anchor's links); filtering it
would strip inherited approvals from later occurrences of a superseded series.

## Design Decisions

1. **Anchor = series template; never shown as itself.** Keep the existing
   behavior: every occurrence (including the first) is virtual until edited.
2. **"This occurrence only" always materializes an exception** — for the first
   occurrence too. The template and later occurrences are untouched. (Existing
   behavior; the first occurrence already routes through
   `materializeVirtualOccurrence`.)
3. **Superseded-anchor suppression (the fix).** Introduce a single predicate
   `isAnchorOccurrenceSuperseded(appointment)` —
   `recurrence_rule set && no anchor_appointment_id &&
   occurrenceKey(start_datetime) ∈ excluded_dates` (canonical UTC date key,
   matching `AppointmentOccurrenceExpander.occurrenceKey`). A superseded anchor's
   link is neither shown nor counted; the exception child represents that
   occurrence. Two forms, one source of truth (`series-supersession.util.ts`):
   - **JS predicate** `isAnchorOccurrenceSuperseded(appointment)` for paths that
     hydrate appointments and filter in code — `getLinksForApproval` and the
     three budget methods.
   - **SQL twin** `notSupersededAnchorSql(alias)` for paths that aggregate in the
     database and cannot hydrate — billing `baseQuery` (QueryBuilder
     `andWhere`), and the raw-SQL sums in `loadPriorMonthsUsage` and the two
     time-account KPIs. `excluded_dates` is a **jsonb column holding a
     double-encoded JSON string** (TypeORM's transformer `JSON.stringify`s the
     `string[]`, so the stored jsonb is a *string scalar* like
     `"[\"2026-06-08\"]"`, NOT a jsonb array). The twin unwraps the scalar with
     `#>> '{}'` before re-casting to a jsonb array:
     `jsonb_exists((COALESCE(excluded_dates::jsonb,'[]'::jsonb) #>> '{}')::jsonb,
     to_char(start_datetime AT TIME ZONE 'UTC','YYYY-MM-DD'))`. The JS predicate
     needs no such handling (TypeORM parses it back to `string[]` on read).
     **Landmine:** a naive `jsonb_exists(excluded_dates, key)` silently returns
     false on real data and was only caught by the full-stack e2e against real
     backend-written rows (a hand-inserted jsonb *array* passes falsely). Both
     forms are kept logically identical; the twin is validated end-to-end by the
     e2e (`einrichtungs-berater-superseded-anchor-hidden-from-approval.spec.ts`).
4. **Status model — virtual occurrences carry `anchor.status`.** Status derives
   from the **client** participants' `response_status`
   (`appointment-participants.service.ts:150`) and is seeded by
   `template.default_status` at create (`appointments.service.ts:1889`);
   re-derivation runs only when a participant response **changes** (`:471`), so a
   template default such as `'completed'` persists. Virtual occurrences share the
   anchor's client participants and have no per-occurrence client-status override
   (`applyOccurrenceResponseOverrides` overlays staff RSVP only, `:3045`), so a
   virtual occurrence's status is by construction `anchor.status`. The calendar's
   hardcoded `'scheduled'` (`:1167`) is the outlier and is converged onto
   `anchor.status` (separate, low-risk cleanup; see Phase 2).
   - **Known limitation (pre-existing, out of scope):** an un-materialized future
     occurrence cannot show a per-occurrence client status distinct from the
     anchor. A true per-occurrence client status would require extending the
     occurrence-response overlay to clients + per-occurrence re-derivation.
5. **No schema change, no destructive migration.** Superseded anchors already
   carry their own date in `excluded_dates` (write-back happened at materialize
   time), so the suppression predicate hides existing duplicates retroactively —
   the data self-heals. Budget self-heals on the next recalculation; an optional
   one-time recalc for affected approvals can be run to refresh stale totals
   immediately. No rows are deleted (the exception child is the legitimate
   occurrence).

## Acceptance Criteria

### First occurrence behaves like any other

- [ ] **Given** a series with anchor date D1, **When** the user opens the **first**
  element and chooses "nur diesen Termin" and saves a change (e.g. status),
  **Then** a standalone exception child is materialized for D1, D1 is added to the
  anchor's `excluded_dates`, and the anchor's other occurrences (D2, D3 …) are
  **unchanged** (title, time, status).
- [ ] **Given** the first occurrence was edited "nur diesen", **When** later
  occurrences render, **Then** they still reflect the **template** values, not the
  exception's changes.

### No duplicate in link-keyed views

- [ ] **Given** the first occurrence has been materialized as an exception,
  **When** the linked approval's "Verknüpfte Termine" is opened, **Then** the
  appointment for D1 is listed **exactly once** (the exception child), and the
  superseded anchor is **not** listed.
- [ ] **Given** the same state, **When** the approval budget is recalculated,
  **Then** D1 is counted **once** (via the exception child), never via the
  superseded anchor.
- [ ] **Given** an anchor whose own date is **not** excluded (no first-occurrence
  exception yet), **When** "Verknüpfte Termine"/budget run, **Then** the anchor's
  link **is** shown/counted — it legitimately represents the first occurrence.
- [ ] **Given** a `completed` superseded anchor and its exception child, **When**
  the billing appointments list, report prior-months usage, or workforce
  billable-minutes KPIs are computed, **Then** the occurrence is counted **once**
  (the child); the superseded anchor is excluded via `notSupersededAnchorSql`.
- [ ] **Given** an appointment's own approval links are read for inheritance
  (`getLinksForAppointment`, e.g. seeding a virtual occurrence from its anchor),
  **When** the anchor is superseded, **Then** its links are **still returned** —
  later occurrences must inherit them.

### Calendar / lists (regression guard + status)

- [ ] **Given** a series with a first-occurrence exception, **When** the calendar,
  client list, and case list render, **Then** each shows exactly one row for D1
  (the exception child) — no anchor, no leftover virtual.
- [ ] **Given** a template with `default_status='completed'`, **When** any
  occurrence renders (virtual or exception), **Then** it shows `'completed'`; the
  calendar no longer hardcodes `'scheduled'`.

### "Ganze Serie" (unchanged)

- [ ] **Given** the user chooses "ganze Serie", **When** they save, **Then** the
  anchor (rule + base fields) is updated and all non-excepted occurrences follow;
  RRULE-interval changes remain blocked when exceptions exist (`:2346-2367`).

## Test Plan

**Model spec:** `appointments.service.series-tz.spec.ts` (real
`AppointmentSeriesGeneratorService` + `AppointmentOccurrenceExpander`, mocked
repos, `makeAnchor()` / `makeMaterializedChild()` builders, `x-timezone`
request).

Backend unit coverage:
- `isAnchorOccurrenceSuperseded`: true iff `recurrence_rule` set and the anchor's
  own canonical key ∈ `excluded_dates`; TZ edge (anchor at `00:00 Europe/Berlin`)
  maps to the correct day.
- `getLinksForApproval`: superseded anchor's link excluded; non-superseded
  anchor's link included; exception child's link included.
- Budget recalculation: superseded anchor's link not summed; child summed once.
- Materialize of the first occurrence: exception child created, anchor date added
  to `excluded_dates`, later occurrences unaffected.
- Status: virtual occurrence carries `anchor.status`; calendar generator no
  longer hardcodes `'scheduled'`; `default_status='completed'` yields `completed`.

**E2E** (`teamspace-calendar-series-operations.spec.ts`, real DB, direct SQL seed
via `createAppointment({recurrenceRule})`): create series + approval, edit the
first element "nur diesen", assert the approval lists the appointment **once** and
later occurrences are unchanged; edit a later occurrence and assert it
materializes independently.

**Self-heal check:** seed the pre-fix state (anchor with its own date in
`excluded_dates` + an exception child both linked to one approval); assert
"Verknüpfte Termine" shows one row and budget counts once **without** any data
migration.

## Rollout & Risk

- **Code review per layer** (suppression predicate + link/budget filters →
  calendar status convergence → tests), per the repo's per-phase `/code-review`
  convention.
- **Risk: budget staleness.** Already-stored approval totals that double-counted a
  superseded anchor refresh on the next recalc; optionally run a one-time recalc
  for affected approvals at deploy.
- **Risk: status change is user-visible (calendar only).** Calendar virtuals move
  from hardcoded `'scheduled'` to `anchor.status`, matching the lists — intended;
  call it out in the change log. This can ship separately from the duplicate fix.
- **Low blast radius:** the core fix touches two filter predicates; no schema, no
  display rewrite, no row deletion.

## Non-Goals

- **Model A** ("anchor shown as the first occurrence, edited in place"):
  rejected — "nur diesen" on the first occurrence would leak inherited fields
  (title/time/status) to the whole series.
- Splitting the recurrence definition into a separate `series` entity (the
  textbook normalization that would dissolve the template/instance overload
  entirely) — out of scope.
- Per-occurrence **client** status overrides for un-materialized occurrences —
  tracked separately (see Design Decision 4).
