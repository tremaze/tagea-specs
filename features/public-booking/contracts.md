# Contracts: Public Booking

## Service: `GuestBookingService`

Imported by both `BookingPageComponent` and `PublicVideoJoinComponent`. Methods for listing public categories, fetching available slots, and submitting a guest booking.

Exact signatures live in the service file; verify during any port.

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/public.routes.ts (lines 82-89)
{
  path: 'booking',
  data: { showHeader: true },
  loadComponent: () => import('../pages/booking/booking-page.component').then(m => m.BookingPageComponent),
}
```

## Tenant resolution

Same `X-Tenant-ID` header / `?domain=` fallback pattern as [public-register](../public-register/contracts.md).
