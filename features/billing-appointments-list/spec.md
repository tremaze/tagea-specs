# Feature: Billing Appointments List

> **Status:** 🚧 Spec drafted — implementation in progress
> **Owner:** baumgart
> **Last updated:** 2026-05-06

## Vision (Elevator Pitch)

The billing page splits the catch-all "Termine" tab into two focused work surfaces: **Abrechenbar** (line-item-ready candidates) and **Zu prüfen** (case-bound completed appointments that nobody has decided on yet). A single explicit "Nicht abrechnen" action resolves the second list, so it doesn't grow unbounded.

## User Stories

- As a **billing clerk** I want to see only appointments that are ready for invoicing, so that the list maps 1:1 to my work.
- As a **billing clerk** I want a separate worklist of completed case appointments without a billing decision, so that nothing slips through.
- As a **billing clerk** I want to mark an appointment as "not to be billed", so that the to-review list stays focused on real open work.
- As a **billing clerk** I want to undo that decision if I marked one wrongly, so that I can recover from a misclick.

## Acceptance Criteria

### Tab "Abrechenbar" (mode=billable)

- [ ] **Given** the billing page loads tab "Abrechenbar", **When** `GET /institutions/:id/billing/appointments?mode=billable` resolves, **Then** rows render only for appointments where `status='completed'`, the appointment has at least one `appointment_approval_links` row, and not every link is already on a non-cancelled invoice.
- [ ] **Given** an appointment has all its approval links already invoiced, **When** the list reloads, **Then** that appointment does not appear (was previously a disabled "Bereits abgerechnet" row — gone now).
- [ ] **Given** the user picks rows and clicks "Rechnung erstellen", **When** the dialog opens, **Then** the existing grouping (cost_carrier × case × billing_period) and creation flow are unchanged.

### Tab "Zu prüfen" (mode=to_review)

- [ ] **Given** the billing page loads tab "Zu prüfen", **When** the endpoint resolves, **Then** rows render only for appointments where:
  - `status='completed'` AND
  - at least one participant has `participant_type='client'` AND `case_id IS NOT NULL` AND
  - `appointment.appointmentApprovalLinks` is empty AND
  - `appointment.booking_category_id IS NULL` (no teamspace-bookings) AND
  - `appointment.billing_decision IS NULL` (not yet skipped).
- [ ] **Given** an appointment has only `participant_type='external'` participants and no client-case link, **When** the list renders, **Then** that appointment does not appear.
- [ ] **Given** the user clicks "Nicht abrechnen" on a row, **When** `POST /institutions/:id/billing/appointments/:id/skip` resolves, **Then** the row disappears and the appointment's `billing_decision='skipped'`.
- [ ] **Given** the row offers an "Doch abrechnen"-Affordance, **When** `POST /institutions/:id/billing/appointments/:id/unskip` resolves, **Then** `billing_decision` returns to `NULL` and the row reappears in "Zu prüfen".
- [ ] **Given** the user opens an appointment row, **When** the appointment dialog closes after they linked an approval, **Then** the row disappears from "Zu prüfen" (because it now has a link → moves to "Abrechenbar").

### Tab "Rechnungen"

Unchanged — see [billing-page existing behavior](../../README.md).

## UI States

| State             | When?                                                       | What does the user see?                                                       |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Initial / Loading | tab activated, request in flight                            | spinner with "Termine werden geladen…"                                        |
| Empty (billable)  | mode=billable, no candidate rows                            | empty-state "Keine abrechnungsbereiten Termine"                              |
| Empty (to_review) | mode=to_review, list empty                                  | empty-state "Alle Termine geklärt"                                            |
| Populated         | rows present                                                | table with date, client, service-codes, duration, case, status, action area  |
| Error             | request fails                                               | snack "Termine konnten nicht geladen werden"                                  |

## Flows

```mermaid
flowchart LR
  T(Termin completed) -->|hat client+case AND keinen Approval-Link| R[Tab "Zu prüfen"]
  T -->|hat Approval-Link, nicht voll abgerechnet| B[Tab "Abrechenbar"]
  R -->|„Nicht abrechnen"| S[(billing_decision=skipped)]
  R -->|in Termin-Dialog: Bewilligung verknüpfen| B
  S -->|„Doch abrechnen"| R
  B -->|"Rechnung erstellen"| I[Invoice angelegt]
```

## Non-Goals

- No template-level `is_billable` flag (Variante C explicitly rejected — too much churn).
- No automatic approval-link creation. Linking remains a manual step inside the appointment dialog.
- No bulk skip/unskip. One row at a time. Bulk can come later if usage data demands it.
- No skip on the "Abrechenbar" tab — only the "Zu prüfen" tab has the action. Once linked, you bill it; cancellation is a property of the invoice, not the appointment.

## Edge Cases

- **Appointment with multiple client participants, only some with `case_id`** — counts as "to review" if at least one client has `case_id`.
- **Appointment skipped, then approval link added** — `billing_decision='skipped'` is reset to `NULL` automatically when an `appointment_approval_links` row is created (server-side, in `AppointmentApprovalLinksService.create`). User does not need to "unskip" manually.
- **Cancelled invoice frees the link** — link with `is_invoiced=false` reappears in "Abrechenbar". Existing behavior, unchanged.
- **Status flips back from `completed`** — appointment disappears from both lists; if it was skipped, the flag stays (so re-completing later restores the skip state).
- **Pagination** — both modes paginate independently with the existing 25/50/100 page-size options. Switching tabs resets to page 1.

## Permissions & Tenant/Institution

- **Required permission:** `EMPLOYEE_PERMISSIONS.CASES_EDIT` (matches the existing `/billing` route guard). Skip/unskip require the same permission.
- **Institution context:** required. Scope: only appointments where `appointment.institution_id = :currentInstitutionId`. (Strict mode — no NULL fallback.)
- **Tenant feature flag:** `tenant.billing.provider === 'TAGEA'` AND `institution.feature.billing === true` — gated by `billingFeatureGuard`.

## Architecture (backend)

- **New module surface:** `apps/tagea-backend/src/invoices/services/billing-appointments.service.ts` and `apps/tagea-backend/src/invoices/controllers/billing-appointments.controller.ts`. The list and skip endpoints live next to invoice creation, where the billing domain belongs.
- **Removed:** `AppointmentsService.findBillingAppointments` and the `GET /appointments/billing` endpoint. Frontend updated in same PR.
- **New column:** `appointments.billing_decision varchar(20) NULL` with `CHECK (billing_decision IS NULL OR billing_decision = 'skipped')`. Default `NULL` means "pending or implicitly resolved via approval link". Only explicit value today is `'skipped'`. Enum is open for future values (`'flagged'`, `'manual_invoice'`, …) without migration churn.
- **Auto-reset:** when `AppointmentApprovalLinksService.create` inserts a new link for an appointment that has `billing_decision='skipped'`, the flag is cleared in the same transaction.

## i18n Keys

```
billing.tabBillable                 = "Abrechenbar"
billing.tabToReview                 = "Zu prüfen"
billing.tabInvoices                 = "Rechnungen"
billing.toReview.skipAction         = "Nicht abrechnen"
billing.toReview.unskipAction       = "Doch abrechnen"
billing.toReview.empty.title        = "Alle Termine geklärt"
billing.toReview.empty.subtitle     = "Es gibt keine offenen Klient-Termine ohne Bewilligungs-Verknüpfung."
billing.billable.empty.title        = "Keine abrechnungsbereiten Termine"
billing.billable.empty.subtitle     = "Sobald Termine mit Bewilligungen verknüpft sind, erscheinen sie hier."
billing.skipConfirm.title           = "Termin nicht abrechnen?"
billing.skipConfirm.message         = "Der Termin wird aus „Zu prüfen" entfernt und nicht mehr für die Abrechnung vorgeschlagen."
billing.skipConfirm.confirm         = "Nicht abrechnen"
billing.skipConfirm.cancel          = "Abbrechen"
billing.snack.skipped               = "Termin als nicht abrechenbar markiert."
billing.snack.unskipped             = "Termin wieder zur Prüfung freigegeben."
```

## References

- **Angular implementation:** `apps/tagea-frontend/src/app/pages/billing-page/`
- **Backend endpoints:** see [contracts.md](./contracts.md)
- **Related specs:** none yet (no separate invoices spec exists; cost-carriers and approvals are configuration concepts elsewhere)
