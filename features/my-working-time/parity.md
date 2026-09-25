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

- **Status:** 🚧 Implemented (WP15, [tremaze/tagea-next-flutter#97](https://github.com/tremaze/tagea-next-flutter/pull/97)); widget tests only, E2E + smoke pending; open questions: app-wide punch FAB (Asana 1218864110278199), month-closing hint (Asana 1218864424932801)
- **Paths:**
  - `apps/tagea_frontend/lib/features/my_working_time/` (tabs Heute / Meine Zeiten / Mein Dienstplan / Abwesenheiten / Zeitkonto; forms „Zeit abschließen“, „Zeit nachtragen“, absence form), routes `apps/tagea_frontend/lib/routing/routes/my_working_time_routes.dart` (existing `myWorkingTime` shell branch); `PunchClockSync` in `MaterialApp.builder`
  - `packages/teamspace_core/lib/src/working_time/`: `TimeTrackingApi`, `MyWorkingTimeApi`, `PunchClockCubit`, `MyWorkingTimeCubit`, `AbsenceEditorCubit`, calculators (`TodaySummary`, `WeekSummary`, `TimeAccount`, `AbsenceOverview`, `WorkingTimeOverlap`, `AbsenceApprovalPolicy`)
  - `packages/ui`: `TageaTimeField`, `TageaWeekToolbar`, `TageaDayTimeline`, `TageaStatTile`, `TageaQuotaBar`
- **Integration tests:** _(tbd — mirror the E2E cases above that are in scope)_

## Known Divergences

| Topic | Angular | Flutter |
| --- | --- | --- |
| Punch entry on mobile | Header buttons hidden ≤ 700 px; global FAB carries punching | Punching on the „Heute“ tab only (clock card on every width); no global FAB yet (open question, Asana 1218864110278199); desktop header buttons not ported |
| Offline | No offline handling | Punching, back-filling and absence writes disabled with a hint (server-time stamps); no read cache, no „Stand von“ marker, no write queue |
| Notification deep link | `?tab=abwesenheiten&antrag=` ignored, opens "Heute" | Opens „Abwesenheiten“ and shows the request in a sheet; unknown id → snack bar (owner decision 2026-09-25) |
| Failed absence withdraw/delete | No feedback | Server message + „Die Liste wurde neu geladen“, list reloaded (owner decision) |
| Closing form end ≤ start / break > span | Silently ignored | Validation message |
| Overlaps | No check for tracked times; absence overlap → server snackbar | Tracked times checked against loaded bookings, absences against effective absences; server overlap message shown |
| Absence type picker | „Art der Abwesenheit“ select (default „Urlaub“) | Radio list stating per type whether it goes to approval or is effective at once; dialog title „beantragen“ / „eintragen“ by entry point |
| Zeitkonto | Client-side computation, no closed months; table | Same computation (owner decision; every month „Offen“); one card per month instead of a table (mobile width); month-closing hint open (Asana 1218864424932801) |
| Open shifts in roster | Legend + dead "Eintragen" button, never populated | Omitted (owner decision) |
| Open-session polling | — | Every 10 s while the page is visible and the app is in the foreground; re-sync on resume |
| Provider explicitly `DISABLED` | Nav entry and route stay; page renders with „Kommen“ disabled | Nav entry appears only once the probe says the person punches; page shows an empty state |
| Pull-to-refresh | — | Every tab and state |

## Port Log

| Date       | Who | What         |
| ---------- | --- | ------------ |
| 2026-09-25 | Claude (M2-Specs) | Spec created |
| 2026-09-25 | Claude (M2 parity) | Flutter ⏳ → 🚧 (widget tests only, E2E + smoke pending) after tagea-next-flutter#97 (WP15); owner decisions and deviations recorded |
