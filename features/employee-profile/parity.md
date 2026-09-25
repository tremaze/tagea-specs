# Parity: Employee Profile

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)

## Flutter

- **Status:** ⏳ Planned (M2 — full scope per owner decision 2026-09-25: Stammdaten, Bild, Passwort, Benachrichtigungen incl. Erreichbarkeit, UI-Sprache, Konto löschen, Verfügbarkeiten, Outlook)

## Known divergences (spec = target)

| Area | Spec (target, Flutter) | Angular today | Source |
| ---- | ---------------------- | ------------- | ------ |
| Password change with 2FA | Reads top-level `code`; `OTP_REQUIRED` reveals + requires the 2FA field, `INVALID_CREDENTIALS_OR_OTP` → „Das aktuelle Passwort oder der 2FA-Code ist falsch“ | **Bug:** `extractErrorBody` (`employee-profile.component.ts` ~l. 1187) looks for `error.error.message.code`; the `GlobalExceptionFilter` sends `message` as a string and `code` top-level, so both branches are dead code — 2FA users only see „Fehler beim Ändern des Passworts“ and can never enter a code | `handlePasswordChangeError` / `extractErrorBody` |
| Outlook OAuth return | `/settings/outlook-sync?success=…` / `?error=…` is handled: routes to the profile's *Kalender-Verbindungen* tab, reloads the config, shows success/error | No `/settings/outlook-sync` route — the backend redirect lands on the `**` landing redirect, query params ignored | `app.routes.ts`, `outlook-auth.controller.ts` `handleCallback` |
| UI language switch | Runtime locale change, no reload; server-translated data re-fetched | `window.location.reload()` after save | `savePersonalPreferences`, `LanguageService.setLanguageAndPersist` |
| Account deletion navigation | Local wipe + OIDC logout; no competing in-app navigation on web | Calls `router.navigate(['/'])` right after `SessionLogout.logout()`, which may race the Keycloak `end_session` redirect (#995 pattern) | `deleteAccount` |

## Open product / backend questions

- **„Verfügbarkeiten“ = Erreichbarkeit?** The spec maps the owner's item to the Erreichbarkeit windows (`/employees/me/availability-windows`). Booking availability plans (institution-scoped, `clientPortal` + `appointments.*`, hard-disabled tab in the Angular profile, managed from the calendar) are *not* specified for the profile — confirm, or decide to add them.
- **Outlook native return:** the backend only redirects to `${FRONTEND_URL}/settings/outlook-sync` (global host, fixed path, no `return_to`, no custom scheme). Native needs app links on that host or relies on the re-fetch-on-foreground fallback. Backend change (per-request return target / mobile redirect) wanted?
- **Account deletion leaves the Outlook connection** (tokens, Graph subscription, exported events) in place — should `DELETE /employees/me` run the Outlook disconnect cleanup?
- **Datenauskunft tab** (`dataSelfDisclosure`, `app-data-export-page`) is part of the Angular profile but not in the owner's M2 list and has no spec — in or out for Flutter M2?
- `date_of_birth` / `gender` editable in Angular but dropped by the backend (unchanged, see spec).

## Port Log

| Date       | Who      | What                                                                                                                                                       |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only)                                                                                                                          |
| 2026-04-21 | ltoenjes | Drift audit: corrected guard dialog, removed custom-fields service, flagged disabled availability tab, added notification/preferences/delete-account flows |
| 2026-09-25 | Claude (M2-Specs) | Flutter status ❌ non-goal → ⏳; contracts verified against backend (`/employees/me*`, `POST /auth/me/change-password`, `GET /auth/password-policy`): fixed wrong paths (`/employees/me/change-password`, `/employees/me/password-policy`, `/notification-settings`, `/personal-preferences`), documented PATCH whitelist (date_of_birth/gender dropped), DTOs, errors, delete-own-account and password-change flows |
| 2026-09-25 | Claude (M2-Specs QA) | PR #19 review fixes: error envelope verified in `GlobalExceptionFilter` (flat `message` string + top-level `code`), password-change contract corrected, Angular `extractErrorBody` 2FA bug documented, spec rewritten to target behaviour; owner decision „full scope in M2“: removed availability non-goal, added Erreichbarkeit (`/employees/me/availability-windows`), Outlook calendar connection (`/outlook-auth`, `/outlook-sync`, OAuth return for web/iOS/Android + backend gap), runtime UI-language switch (16 languages), account-deletion local wipe; fixed stale service names (`SessionAuthz`, `InstitutionContext`); divergence table + open questions added |
