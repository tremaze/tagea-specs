# Parity: Teamspace Offer Booking

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/termine-neu.component.ts) (route `teamspace/kalender/neu`), service `services/teamspace-appointments.service.ts`
- **E2E:** none

## Flutter

- **Status:** 🚧 Implemented (WP12, [tremaze/tagea-next-flutter#85](https://github.com/tremaze/tagea-next-flutter/pull/85)); widget tests only, E2E + smoke pending
- **Paths:**
  - `apps/tagea_frontend/lib/features/teamspace/offer_booking/`, route `apps/tagea_frontend/lib/routing/routes/offer_booking_routes.dart` (`kalender/neu` above `kalender/:id`)
  - `packages/teamspace_core`: `OfferBookingApi`, `OfferBookingCubit`, models `BookingCategory`, `AvailableSlot`, `BookingSetting`, `BookingSlotDay`, `OfferBookingConfirmation`
  - `packages/ui`: `TageaSlotGrid` / `TageaSlotDay`
- **Entry points:** calendar FAB, home quick link `book-offer`, empty state of the next-appointment card
- **Integration tests:** _(to be written: happy path, empty slots, slot taken → 400)_; widget tests cover every step, slot gone, double submit, tenant switch

## Known Divergences

| Topic | Angular | Flutter |
| --- | --- | --- |
| Back navigation | Only step 2 → step 1 | Every step back to the previous one (clears later choices) |
| Double submit | Confirm button stays enabled during the request | Disabled with progress |
| Slot taken (`400`) | Snack bar, stays on confirmation | Snack bar, reloads slots and returns to step 3 |
| `start_datetime` | Rebuilt from the local date + `H:mm` label | Sends the slot's `start_datetime` unchanged |
| Layout | Two columns (steps + summary) | Single column; each step is its own screen with the step title and the earlier choice as subtitle (Angular: subtitle on step 2 only) |
| Summary panel | Always visible next to the steps | Shown from the setting step on (below the settings, top of the confirmation); on the slot step the category is the subtitle |
| Confirmation | Inline step | Full-screen form (UX §3) with pinned button and dirty guard for the notes |
| Load errors | Snack bar + empty list | Inline error state with retry (UX §6) |
| Empty categories | Empty list + extra snack bar | Hint „Keine Buchungskategorien für diesen Teamspace verfügbar“ inside the empty state, no snack bar |
| Success | Success step + „Termin erfolgreich gebucht!“ snack bar | Success page only (the snack bar covered its buttons); extra action „Im Kalender ansehen“ |
| Entry points | Calendar „Angebot buchen“ button (mobile FAB) | Calendar FAB, home quick link `book-offer`, next-appointment empty state |
| Pull-to-refresh | — | Teamspace, category and slot lists; not on the setting step (list comes from the slot; back reloads the slots), the confirmation form or the success page |
| Per-category form fields | Dead template code (checkboxes, dropdown, file, hints) | Not ported (notes field only, PM decision) |

## Port Log

| Date       | Who | What         |
| ---------- | --- | ------------ |
| 2026-09-25 | Claude (M2-Specs) | Spec created from Angular + backend controller/service |
| 2026-09-25 | Claude (M2 parity) | Flutter ⏳ → 🚧 (widget tests only, E2E + smoke pending) after tagea-next-flutter#85 (WP12); PR deviations recorded |
