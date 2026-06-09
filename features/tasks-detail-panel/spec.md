# Feature: Tasks Detail Panel ("Aufgaben durcharbeiten")

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** baumgart
> **Last updated:** 2026-06-09

> Extends the existing [Tasks](../tasks/spec.md) feature. The base feature aggregates
> entities with `invalid_fields > 0` into a `Client → Case → Appointment` tree and
> navigates away (case/client detail page, appointment dialog) to resolve them.
> This feature keeps the user **in place**: a non-destructive detail panel docks to the
> right of the list so a user can step through clients one by one and close their gaps
> inline.

## Vision (Elevator Pitch)

Today `/tasks` is a flat-ish list across entities; resolving a task throws the user from
profile to case to appointment and back. This turns the page into a **master-detail
workspace**: clicking a client _selects_ it (instead of navigating), and a panel on the
right shows everything open for that one client — grouped into **Stammdaten / Fall(e) /
Termin(e)** — each section with enough context to know what it is about, the actually
missing fields, and an inline editor that saves through the entity's existing save path.
Prev/Next lets the user walk the list sequentially; a finished client drops out of the
list immediately (inbox-zero).

## User Stories

- As a **staff member** I want to click a client and see all their open profile/case/appointment fields in one panel, so that I don't have to navigate from entity to entity.
- As a **staff member** I want enough context per section (case number, appointment date, assignee, template), so that I know what I am filling in.
- As a **staff member** I want to fill the missing fields right in the panel and save, so that I never leave the task list.
- As a **staff member** I want a "next" control, so that I can work the list sequentially; once a client has no open fields it disappears.
- As a **staff member** I want the in-list expand/collapse tree to still work for a quick overview, independent of the panel.

## Decisions (resolved with product owner, 2026-06-09)

- **D1 — Completed client behaviour:** _Remove from the list immediately_ once a bundle
  reaches `0` open fields (inbox-zero). "Next" skips to the next still-open client.
- **D2 — List interaction model:** _Keep both_ — the existing in-list expand/collapse tree
  **and** the new selection-opens-panel behaviour coexist. Expand = quick overview;
  select (separate affordance) = open editing panel.
- **D3 — Field-source-of-truth:** the panel's "open fields" MUST match the list counters
  exactly. Both derive from the **same backend validation logic** (see Phase 1). The panel
  never re-derives "is this field invalid" on the client.

## Architecture

Master-detail on the existing `TasksPageComponent`:

```
┌───────────────────── /tasks (desktop ≥ 1200px) ─────────────────────┐
│  LIST (master, left)                │  PANEL (detail, right)         │
│  - grouped client tree (unchanged)  │  ClientTaskPanelComponent      │
│  - expand/collapse still works (D2) │  - header: name, dept, X/N,    │
│  - row carries a "open panel"       │    prev/next, close            │
│    affordance → selectedClientId    │  - progress bar                │
│                                     │  - sections (lazy):            │
│                                     │    · Stammdaten  (client)      │
│                                     │    · Fall 25-0042 (case)       │
│                                     │    · Termin 08.06 (appointment)│
│                                     │  - footer: "Nächster Klient ›" │
└─────────────────────────────────────┴────────────────────────────────┘
< 1200px: panel becomes a MatBottomSheet / full-width overlay (no side column).
```

Each section is a `TaskFieldSectionComponent` — a thin orchestration shell around the
existing **`TageaCustomFieldsComponent`** (pure inputs/outputs, no route dependency). It
loads the entity's field groups + values + repeating rows lazily on expand, filters the
groups to the invalid keys (focus mode, with a "show all fields" toggle), and saves
through the **existing** `save-all` / `bulkUpdateCustomFieldsV2` path — no new write path.

The panel is rendered as a **persistent column / kept-alive overlay, not a destroying
dialog**, so repeating-group temp-row state survives (known state-lift pitfall).

## Backend contract (new)

```
GET /institutions/:institutionId/tasks/clients/:clientId/detail
→ ClientTaskDetailDto {
    client:       { id, name, department_names, meta, invalid_field_keys: string[] },
    cases:        [{ case_id, case_number, title, status, template_name,
                     assigned_employee_names, meta, invalid_field_keys: string[] }],
    appointments: [{ appointment_id, start_datetime, end_datetime, template_name,
                     assigned_employee_names, case_id?, meta, invalid_field_keys: string[] }]
  }
```

- **`invalid_field_keys` is authoritative** and comes from the **same logic** as the
  `count_invalid_{client,case,appointment}_fields` SQL functions (visibility conditions,
  status-awareness, statistic-relevant gating, repeating groups). Cleanest implementation:
  refactor those counting functions to return `SETOF text` (the keys); the existing count
  becomes `cardinality(...)`. One source of truth → no drift between list badge and panel.
- Only **ended** appointments appear (`end_datetime <= now()`), consistent with the base
  feature.
- **Reuses the same ACL filters** as `getGroupedTasks` (institution / department-access /
  assigned-employee). The detail endpoint must not widen visibility.

## Acceptance Criteria

### Selection & panel

- [ ] **Given** the user clicks a client's "open" affordance, **When** it fires, **Then** `selectedClientId` is set, the row gets `.selected` styling, and the panel loads `GET …/tasks/clients/:clientId/detail`.
- [ ] **Given** D2, **When** the user toggles the expand chevron, **Then** the in-list tree expands/collapses **without** changing `selectedClientId` (the two affordances are independent).
- [ ] **Given** the panel is open, **When** a section is expanded, **Then** that section lazily loads its field groups + values + repeating rows and renders `TageaCustomFieldsComponent` filtered to `invalid_field_keys` (focus mode).
- [ ] **Given** focus mode, **When** the user toggles "Alle Felder anzeigen", **Then** the full field groups render (for corrections), and toggling back restores focus mode.
- [ ] **Given** the panel is open on a viewport `< 1200px`, **When** it renders, **Then** it appears as a `MatBottomSheet` / full-width overlay, not a side column.

### Editing & save

- [ ] **Given** a section's fields are edited and valid, **When** the user saves the section, **Then** the existing entity save path is called (`save-all` for client/case, `bulkUpdateCustomFieldsV2` for appointment) — no new endpoint.
- [ ] **Given** a save succeeds, **When** it resolves, **Then** that section's `invalid_field_keys` and the bundle's open-field count are re-fetched/patched and the progress bar updates **without** a full `loadTasks()` reload (no scroll/expansion loss).
- [ ] **Given** a repeating group with unsaved temp rows, **When** the user collapses/re-expands a section or switches sections, **Then** the temp rows are preserved (panel is non-destructive).

### Sequential navigation (Prev/Next)

- [ ] **Given** a client is selected, **When** the user clicks "Next", **Then** the next still-open client in `groups()` is selected.
- [ ] **Given** the selected client is the last on the page, **When** "Next" fires, **Then** the next pagination page loads and its first client is selected.
- [ ] **Given** the selected client is the first on the page, **When** "Prev" fires at index 0, **Then** the previous page loads and its last client is selected.
- [ ] **Given** D1, **When** a client's last open field is saved (bundle → 0), **Then** the client is removed from the list and the selection advances to the next still-open client.

### Permissions per section

- [ ] **Given** the user lacks the edit permission for an entity type (client / case / appointment), **When** that section renders, **Then** it is read-only with an explanatory hint and **no** save button — viewing tasks (`DASHBOARD_VIEW`) does not imply edit rights.

## UI States

| State           | When?                                  | Rendering                                                    |
| --------------- | -------------------------------------- | ----------------------------------------------------------- |
| No selection    | Page load, nothing clicked             | Panel column hidden/empty placeholder ("Klient auswählen")  |
| Panel loading   | After selecting a client               | Panel skeleton / spinner in header area                     |
| Section loading | After expanding a section              | Per-section spinner; other sections stay interactive        |
| Section read-only | User lacks edit permission           | Fields disabled + hint, no save button                      |
| Saving          | Section save in flight                 | Save button spinner; section locked                         |
| Bundle complete | All open fields of a client saved (D1) | Brief "erledigt" confirmation, then client leaves the list  |
| Error           | Detail/section load or save fails      | Snackbar; panel/section recoverable, list intact            |

## Non-Goals

- **New write path / new field editor** — reuse `TageaCustomFieldsComponent` and existing save endpoints only.
- **Bulk-resolve across clients** — one client bundle at a time.
- **Editing future appointments** — only ended appointments are tasks (base feature rule).
- **Changing the validation/counting semantics** — Phase 1 refactors counting to also return keys, but the definition of "invalid" is unchanged.
- **Re-deriving invalid fields on the client** — the backend is authoritative (D3).

## Edge Cases

- **Counter ≠ panel mismatch** — prevented by D3 (single SQL source). If the form's own validators would mark fewer fields than the backend (e.g. statistic-relevant non-required fields), the panel still surfaces exactly `invalid_field_keys`.
- **Entity fixed externally while panel open** — on next section save/re-fetch the keys reconcile; stale keys never block saving.
- **Status-excluded appointment** (cancelled / no-show) — backend already returns 0 invalid; such appointments never appear as a section. UI shows a hint rather than hiding silently if a section's count is 0 but it was materialised as a header.
- **Repeating-group state on close** — panel must not be a destroying dialog (known pitfall: state-lift refactor exists because a side-panel dialog wiped child state).
- **Page-boundary Prev/Next** — must load the adjacent page and select first/last; guard against double-loads.
- **Mobile (< 600px)** — no room for a side column → bottom sheet; Prev/Next still works.
- **Concurrent edits** — last-write-wins through the existing save path; out of scope to add locking here.

## Permissions & Tenant/Institution

- **Route + list:** unchanged from base feature — `permissionGuard` (`institution.access`) + `tasksFeatureGuard`; backend `@Auth({ scope: 'institution', permissions: [DASHBOARD_VIEW] })` + `@RequireFeature('tasks')`.
- **Detail endpoint:** same `@Auth`/feature gating; reuses `getGroupedTasks` ACL filters.
- **Per-section edit gating (new):** each section checks the entity-type edit permission
  (client edit / case edit / appointment edit). Without it → read-only. This is the
  load-bearing addition: `DASHBOARD_VIEW` alone must never enable writes.

## i18n Keys (new — all 16 locales, `de.json` source of truth)

> User-facing strings remain in formal German (Sie-Form).

- `tasks.panel.selectClientHint`
- `tasks.panel.openInPanel`
- `tasks.panel.sectionClient`, `tasks.panel.sectionCase`, `tasks.panel.sectionAppointment`
- `tasks.panel.showAllFields`, `tasks.panel.showInvalidOnly`
- `tasks.panel.saveSection`, `tasks.panel.saved`
- `tasks.panel.next`, `tasks.panel.prev`, `tasks.panel.progress` (`{{done}}/{{total}}`)
- `tasks.panel.readOnlyNoPermission`
- `tasks.panel.bundleComplete`
- `tasks.panel.errorLoadingDetail`, `tasks.panel.errorSavingSection`

(Run `python3 scripts/translate/translate.py` then `validate-all.py` — pre-push gate.)

## Implementation Phases

0. **Spec & decisions** (this doc).
1. **Backend** — `GET …/tasks/clients/:clientId/detail`; refactor `count_invalid_*` SQL to also yield keys (one source of truth); reuse ACL filters. _(tenant migration + `tasks.service.ts`/`tasks.controller.ts`)_
2. **Frontend `TaskFieldSectionComponent`** — orchestration shell around `TageaCustomFieldsComponent`; lazy load per entity type; focus-mode filter; save via existing path.
3. **`tasks-page` master-detail** — `selectedClientId` signal, `:host` → CSS grid (2-col ≥ 1200px), keep expand/collapse (D2), `.selected` styling.
4. **`ClientTaskPanelComponent`** — header/progress/sections/footer; bottom-sheet fallback on mobile.
5. **Prev/Next** — `currentIndex`/`canPrev`/`canNext` computed; page-boundary crossing.
6. **Refresh-on-save** — per-client recount patch into `groups()`, D1 removal; no full reload.
7. **Per-section permission gating.**
8. **i18n (16 locales) + tests** — unit (page-crossing, recount patch, permission gating) + E2E (select → fill required → counter drops → next; read-only without permission).

## References

- **Base feature:** [Tasks spec](../tasks/spec.md), [contracts.md](../tasks/contracts.md)
- **Page:** [`tasks-page.ts`](../../../apps/tagea-frontend/src/app/pages/tasks-page/tasks-page.ts) / `.html` / `.scss`
- **List service / models:** [`TasksService`](../../../apps/tagea-frontend/src/app/services/tasks.service.ts) (`ClientGroup`, `CaseGroup`, `TaskItem`, `GroupedTasksResponse`)
- **Reusable editor:** `TageaCustomFieldsComponent` (`apps/tagea-frontend/src/app/components/tagea-form/components/tagea-custom-fields.component.ts`) — inputs `fieldGroups`/`initialValues`/`repeatingGroupRows`/`disabled`/`entityContext`; `getValue()`/`getRepeatingGroupChanges()`/`markAllAsTouched()`.
- **Save endpoints:** `customFieldsV2Service.saveAllCustomFieldsV2` (client/case), `bulkUpdateCustomFieldsV2` (appointment).
- **Backend tasks:** [`TasksController`](../../../apps/tagea-backend/src/tasks/tasks.controller.ts), [`TasksService`](../../../apps/tagea-backend/src/tasks/tasks.service.ts).
- **Validation logic (source of truth):** `count_invalid_{client,case,appointment}_fields` in tenant migration `20260603130000-StatusAwareAppointmentAndClientCaseValidation.ts`; field-level precedent `ReportValidationService.evaluateRules()` (`reports/services/report-validation.service.ts`).
- **Side-panel pattern:** `field-group-side-panel` panelClass + `SideCardComponent` (`packages/ui/.../side-card`).
- **Responsive:** `ResponsiveNavigationService` (CDK BreakpointObserver; mobile `< 600px`).
- **E2E:** _(to be added under `apps/tagea-frontend-e2e/src/` — none yet)_
