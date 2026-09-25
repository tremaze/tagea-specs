# Parity: Teamspace Offer Booking

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts) (route `teamspace/kalender/neu`), service `services/teamspace-appointments.service.ts`
- **E2E:** none

## Flutter

- **Status:** ⏳
- **Path:** _(to be decided — likely `apps/tagea_frontend/lib/features/teamspace/booking/`)_
- **Integration tests:** _(to be written: happy path, empty slots, slot taken → 400)_

## Known Divergences

| Topic | Angular | Flutter |
| --- | --- | --- |
| Back navigation | Only step 2 → step 1 | Every step back to the previous one (clears later choices) |
| Double submit | Confirm button stays enabled during the request | Disabled with progress |
| Slot taken (`400`) | Snack bar, stays on confirmation | Snack bar, reloads slots and returns to step 3 |
| `start_datetime` | Rebuilt from the local date + `H:mm` label | Sends the slot's `start_datetime` unchanged |
| Layout | Two columns (steps + summary) | Single column, summary below / collapsible |
| Per-category form fields | Dead template code (checkboxes, dropdown, file, hints) | Not ported (notes field only) |

## Port Log

| Date       | Who | What         |
| ---------- | --- | ------------ |
| 2026-09-25 | Claude (M2-Specs) | Spec created from Angular + backend controller/service |
