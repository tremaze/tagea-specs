# Contracts: Public Booking

Two services power the booking flow:

- `PublicTenantGroupService` — fetches the list of institutions in a group, the bookable appointment templates per institution, and the available slots per template.
- `GuestBookingService` — submits the guest booking and (separately) exchanges a video-join token for a video provider token.

## Service: `PublicTenantGroupService`

Base URL: `${environment.apiUrl}/public/tenant`. All calls are unauthenticated.

| Method                                                        | Endpoint                                                                                            | Purpose                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `getGroupInstitutions(slug)`                                  | `GET /public/tenant/groups/:slug/institutions`                                                      | List all institutions in a public tenant group          |
| `getInstitutionTemplates(slug, tenantId, institutionId)`      | `GET /public/tenant/groups/:slug/institutions/:tenantId/:institutionId/templates`                   | List bookable appointment templates for one institution |
| `getTemplateSlots(slug, tenantId, institutionId, templateId)` | `GET /public/tenant/groups/:slug/institutions/:tenantId/:institutionId/templates/:templateId/slots` | List available booking slots for a template             |

```ts
// Source: public-tenant-group.service.ts
interface PublicGroupInstitution {
  tenantId: string;
  tenantName: string;
  institutionId: string;
  institutionName: string;
  city?: string;
  street?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
}

interface PublicGroupInfo {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  institutions: PublicGroupInstitution[];
}

interface PublicAppointmentTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  durationMinutes: number | null;
}

interface PublicAvailableSlot {
  startDatetime: string;
  endDatetime: string;
  durationMinutes: number;
  allowedSettings: string[];
  employeeId: string;
  location: string | null;
}
```

## Service: `GuestBookingService`

Base URL: `${environment.apiUrl}/public/booking`. All calls are unauthenticated. Also imported by `PublicVideoJoinComponent` for the video-token exchange.

| Method                           | Endpoint                                            | Purpose                                                       |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `createGuestBooking(dto)`        | `POST /public/booking`                              | Create a booking without an account                           |
| `getVideoToken(token, tenantId)` | `GET /public/booking/video-token/:token?tenantId=…` | Exchange a guest join token for a JITSI / LIVEKIT video token |

```ts
// Source: guest-booking.service.ts
interface GuestBookingRequest {
  groupSlug: string;
  tenantId: string;
  institutionId: string;
  templateId: string;
  employeeId: string;
  slotStart: string;
  slotEnd: string;
  setting: string;
  slotLocation?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface GuestBookingResponse {
  success: boolean;
  appointmentId: string;
  confirmationSent: boolean;
}

interface GuestVideoTokenResponse {
  provider: 'JITSI' | 'LIVEKIT';
  token: string;
  roomName: string;
  serverUrl?: string;
  wsUrl?: string;
  isModerator: boolean;
  displayName: string;
}
```

### Allowed `setting` values

Backend (`GuestBookingController.validateRequest`) enforces: `vor-ort`, `video`, `telefon`, `chat`.

### Backend guards & side-effects

- Controller: `apps/tagea-backend/src/public-api/guest-booking.controller.ts`
- Both endpoints use the `@Public()` decorator — no auth.
- `POST /public/booking` is rate-limited per client IP: max **5 bookings per hour** (in-memory map; resets on restart).
- Request validation: `tenantId`, `institutionId`, `templateId`, `employeeId` must be valid UUIDs; `slotStart`/`slotEnd` must parse as ISO dates; `firstName`/`lastName` length ≥ 2; `email` must contain `@`.

## Route contract

```ts
// apps/tagea-frontend/src/app/routes/public.routes.ts (lines 82-89)
{
  path: 'booking',
  data: { showHeader: true },
  loadComponent: () => import('../pages/booking/booking-page.component').then(m => m.BookingPageComponent),
}
```

## Tenant context

Unlike [public-register](../public-register/contracts.md) — which resolves tenant via `X-Tenant-ID` header or `?domain=` fallback — the public booking flow passes `tenantId` (and `groupSlug` / `institutionId`) explicitly in the URL path / request body. No `TenantResolutionService` involvement.
