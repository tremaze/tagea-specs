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

- [ ] **Given** the user opens `/booking`, **When** the page loads, **Then** a hardcoded service-category picker renders and `PublicTenantGroupService.getGroupInstitutions(slug)` resolves the list of institutions for the configured group.
- [ ] **Given** a category + location filter are applied, **When** the user picks an institution, **Then** `PublicTenantGroupService.getInstitutionTemplates(...)` resolves bookable appointment templates.
- [ ] **Given** a template is selected, **When** `PublicTenantGroupService.getTemplateSlots(...)` returns slots, **Then** a day-grouped slot picker renders.
- [ ] **Given** a slot is picked + setting chosen + contact form filled, **When** `GuestBookingService.createGuestBooking(...)` fires, **Then** the booking is persisted and a confirmation screen renders.
- [ ] **Given** `LocationBottomSheetComponent` is invoked on mobile, **When** the sheet opens, **Then** location choice is captured.

## UI States

| State           | When?            | Rendering                                   |
| --------------- | ---------------- | ------------------------------------------- |
| Category picker | Initial          | Hardcoded service-category list             |
| Location search | Category chosen  | Location input + filter chips + results     |
| Institution     | Center picked    | Details, settings, template list            |
| Slot picker     | Template chosen  | Day-grouped slot grid                       |
| Form            | Slot chosen      | Guest contact form (first/last/email/phone) |
| Submitting      | Submit in-flight | Spinner + disabled form                     |
| Success         | Booking saved    | Confirmation screen                         |
| Error           | Any failure      | Error text + retry                          |

## Non-Goals

- **Authenticated-client booking** — that's [client-termine](../client-termine/spec.md) (requires login).
- **Rescheduling** — not implemented for guest flow.

## Edge Cases

- **Slot no longer available by submit time** — backend rejects; UI surfaces the error and the user can pick another slot.
- **Rate-limited** — backend caps guest bookings at 5 per IP per hour; subsequent attempts surface a German error message in the error banner.

## Permissions & Tenant/Institution

- **Required roles:** none (public pre-auth). Controller uses the `@Public()` decorator.
- **Tenant context:** passed explicitly in the request — `groupSlug` in URL paths, `tenantId` / `institutionId` in the booking body. No `X-Tenant-ID` header, no `TenantResolutionService`.
- **`showHeader: true`** is set in route `data` — the public layout renders with a visible header.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/booking/booking-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/booking/booking-page.component.ts)
- **Location sheet:** [`location-bottom-sheet.component.ts`](../../../apps/tagea-frontend/src/app/pages/booking/location-bottom-sheet.component.ts)
- **Services:** `PublicTenantGroupService` (institutions/templates/slots) and `GuestBookingService` (booking + video token)
- **Backend controller:** [`apps/tagea-backend/src/public-api/guest-booking.controller.ts`](../../../apps/tagea-backend/src/public-api/guest-booking.controller.ts)
- **Related:** [public-register](../public-register/spec.md)
- **Backend endpoints:** see [contracts.md](./contracts.md)
