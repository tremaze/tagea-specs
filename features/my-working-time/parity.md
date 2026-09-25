# Parity: Meine Arbeitszeit (My Working Time)

## Angular

- **Status:** ✅ Implemented (route `/meine-arbeitszeit`; known gaps listed below)
- **Page:** [`apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit-page.component.ts)
- **State / data:** [`meine-arbeitszeit.service.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit.service.ts), [`meine-arbeitszeit.model.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit.model.ts), visibility rule [`meine-arbeitszeit.sichtbarkeit.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/meine-arbeitszeit.sichtbarkeit.ts), synced-absence merge [`abwesenheiten-zusammenfassen.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/abwesenheiten-zusammenfassen.ts), formatter / dates `meine-arbeitszeit.formatter.ts`, `meine-arbeitszeit.datum.ts`
- **Tabs:** [`tabs/heute-tab.component.ts`](../../../apps/tagea-frontend/src/app/pages/meine-arbeitszeit/tabs/heute-tab.component.ts), `tabs/meine-zeiten-tab.component.ts`, `tabs/mein-dienstplan-tab.component.ts`, `tabs/abwesenheiten-tab.component.ts`, `tabs/zeitkonto-tab.component.ts`, week strip `week-toolbar.component.ts`
- **Shared punch clock (FAB + dialog):** [`packages/time-tracking/src/lib/`](../../../packages/time-tracking/src/lib/) — `services/time-tracking.service.ts`, `components/time-tracking-fab.component.ts`, `components/time-tracking-action.component.ts`, `components/submit-form.component.ts`, `components/live-tracking.component.ts`; HTTP adapter [`data-sources/http-time-tracking.data-source.ts`](../../../apps/tagea-frontend/src/app/data-sources/http-time-tracking.data-source.ts); init for employees `layouts/secure-main/time-tracking-init.util.ts`
- **Absences:** [`shared/abwesenheit/abwesenheit-freigabe.ts`](../../../apps/tagea-frontend/src/app/shared/abwesenheit/abwesenheit-freigabe.ts), `shared/abwesenheit/abwesenheit-status.ts`, [`shared/dialogs/absence-dialog/absence-dialog.component.ts`](../../../apps/tagea-frontend/src/app/shared/dialogs/absence-dialog/absence-dialog.component.ts), `services/working-hours.service.ts`, `models/absence-period.model.ts`
- **Route / nav:** `app.routes.ts` (`meine-arbeitszeit`, guards `requireFeature('timeTracking')`, `requireEmployee()`), `layouts/secure-main/navigation-items.ts` (`meine-arbeitszeit`, `meine-arbeitszeit-einrichtung`, `lms-meine-arbeitszeit`)
- **Backend:** `apps/tagea-backend/src/time-tracking/` (`time-tracking.controller.ts`, `time-tracking.service.ts`, `time-tracking-provider.resolver.ts`, `time-tracking.errors.ts`, `dto/`, `entities/`), `workforce-planning/controllers/my-working-time-target.controller.ts`, `my-schedule.controller.ts`, `my-vacation-quota.controller.ts`, `working-hours/working-hours-self-service.controller.ts`, `working-hours/absences/`
- **E2E:**
  - [`apps/tagea-frontend-e2e/src/tests/arbeitszeit/meine-arbeitszeit-selfservice.spec.ts`](../../../apps/tagea-frontend-e2e/src/tests/arbeitszeit/meine-arbeitszeit-selfservice.spec.ts) — reachable without institution, FAB, Kommen/Gehen/closing form, origin tags, manual entry, week navigation across two institutions, absence in list + roster, vacation band
  - `apps/tagea-frontend-e2e/src/tests/arbeitszeit/meine-arbeitszeit-pause-abwesenheiten.spec.ts` — live pause counter, discard confirmation, closing form start/break, no-contract vs. contract absences tab, Vivendi link check with forced Vivendi
  - `apps/tagea-frontend-e2e/src/tests/arbeitszeit/stempelquelle-pro-person.spec.ts` — Tagea/Vivendi per person, tab visibility by contract, Vivendi Kommen/Gehen, broken link + retry, Vivendi bookings and manual entry in "Meine Zeiten" (also covers admin side, out of scope)
  - `apps/tagea-frontend-e2e/src/tests/arbeitszeit/arbeitszeitmodell-soll.spec.ts` — daily/monthly targets per working-time model, self-service vs. HR same target
  - `apps/tagea-frontend-e2e/src/tests/arbeitszeit/abwesenheits-freigabe.spec.ts` — request "In Prüfung", rejection reason, approver name, withdraw, sick note effective immediately (also covers the manager inbox, out of scope)
  - `apps/tagea-frontend-e2e/src/tests/arbeitszeit/fremdverwaltete-abwesenheit.spec.ts` — synced absence tagged and read-only
  - Helpers: `apps/tagea-frontend-e2e/src/utils/flows/meine-arbeitszeit.ts`, `utils/meine-arbeitszeit-seed.utils.ts`, `utils/stempelquelle-seed.utils.ts`

## Flutter

- **Status:** ⏳ Not started
- **Path:** _(tbd in tagea-flutter repo, e.g. `lib/features/teamspace/my_working_time/`)_
- **Integration tests:** _(tbd — mirror the E2E cases above that are in scope)_

## Known Divergences

| Topic | Angular | Flutter (target) |
| --- | --- | --- |
| Punch entry on mobile | Header buttons hidden ≤ 700 px; global FAB carries punching | Same idea: one app-wide punch control; page buttons may stay visible |
| Offline | No offline handling | Punching disabled offline (server-time stamps); stale read cache optional; no write queue |
| Notification deep link | `?tab=abwesenheiten&antrag=` ignored, opens "Heute" | Should open "Abwesenheiten" (pending product decision) |
| Failed absence withdraw/delete | No feedback | Show server message |
| Closing form end ≤ start | Silently ignored | Show validation message |
| Zeitkonto | Client-side computation, no closed months | Same contract; follow product decision (see spec Open Questions) |
| Open shifts in roster | Legend + dead "Eintragen" button, never populated | Omit until defined |

## Port Log

| Date       | Who | What         |
| ---------- | --- | ------------ |
| 2026-09-25 | Claude (M2-Specs) | Spec created |
