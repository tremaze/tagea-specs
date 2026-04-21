# Parity: No Tenant

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/no-tenant/no-tenant.component.ts`](../../../apps/tagea-frontend/src/app/pages/no-tenant/no-tenant.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/no_tenant_page.dart`
- **Integration tests:** `integration_test/no_tenant_test.dart`

## Known Divergences

| Topic        | Angular                               | Flutter                                                |
| ------------ | ------------------------------------- | ------------------------------------------------------ |
| Localization | Hardcoded German strings in template  | Introduce proper `intl` / `flutter_localizations` keys |
| Email source | `UnifiedAuthService.userEmail` signal | `AuthCubit` state field exposing the email from the JWT claim |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
