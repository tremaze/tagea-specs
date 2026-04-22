# Parity: Employee Availability

## Angular

- **Status:** 🚧 Existing institution-scoped overlay ships; new self-scoped check endpoint pending. Spec drafted 2026-04-22.
- **Paths:**
  - Service: `apps/tagea-frontend/src/app/services/working-hours.service.ts`
  - Dialog consumer: `apps/tagea-frontend/src/app/components/appointment-dialog-v2/appointment-dialog-v2.component.ts`
  - Institution calendar consumer: `apps/tagea-frontend/src/app/pages/calendar-page/…`
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned (consumed indirectly by teamspace-calendar port)
- **Suggested path:** `lib/features/shared/availability/availability_repository.dart`
- **Integration tests:** covered through dialog conflict-warning tests in the teamspace-calendar integration suite.

## Known Divergences

| Topic | Angular | Flutter |
| ----- | ------- | ------- |
| Caching | In-memory per-session only | Same — no persistent cache (staleness risk) |
| Redaction | Client trusts `redacted: true` and swaps labels | Same |

## Port Log

| Date       | Who | What                                                                                                          |
| ---------- | --- | ------------------------------------------------------------------------------------------------------------- |
| 2026-04-22 | sb  | Spec created. Motivated by teamspace-calendar institution-independence work (split out as sibling feature per user request because the check applies in both institution mode and teamspace mode). |
