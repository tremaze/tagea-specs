# Parity: Teamspace-Booking v2

## Angular

- **Status:** ⏳ Spec drafted — awaiting decision approval
- **Path (new):** `apps/tagea-frontend/src/app/pages/teamspace/booking-config/` (Master-Detail-Shell) + `apps/tagea-frontend/src/app/shared/booking-config/` (Wiederverwendbare Sub-Komponenten)
- **Path (deprecated, wird gelöscht):**
  - `apps/tagea-frontend/src/app/admin/components/teamspace-booking-categories-admin/`
  - `apps/tagea-frontend/src/app/pages/teamspace/booking-config-prototype/`
  - `apps/tagea-frontend/src/app/admin/services/teamspace-booking-category-state.service.ts`
- **Backend (new):** `apps/tagea-backend/src/teamspace-booking/`
- **Backend (deprecated, wird gelöscht):**
  - `apps/tagea-backend/src/teamspace-availability/` (vollständig)
  - Teile von `apps/tagea-backend/src/teamspaces/services/teamspace-booking-categories.service.ts` (umziehen)
  - ~700 LoC aus `apps/tagea-backend/src/appointments/services/appointments.service.ts:7416–8120` (Modul-Auszug pro D8)
- **E2E:** zu erstellen → `apps/tagea-frontend-e2e/src/tests/teamspace-booking/` mit BOOKING_COVERAGE_PLAN.md (5 Wellen, ~20–25 Tests)

## Flutter

- **Status:** ⏳ Read-Path only (Slot-Picker im Klientenportal/Public-Stack)
- **Path:** `lib/features/booking/` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/booking_slot_picker_test.dart`

**Wichtig:** Der **Konfigurations-Pfad (Admin-UI)** ist explizit **kein Flutter-Ziel** — Booking-Konfiguration ist Web-only (siehe `spec.md` → Non-Goals). Flutter braucht nur das Slot-Picker- + Buchen-DTO-Contract (`AvailableSlotDto`, `CreateBookingDto`, `BookingCreatedDto` — siehe `contracts.md`).

## Known Divergences

- **Konfigurations-UI:** Angular-only. Flutter zeigt sie gar nicht.
- **Auto-Save:** Angular-only (Web-Pattern). Flutter konsumiert nur fertige Daten via Read-API — kein Edit-Pfad nötig.
- **Public-Booking-Flow** (Tenant-Homepage `/welcome`): Läuft auf **separatem Stack** (`employee_availability_windows`), **nicht** in diesem Spec. Capacitor-App nutzt diesen Public-Stack — Hard Cut auf Teamspace-Side hat dort keine direkten Auswirkungen, solange Wire-Format stabil bleibt.
- **Round-Robin-Algorithmus:** Backend-only, frontend-agnostisch. Frontend (Web + Flutter) zeigt ausschließlich `providerEmployeeId` aus der Response.

## Port Log

| Date | Who | What |
| --- | --- | --- |
| 2026-05-22 | baumgart + Claude | Spec, contracts und parity initial draft. Decisions D1–D9 entschieden — alle Defaults bestätigt, außer **D7** (existierende `AbsencePeriod` + `PublicHoliday` integrieren statt neue Blackout-Tabelle) und **D9** (Hard Cut ohne Legacy-Wrapper, da Feature nicht in Produktion) |
