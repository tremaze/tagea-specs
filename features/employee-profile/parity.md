# Parity: Employee Profile

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Datenauskunft tab:** [`apps/tagea-frontend/src/app/pages/data-export/data-export-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/data-export/data-export-page.component.ts) (+ `data-export.service.ts`, `data-export.model.ts`, `data-export.presentation-config.ts`); E2E [`apps/tagea-frontend-e2e/src/tests/data-export/data-export.spec.ts`](../../../apps/tagea-frontend-e2e/src/tests/data-export/data-export.spec.ts)

## Flutter

- **Status:** 🚧 In progress — part 1 (rest of the profile) in [tremaze/tagea-next-flutter#95](https://github.com/tremaze/tagea-next-flutter/pull/95); part 2 (WP13b: Datenauskunft, Outlook, account deletion) specified here. Scope per owner decision 2026-09-25: full profile — Stammdaten, Bild, Passwort, Benachrichtigungen incl. Erreichbarkeit, UI-Sprache, Konto löschen, Verfügbarkeiten (= Erreichbarkeit), Outlook, Datenauskunft.

## Known divergences (spec = target)

| Area | Spec (target, Flutter) | Angular today | Source |
| ---- | ---------------------- | ------------- | ------ |
| Password change with 2FA | Reads top-level `code`; `OTP_REQUIRED` reveals + requires the 2FA field, `INVALID_CREDENTIALS_OR_OTP` → „Das aktuelle Passwort oder der 2FA-Code ist falsch“ | **Bug:** `extractErrorBody` (`employee-profile.component.ts` ~l. 1187) looks for `error.error.message.code`; the `GlobalExceptionFilter` sends `message` as a string and `code` top-level, so both branches are dead code — 2FA users only see „Fehler beim Ändern des Passworts“ and can never enter a code | `handlePasswordChangeError` / `extractErrorBody` |
| Outlook OAuth return | `/settings/outlook-sync?success=…` / `?error=…` is handled: routes to the profile's *Kalender-Verbindungen* tab, reloads the config, shows success/error | No `/settings/outlook-sync` route — the backend redirect lands on the `**` landing redirect, query params ignored | `app.routes.ts`, `outlook-auth.controller.ts` `handleCallback` |
| UI language switch | Runtime locale change, no reload; server-translated data re-fetched | `window.location.reload()` after save | `savePersonalPreferences`, `LanguageService.setLanguageAndPersist` |
| Datenauskunft: collector failure | Document-level `categoryUnavailable` notice rendered as a card „Diese Kategorie konnte nicht geladen werden.“ | Only category-level notices are rendered; a failed collector's category silently disappears | `DataExportPageComponent` template |
| Datenauskunft: reload | Loaded once per page visit; explicit retry / pull-to-refresh only (shared 20/h rate-limit budget) | Re-fetches on every tab visit (`matTabContent` recreates the component) | `employee-profile.component.html`, `DataExportPageComponent.ngOnInit` |
| Datenauskunft: download errors | „Datei konnte nicht heruntergeladen werden.“ on every platform; 429 → rate-limit text with wait time | Native: same text; web: failure is silent (no `catch` in `downloadPdf` / `downloadArchive`); no 429 text anywhere | `DataExportPageComponent`, `NativeFileDownloadService` |
| Datenauskunft: print | No „Drucken“ button; print via PDF (open question 1) | „Drucken“ → `window.print()` | `DataExportPageComponent.print` |
| Datenauskunft: file name | From `Content-Disposition` (`datenauskunft-employee-self-<date>.pdf`) | Fixed `datenauskunft.pdf` / `datenauskunft.zip` | `DataExportService` |
| Outlook OAuth return on native | App link / universal link on the `FRONTEND_URL` host, path `/settings/outlook-sync`, plus foreground re-fetch | n/a (Capacitor app: no handling, user returns manually) | owner decision 2026-09-25 |
| Personal data: `date_of_birth` / `gender` | Not shown, not sent (until the backend accepts them) | Editable and sent, silently dropped by the backend | `employee-profile.component.html` personal-data form |
| Account deletion navigation | Local wipe + OIDC logout; no competing in-app navigation on web | Calls `router.navigate(['/'])` right after `SessionLogout.logout()`, which may race the Keycloak `end_session` redirect (#995 pattern) | `deleteAccount` |

## Open product / backend questions

- **Datenauskunft** (WP13b, Asana task in „Entscheidungen offen“): print button in Flutter; employee banner text vs. ZIP without documents; raw UUIDs in list cards; missing collectors (Erreichbarkeit, Outlook, notifications) — details and defaults in [spec.md → Open Questions](./spec.md#open-questions).

**Resolved (owner decisions 2026-09-25):**

- „Verfügbarkeiten“ = Erreichbarkeit windows (`/employees/me/availability-windows`), not the booking availability plans; no booking-plan tab in Flutter.
- `date_of_birth` / `gender`: Flutter leaves both fields out until the backend accepts them (backend gap, Asana 1218853627782544).
- Datenauskunft tab is in scope (WP13b).
- Outlook native return uses app links on the `FRONTEND_URL` host (owner decision 2026-09-25) — no backend return-URL change.

**Known backend / Angular gaps (Asana [1218853627782544](https://app.asana.com/0/0/1218853627782544)):**

- Account deletion (`DELETE /employees/me` → `removeFromTenant`) leaves the Outlook connection (tokens, Graph subscription, exported events) in place — should run the disconnect cleanup.
- Angular has no `/settings/outlook-sync` route; the OAuth return lands on the landing redirect and the result is lost.
- `PATCH /employees/me` drops `date_of_birth` / `gender` (Angular offers them anyway; Flutter leaves them out).

## Port Log

| Date       | Who      | What                                                                                                                                                       |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only)                                                                                                                          |
| 2026-04-21 | ltoenjes | Drift audit: corrected guard dialog, removed custom-fields service, flagged disabled availability tab, added notification/preferences/delete-account flows |
| 2026-09-25 | Claude (M2-Specs) | Flutter status ❌ non-goal → ⏳; contracts verified against backend (`/employees/me*`, `POST /auth/me/change-password`, `GET /auth/password-policy`): fixed wrong paths (`/employees/me/change-password`, `/employees/me/password-policy`, `/notification-settings`, `/personal-preferences`), documented PATCH whitelist (date_of_birth/gender dropped), DTOs, errors, delete-own-account and password-change flows |
| 2026-09-25 | Claude (M2-Specs QA) | PR #19 review fixes: error envelope verified in `GlobalExceptionFilter` (flat `message` string + top-level `code`), password-change contract corrected, Angular `extractErrorBody` 2FA bug documented, spec rewritten to target behaviour; owner decision „full scope in M2“: removed availability non-goal, added Erreichbarkeit (`/employees/me/availability-windows`), Outlook calendar connection (`/outlook-auth`, `/outlook-sync`, OAuth return for web/iOS/Android + backend gap), runtime UI-language switch (16 languages), account-deletion local wipe; fixed stale service names (`SessionAuthz`, `InstitutionContext`); divergence table + open questions added |
| 2026-09-25 | Claude (WP13b) | „Mein Profil – Teil 2“: Datenauskunft tab specified (`/employees/me/data-export`, `/pdf`, `/archive`; `DataExportDocument`; employee collectors; rate limit, feature gate, audit; states/errors; platform downloads); Outlook native return via app links on the `FRONTEND_URL` host (owner decision) + result messages; account deletion re-verified (error codes, lost response); Outlook-on-deletion and missing Angular route recorded as gaps (Asana 1218853627782544); new divergences + open questions |
| 2026-09-25 | Claude (WP13b) | Owner decisions recorded: „Verfügbarkeiten“ = Erreichbarkeit (no booking plans); `date_of_birth` / `gender` left out in Flutter until backend support (Asana 1218853627782544). Flutter status ⏳ → 🚧 (part 1: tagea-next-flutter#95) |
