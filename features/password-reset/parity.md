# Parity: Password Reset

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/password-setup/public-password-setup.component.ts`](../../../apps/tagea-frontend/src/app/pages/password-setup/public-password-setup.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/password_reset_page.dart`
- **Key packages:** `reactive_forms` (or manual), `url_launcher` (for `redirectUrl` if external)
- **Integration tests:** `integration_test/password_reset_test.dart`

## Known Divergences

| Topic                 | Angular                                                 | Flutter                                                                                         |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Deep link delivery    | Browser URL path params                                 | OS deep-link → GoRouter path params                                                             |
| Strength indicator    | `MatProgressBar` with `warn`/`accent`/`primary` palette | `LinearProgressIndicator` with Material 3 error/warning/primary colors                          |
| Requirements grid     | 2-column CSS grid (desktop), 1-col on mobile            | `Wrap` or responsive `GridView`                                                                 |
| Post-success redirect | `window.location.href = redirectUrl`                    | `launchUrl` for external, `GoRouter.go` for internal — inspect the URL first                    |
| Error → state flip    | Parses error message string                             | Prefer dedicated error codes in the response; fall back to string match if backend can't change |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
