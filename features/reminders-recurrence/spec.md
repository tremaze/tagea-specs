# Reminders — Recurrence (RRULE extension)

Status: implemented (Stage 1). Scope: extend the recurrence of Wiedervorlagen
(reminders) from the three fixed presets (`monthly`/`quarterly`/`yearly`) to
full RFC 5545 RRULE patterns (weekday rules, custom intervals, monthly
day-of-month / nth-weekday), reusing the recurrence idiom that already exists
for appointments.

This is an **additive** extension. The legacy `recurrence_pattern` enum keeps
working unchanged for active clients (web + Flutter). Materialization stays
**on completion** — there is no scheduler in this stage; the next occurrence is
created when the current one is marked completed (as today).

## Background

Reminders are stored in a single `reminders` table mapped by two TypeORM
entities (`Reminder` for the case path, `FollowUpReminder` for the client path)
plus an abstract `BaseReminder`. Each carries its own `calculateNextDueDate()`.
The existing recurrence model:

- `is_recurring: boolean` — master toggle.
- `recurrence_pattern: 'monthly' | 'quarterly' | 'yearly' | null`.
- `recurrence_end_date: date | null` — series end (inclusive upper bound).

`calculateNextDueDate()` switches on the pattern (+1 / +3 / +12 months) and
returns `null` past `recurrence_end_date`. The next occurrence is materialized
in `createNextRecurringReminder()` on completion, cloning the row (checklist
items carried over and reset to `open`).

Appointments already use RRULE (`recurrence_rule` text column, `rrule@^2.8.1`,
`app-rrule-builder` ControlValueAccessor, `RRuleService`, `rruleBuilder.*` i18n
in all 16 locales).

## Data model (additive)

New nullable column on `reminders`:

| Column            | Type        | Notes                                              |
| ----------------- | ----------- | -------------------------------------------------- |
| `recurrence_rule` | `text` NULL | RFC 5545 RRULE string, e.g. `FREQ=WEEKLY;BYDAY=MO,TH` |

No other new columns. The series end continues to use the existing
`recurrence_end_date` (the RRULE itself must **not** carry `UNTIL`/`COUNT` for
reminders — see Contract). `due_date` is date-only; the RRULE DTSTART is the
reminder's `due_date` at UTC midnight.

## Behavior

`calculateNextDueDate()` (shared pure util `computeNextReminderDueDate`, both
concrete entities delegate to it):

1. If `!is_recurring` → `null`.
2. If `recurrence_rule` is set → parse it (`rrule`), set DTSTART = `due_date`
   (UTC midnight), return the **next occurrence strictly after `due_date`**.
   If that date is after `recurrence_end_date` (when set) → `null`.
3. Else if `recurrence_pattern` is set → legacy month-arithmetic switch
   (unchanged).
4. Else → `null`.

The on-completion clone (`createNextRecurringReminder`) spreads the row, so
`recurrence_rule` propagates to the next occurrence automatically.

## API contract (precedence — important)

`recurrence_rule` is the **source of truth** when present; `recurrence_pattern`
is the legacy/compat fallback. To avoid silent conflicts when a legacy client
and the new client edit the same reminder, create/update apply:

- **`recurrence_rule` provided (non-empty)** → store it; it wins. For old-client
  display, derive a best-effort `recurrence_pattern`
  (`FREQ=MONTHLY` w/o BYx → `monthly`; `FREQ=MONTHLY;INTERVAL=3` → `quarterly`;
  `FREQ=YEARLY` → `yearly`; otherwise leave `recurrence_pattern = null`).
- **`recurrence_pattern` provided but `recurrence_rule` absent from the request**
  (legacy-style edit) → set `recurrence_rule = null`; the legacy pattern wins.
- **Neither provided** in a partial update → both left unchanged.
- **`is_recurring = false`** → both cleared.

Validation: `recurrence_rule` is optional, `@IsString`, must match
`/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/` (same regex as appointments). The
existing "recurrence pattern required for recurring reminders" guard is relaxed
to: a recurring reminder must have **either** `recurrence_pattern` **or**
`recurrence_rule`.

Response shape gains the optional `recurrence_rule` field on both reminder
endpoints (case + follow-up). All other fields unchanged.

## Frontend

- Reuse `app-rrule-builder` (standalone, emits an RRULE string) inside both
  reminder dialogs, bound to a `recurrence_rule` control, with
  `[seriesStartDate]="due_date"`.
- The builder gets a new additive `@Input() showSeriesEnd = true` (default keeps
  appointments unchanged). Reminders pass `[showSeriesEnd]="false"` so the
  builder's own never/count/until section is hidden — reminders keep their
  existing `recurrence_end_date` field as the single end control.
- Edit hydration: a legacy reminder (`recurrence_pattern` set, no
  `recurrence_rule`) is converted to an equivalent RRULE for the builder
  (`monthly`→`FREQ=MONTHLY`, `quarterly`→`FREQ=MONTHLY;INTERVAL=3`,
  `yearly`→`FREQ=YEARLY`). On save the dialog sends `recurrence_rule` and omits
  `recurrence_pattern`.
- Reminder lists/cards show the human-readable rule (`RRuleService`) when a
  `recurrence_rule` is present, falling back to the legacy pattern label.

## i18n

Reuse the existing `rruleBuilder.*` keys (present in all 16 locales). Any new
reminder-dialog wrapper labels are added under `profilePage.reminders.*` to all
16 frontend locales (`de.json` is source of truth).

## Out of scope (Stage 2+)

- Scheduler that advances series independent of completion + automatic overdue
  nudges (BullMQ tick, idempotency/sent-log).
- `UNTIL`/`COUNT` inside the reminder RRULE (reminders use `recurrence_end_date`
  and on-completion materialization; honoring `COUNT` needs occurrence tracking).
- Virtual/expanded occurrences, exclusions, anchor materialization (reminders
  materialize one-ahead on completion, not a virtual series like appointments).

## Acceptance

- A reminder with `FREQ=WEEKLY;BYDAY=MO,TH` due on a Monday, when completed,
  materializes the next occurrence on the following Thursday; completing that
  one materializes the next Monday; bounded by `recurrence_end_date`.
- A legacy `monthly` reminder still materializes +1 month (no `recurrence_rule`).
- Old client reading an RRULE reminder still sees a sensible
  `recurrence_pattern` for simple monthly/quarterly/yearly rules; weekday rules
  leave it `null` without breaking the response.
- Editing a legacy reminder in the new dialog round-trips to an equivalent
  RRULE; editing it in an old client clears the RRULE and uses the pattern.
