# Parity: Public Register

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.ts)
- **Template:** [`public-register-page.component.html`](../../../apps/tagea-frontend/src/app/pages/public-register/public-register-page.component.html)
- **Service:** [`PublicRegistrationService`](../../../apps/tagea-frontend/src/app/services/public-registration.service.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/public_register_page.dart`
- **Key packages:** `reactive_forms` (or manual form state), `dio` for the POST
- **Integration tests:** `integration_test/public_register_test.dart`

## Known Divergences

| Topic                       | Angular                                                                         | Flutter                                                         |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Tenant resolution           | `X-Tenant-ID` header when available, else `?domain=` fallback                   | Header only (no `window.location.hostname`)                     |
| Password policy shape       | Mixed — `requireUppercase / hasUppercase` depending on endpoint (see contracts) | Normalize client-side to one enum-friendly shape                |
| Password mismatch validator | `passwordMismatch` group error                                                  | Cross-field validation via `reactive_forms` or manual           |
| Submit button loading state | `submitting()` signal + inline spinner                                          | `AsyncValue` from Riverpod + `ElevatedButton` with loading slot |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
