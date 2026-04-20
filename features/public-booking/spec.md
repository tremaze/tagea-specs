# Feature: Public Booking

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Public booking page at `/booking` (no auth required). Allows guests or clients to book an appointment slot without needing a Keycloak account — typically for first-contact consultations.

## User Stories

- As a **prospective client** I want to book a consultation without creating an account, so that the barrier to first contact is low.
- As a **prospective client** I want category + slot selection + contact form, so that the booking is complete.

## Acceptance Criteria

- [ ] **Given** the user opens `/booking`, **When** `GuestBookingService` (or similar — verify) resolves available categories, **Then** a category picker renders.
- [ ] **Given** a category is selected, **When** available slots resolve, **Then** slot picker renders.
- [ ] **Given** a slot is picked + contact form is filled, **When** Submit fires, **Then** the booking is persisted and a confirmation screen renders.
- [ ] **Given** `LocationBottomSheetComponent` is invoked (e.g. multiple locations offered), **When** the sheet opens, **Then** location choice is captured.

## UI States

| State           | When?            | Rendering                     |
| --------------- | ---------------- | ----------------------------- |
| Category picker | Initial          | List of bookable categories   |
| Slot picker     | Category chosen  | Available-slots calendar/list |
| Form            | Slot chosen      | Contact details form          |
| Submitting      | Submit in-flight | Spinner + disabled form       |
| Success         | Booking saved    | Confirmation screen           |
| Error           | Any failure      | Error text + retry            |

## Non-Goals

- **Authenticated-client booking** — that's [client-termine](../client-termine/spec.md) (requires login).
- **Rescheduling** — not implemented for guest flow.

## Edge Cases

- **Slot no longer available by submit time** — backend rejects; UI returns to slot-picker with refreshed availability.
- **Tenant-resolution from domain** — applies the same `TenantResolutionService` header/query pattern as [public-register](../public-register/contracts.md).

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth).
- **Tenant context:** resolved from domain.
- **`showHeader: true`** is set in route `data` — the public layout renders with a visible header.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/booking/booking-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/booking/booking-page.component.ts)
- **Location sheet:** [`location-bottom-sheet.component.ts`](../../../apps/tagea-frontend/src/app/pages/booking/location-bottom-sheet.component.ts)
- **Service:** `GuestBookingService` (verify exact name — see component imports)
- **Related:** [public-register](../public-register/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)
