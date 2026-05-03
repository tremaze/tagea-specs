# Parity: Tenant Selection (3 Eingangsbühnen)

## Angular

### Onboarding Wizard (App-only)

- **Status:** ✅ Implemented
- **Path:** `apps/tagea-frontend/src/app/pages/onboarding/onboarding-wizard.component.ts`
- **Sub-components:** `apps/tagea-frontend/src/app/pages/onboarding/wizard/{flow-hero,confirm-stage,account-stage,verify-stage,done-stage}.component.ts`
- **Service:** `apps/tagea-frontend/src/app/services/public-cloud-group.service.ts` (search) + `apps/tagea-frontend/src/app/services/public-registration.service.ts` (account creation)
- **Route:** `/onboarding` (in `apps/tagea-frontend/src/app/routes/public.routes.ts`) — guarded by `nativeOnlyGuard`
- **E2E:** ⏳ noch keine Coverage. Vor Merge mindestens:
  - `tests/onboarding/wizard-select-confirm.spec.ts` — Träger-Suche, Auswahl, Confirm-Stage
  - `tests/onboarding/wizard-account-verify.spec.ts` — Account-Form, Resend-Verification
  - `tests/onboarding/wizard-done-login.spec.ts` — Done-CTAs starten Keycloak

### Cloud Discovery (Web-only)

- **Status:** ✅ Implemented
- **Path:** `apps/tagea-frontend/src/app/pages/cloud-discovery/cloud-discovery.component.ts`
- **Service:** `apps/tagea-frontend/src/app/services/public-cloud-group.service.ts`
- **Route:** `/select-tenant` (in `apps/tagea-frontend/src/app/routes/public.routes.ts`) — guarded by `webOnlyGuard`
- **E2E:** ⏳ noch keine Coverage. Vor Merge mindestens:
  - `tests/cloud-discovery/discovery-default.spec.ts` — Hero, Tenant-Grid, Total-Hint
  - `tests/cloud-discovery/discovery-search.spec.ts` — Debounce, Empty-State, Error-State
  - `tests/cloud-discovery/discovery-pick.spec.ts` — Pick navigates to /welcome → TenantHomepage

### Tenant Homepage (Web)

- **Status:** ✅ Implemented (Themen + BookingFlow live mit echten Backend-Daten)
- **Path:** `apps/tagea-frontend/src/app/pages/tenant-homepage/tenant-homepage.component.ts`
- **Sub-component:** `apps/tagea-frontend/src/app/pages/tenant-homepage/booking-flow/booking-flow.component.ts`
- **Service:** `apps/tagea-frontend/src/app/services/public-tenant-group.service.ts` (themes/slots) + `apps/tagea-frontend/src/app/services/guest-booking.service.ts` (submit)
- **Route:** `/welcome` via `LandingPageComponent` dispatcher (in `apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts`)
- **E2E:** ⏳ noch keine Coverage. Vor Merge mindestens:
  - `tests/tenant-homepage/homepage-themes.spec.ts` — Themen laden, Loading/Empty/Error-States
  - `tests/tenant-homepage/booking-flow-happy-path.spec.ts` — Theme → Slot → Type → Notes → Submit → Done
  - `tests/tenant-homepage/booking-flow-allowed-settings.spec.ts` — Type-Step filtert per `slot.allowedSettings`
  - `tests/tenant-homepage/booking-flow-account-upsell.spec.ts` — Done-Upsell triggert Keycloak

### State integration

- **Path:** `apps/tagea-frontend/src/app/core/tenant-resolution.service.ts`, `apps/tagea-frontend/src/app/core/cloud-tenant-storage.service.ts`
- **Routing-Guards:** `apps/tagea-frontend/src/app/guards/{native-only,web-only,root-redirect,redirect-if-authenticated}.guard.ts`

## Flutter

- **Status:** ⏳ Planned
- **Onboarding Wizard Path:** `lib/features/onboarding/...` (in tagea-flutter repo)
- **Cloud Discovery / Tenant Homepage:** **NOT** ported — these are web-only features. Flutter app is a single-tenant or cloud-picker native app, not a web-discovery tool.
- **Integration tests:** `integration_test/onboarding_test.dart`

## Known Divergences

- **Web vs. App entry-points:** Web uses Doctolib-Logik (low-friction guest booking, account optional). App-First-Run uses 5-Stage-Wizard with mandatory account. Beide Welten teilen sich `getTenantThemes` / `getTenantThemeSlots` für die Booking-Flow-Daten, aber die Submit-Pfade unterscheiden sich (guest-booking vs. authenticated-booking).
- **Persistenz-Backend:** Web = `localStorage`, Native (Capacitor) = `Preferences`, Flutter = `shared_preferences`. Schlüssel-Konvention bleibt einheitlich: `tagea.cloudTenant.selectedId`.
- **Custom-Domain auf Web:** Tenant-Homepage rendert via Custom-Domain (z. B. `caritas-hamm.de`), aber der BookingFlow funktioniert dort heute nur eingeschränkt — `cloudGroupSlug` ist null → Booking-Endpoints brauchen Slug. **TODO:** Backend-Erweiterung oder Slug auf Custom-Domain-Tenants exposieren. Bis dahin: BookingFlow rendert nicht (Template-Guard `@if (cloudGroupSlug())`).
- **`AppointmentRegistrationFormComponent` und `EmployeeRegistrationFormComponent` entfernt** (Step 5 cleanup). Inline-Registration im Web entfällt vollständig — alle Account-CTAs laufen über Keycloak.
- **DEV Cloud-Group Hack** (`?cloudGroup=` URL param + localStorage) ist seit Step 5 mit `if (!environment.production)` gegated. Production-Builds können nicht in den Cloud-Picker-Modus geflippt werden.

## Port Log

| Date       | Who | What                                                                                                              |
| ---------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-04-30 | sb  | Spec created — Variant B (Search-first) handoff dokumentiert; Phase-1-Scope abgegrenzt                            |
| 2026-05-03 | sb  | Architektur-Pivot: 3 Eingangsbühnen (Wizard / Cloud Discovery / Tenant Homepage). Spec + Contracts + Parity neu.  |
