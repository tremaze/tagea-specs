# Feature: Case Creation Prompt for Appointment Clients without Cases

> **Status:** 🚧 In progress
> **Owner:** baumgart@tremaze.de
> **Last updated:** 2026-05-05

## Vision (Elevator Pitch)

Counselors often book appointments without linking a case — either because they quick-create the client inline (and forget the follow-up), or because they pick an existing client who happens to have no active case, or because they edit an old appointment that pre-dates the case-management feature. Without a case link, the appointment is statistically invisible for documentation. This feature catches all three moments and offers a one-click path to attach a case: a confirmation prompt right after quick-creating a client, an inline hint on each client chip in the appointment dialog, and a top-of-dialog banner when editing existing appointments with cases-less clients.

## User Stories

- As a **counselor (Einrichtungs-Berater)** I want to **be reminded to open a case after I quick-create a client during appointment scheduling** so that **the appointment is properly documented and shows up in the statistics**.
- As a **counselor** I want to **skip the case creation if I'm in a hurry** so that **the prompt does not block my main task (creating the appointment)**.
- As a **counselor** I want **the prompt to default to the most likely values (myself as case worker, appointment date as start date)** so that **I can confirm with one click**.
- As a **counselor** I want **a visible inline hint next to a client chip when that client has no case linked** so that **I notice the gap even when I picked an existing client (not freshly created) and can act on it without leaving the appointment dialog**.
- As a **counselor** I want **a banner at the top of the appointment dialog when I open an existing appointment that has clients without case links** so that **I can retrofit cases onto historical appointments that pre-date the case-management feature or were created hastily**.

## Acceptance Criteria

- [ ] **Given** the case-management feature is enabled for the institution **and** the user has permission to create cases **and** a counselor opens the appointment dialog and quick-creates a new client of category `client`, **When** the QuickCreate-Client side panel closes successfully, **Then** a confirmation dialog appears titled "Fall für *<Vorname Nachname>* anlegen?" with actions "Fall anlegen" and "Später".
- [ ] **Given** the case-management feature is **disabled** for the institution **or** the user lacks `institution.cases.create` permission, **When** a client is quick-created, **Then** **no** confirmation dialog appears (silent — same behavior as today).
- [ ] **Given** the new client has category `related_person` or `contact`, **When** the QuickCreate panel closes, **Then** **no** prompt appears (related persons and contacts are never case subjects).
- [ ] **Given** the user clicks "Später" in the confirmation, **Then** the dialog closes, the client stays selected as appointment participant without `caseId`, and no case is created.
- [ ] **Given** the user clicks "Fall anlegen", **Then** a slim "Quick Create Case" side panel opens with: case-template dropdown (optional), assigned counselors multi-select (defaulted to the current user), start-date (defaulted to the appointment start date), and a save button.
- [ ] **Given** the user saves the Quick Create Case form, **When** the case is created successfully, **Then** the side panel closes, a snackbar `"Fall für <Klient> angelegt"` appears, and the client chip in the appointment dialog is updated to show the new case linkage so that the appointment-participant row will be saved with `case_id` set.
- [ ] **Given** the case creation fails after the client was already saved, **Then** the snackbar shows an error, the client remains selected (without case), and the user can retry via the existing case picker on the participant chip.
- [ ] **Given** the user closes the Quick Create Case panel via the X-button or escape, **Then** behavior is identical to clicking "Später": no case created, client stays linked without case.

### Inline hint on client chip (Anchor 1)

- [ ] **Given** a client is shown in the appointment-dialog participant list **and** the client's category is `client` **and** the client has no `caseId` linked **and** the user has `institution.cases.create` and the case-management feature is enabled, **Then** the client chip shows an inline hint "Kein Fall verknüpft" with an inline action "+ Fall anlegen".
- [ ] **Given** the inline hint is shown, **When** the user clicks the inline action, **Then** the QuickCreateCase side panel opens (no preceding confirm dialog — the click itself is the explicit intent), pre-filled exactly like the variant after quick-client creation.
- [ ] **Given** the QuickCreateCase save succeeds, **Then** the chip's hint disappears and is replaced by the case-name badge.
- [ ] **Given** the client category is `related_person` or `contact`, **Then** the inline hint is not shown — same gating as the post-quick-client confirm prompt.

### Banner in edit mode (Anchor 2)

- [ ] **Given** the user opens the appointment dialog in edit mode **and** at least one participant of category `client` has no case linked **and** the user has `institution.cases.create` and the feature is enabled, **Then** a banner appears at the top of the participant list saying "Klient(en) ohne Fall-Verknüpfung — Termin dokumentiert sich so nicht in der Statistik".
- [ ] **Given** the user opens the appointment dialog in **create** mode (new appointment), **Then** the banner is **not** shown — the inline hint on the chip is enough; the banner would be redundant noise during creation.
- [ ] **Given** the banner is visible, **When** all clients on the appointment have a case linked (either the user added one via the inline hint, or removed the case-less clients), **Then** the banner disappears.
- [ ] **Given** the banner is visible, the user does **not** see additional buttons in the banner — interaction happens via the existing per-chip inline hints; the banner is purely informational. (Decision: keep the banner unobtrusive; avoid double-action UI.)

## UI States

| State                      | When?                                                                           | What does the user see?                                                                                                            | A11y notes                              |
| -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Hidden                     | Feature disabled, no permission, or category ≠ `client`                         | Nothing — flow ends after client creation                                                                                          | n/a                                     |
| Confirmation prompt        | Right after QuickCreate-Client closes with a saved client of category `client`  | Modal dialog with title "Fall für *<Vorname Nachname>* anlegen?", body explaining why, two buttons: "Fall anlegen" / "Später"      | `role=dialog`, focus on primary button  |
| Quick Create Case panel    | After user clicked "Fall anlegen"                                               | Slim side panel: template dropdown, assigned counselors (multi), start date — save / cancel buttons                                | `role=dialog`, autofocus on first field |
| Saving                     | Save button clicked                                                             | Save button shows spinner + disabled, all inputs disabled                                                                          | aria-busy on form                       |
| Success                    | POST /cases responded 201                                                       | Side panel closes, snackbar `Fall angelegt`, participant chip in main appointment dialog updates to show case name                 | snackbar with `role=status`             |
| Error                      | POST /cases responded ≥ 400                                                     | Side panel stays open, error snackbar `Fehler beim Anlegen des Falls`, save button re-enabled                                      | snackbar with `role=alert`              |
| Inline hint (chip)         | Client chip rendered with `category=client && !caseId && featureEnabled && hasPermission` | Small text "Kein Fall verknüpft" + clickable "+ Fall anlegen" inline on the chip below the name                          | hint has `role=button` for the action   |
| Banner (edit mode)         | Edit mode + ≥ 1 case-less client on the appointment + feature gates pass        | Subtle banner row above the participant list, info icon + text "Klient(en) ohne Fall-Verknüpfung", no action buttons               | banner has `role=status`                |

## Flows

```
QuickCreateClientComponent.afterClosed(newClient)
        │
        ▼
┌──────────────────────────────────────────────────────┐
│ guard: caseFeatureEnabled                            │
│      && userHasPermission('institution.cases.create')     │
│      && newClient.category === 'client'              │
└──────────────────────────────────────────────────────┘
        │ pass                                  │ fail
        ▼                                       │
[Confirm Dialog]                                │
  "Fall für <X> anlegen?"                       │
  ├─ "Später"  ─────────────────┐               │
  └─ "Fall anlegen"             │               │
        ▼                       │               │
[QuickCreateCasePanel]          │               │
  ├─ template (optional)        │               │
  ├─ counselors (default: me)   │               │
  └─ start_date (default: appt) │               │
  ├─ Cancel ────────────────────┤               │
  └─ Save                       │               │
        │ POST /cases (201)     │               │
        ▼                       ▼               ▼
client linked with caseId   client linked, no caseId
        │
        ▼
appointment dialog updates participant chip
(downstream: when appointment is saved, the
 appointment_participants row is written with
 the new case_id — this is existing behavior,
 not part of this feature)
```

## Non-Goals

- **No combined backend endpoint** for client+case in one transaction. We use two separate calls. Atomicity is sacrificed for a smaller, safer change.
- **No prompt for existing clients** (the user picked an existing client from search). That is a separate concern (variant C — inline "no case linked" action on participant chip), tracked separately.
- **No prompt outside the appointment dialog.** Quick-creating a client from other entry points (e.g. the global clients page) does not trigger this prompt. The motivation — appointment-documentation gap — is appointment-specific.
- **No case-templates auto-application of custom-field defaults.** The slim panel only sets `case_template_id`; the case detail page handles the template-driven custom-field expansion as it does today.
- **No re-prompt loop.** If the user clicks "Später" once, we do not nag them later in the same session for the same client.

## Edge Cases

- **User opens the prompt but no case templates are configured for the institution:** The template dropdown shows an empty state ("Keine Vorlagen verfügbar"); template stays optional, save still works without one.
- **User has `institution.cases.create` but no `tenant.case_templates.view`:** Treat the dropdown as empty/disabled; do not block save (template is optional).
- **The current user is not in the institution's counselor pool:** Default to empty assigned counselors; user must pick at least one before save (form-level required validation, mirrors `case-dialog.component`).
- **Appointment dialog is in template/series mode:** Same prompt logic. The case is linked to the *anchor* participant; series materialization carries the case forward as today.
- **User cancels the appointment dialog after creating the case:** The case stays in the database (it was committed independently). Same behavior as today when a user opens the case dialog separately and then abandons the appointment.
- **Network error on POST /cases:** Side panel stays open with error snackbar; client is already saved (already in DB). User can retry save or cancel the side panel — client without case is the fallback.

## Permissions & Tenant/Institution

- **Required roles:** Any role that holds `institution.clients.create` (to reach this code path at all) AND `institution.cases.create` (to see the prompt).
- **Institution context:** The active institution is resolved via `InstitutionContextService` — same as the surrounding appointment dialog.
- **Backend access checks:** Standard `POST /institutions/{id}/cases` permission guard. Frontend gates the *prompt* visibility; the backend authoritatively gates the *creation*. If the frontend gate is bypassed (e.g. browser dev tools), the backend returns 403 and the existing error handling kicks in.

## Notifications (Push / In-App)

- **No new notifications introduced.** Standard case-creation notifications (if any are configured at tenant level for `case.created` events) fire as they would for any case created via the regular case dialog.

## i18n Keys

New keys (German source, all 16 supported languages must be filled):

- `quickCreateCase.promptTitle` — "Fall für {{name}} anlegen?"
- `quickCreateCase.promptBody` — "Möchten Sie für diesen Klienten direkt einen Fall anlegen, damit der Termin in der Statistik erscheint?"
- `quickCreateCase.promptConfirm` — "Fall anlegen"
- `quickCreateCase.promptDismiss` — "Später"
- `quickCreateCase.title` — "Fall anlegen"
- `quickCreateCase.template` — "Vorlage"
- `quickCreateCase.templateNone` — "Ohne Vorlage"
- `quickCreateCase.assignedEmployees` — "Zugewiesene Berater"
- `quickCreateCase.startDate` — "Beginn"
- `quickCreateCase.save` — "Anlegen"
- `quickCreateCase.created` — "Fall für {{name}} angelegt"
- `quickCreateCase.errorCreate` — "Fehler beim Anlegen des Falls"
- `quickCreateCase.chipHint` — "Kein Fall verknüpft"
- `quickCreateCase.chipHintAction` — "+ Fall anlegen"
- `quickCreateCase.editBanner` — "Klient(en) ohne Fall-Verknüpfung — Termin dokumentiert sich so nicht in der Statistik"

## Offline Behavior

Not applicable — appointment dialog requires online state already (uses live client search + permissions checks). If the user is offline when clicking "Fall anlegen", the standard HTTP error path applies: snackbar shows network error, side panel stays open.

## References

- **Angular implementation:** `apps/tagea-frontend/src/app/components/quick-create-client/quick-create-client.component.ts` (existing — emits the new client), `apps/tagea-frontend/src/app/components/quick-create-case/` (new — to be added), `apps/tagea-frontend/src/app/components/appointment-dialog-v2/appointment-dialog-v2.component.ts` (orchestrates the prompt)
- **E2E tests:** `apps/tagea-frontend-e2e/src/tests/appointments/einrichtungs-berater-quick-creates-client-and-case.spec.ts` (new)
- **Backend endpoints:** see [contracts.md](./contracts.md)
