# Parity: Employee Profile

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)
- **Datenauskunft tab:** [`apps/tagea-frontend/src/app/pages/data-export/data-export-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/data-export/data-export-page.component.ts) (+ `data-export.service.ts`, `data-export.model.ts`, `data-export.presentation-config.ts`); E2E [`apps/tagea-frontend-e2e/src/tests/data-export/data-export.spec.ts`](../../../apps/tagea-frontend-e2e/src/tests/data-export/data-export.spec.ts)

## Flutter

- **Status:** 🚧 Part 1 (WP13a: Stammdaten, Bild, Passwort, Benachrichtigungen, Erreichbarkeit, Sprache — [tremaze/tagea-next-flutter#95](https://github.com/tremaze/tagea-next-flutter/pull/95)) and part 2 (WP13b: Datenauskunft, Konto löschen, Kalender-Verbindungen — [tremaze/tagea-next-flutter#98](https://github.com/tremaze/tagea-next-flutter/pull/98)) merged. Still open: native app-link declaration for the Outlook return (pending hosting, Asana 1218868351837380); `calendar_default_view` / `timezone` preferences not ported; UI language offers de/en only (Flutter translations). Scope per owner decision 2026-09-25: full profile — Stammdaten, Bild, Passwort, Benachrichtigungen incl. Erreichbarkeit, UI-Sprache, Konto löschen, Verfügbarkeiten (= Erreichbarkeit), Outlook, Datenauskunft.
- **Paths:**
  - Hub `/employee-profile` and sub-pages (`/employee-profile/data-export`, `/employee-profile/calendar-connections`, …) in `apps/tagea_frontend/lib/features/employee_profile/`, routes `apps/tagea_frontend/lib/routing/routes/employee_profile_routes.dart`; Outlook return route `/settings/outlook-sync`
  - `packages/teamspace_core/lib/src/employee_profile/` (profile, picture, password, notifications, availability, language, `DataExportApi/Cubit`, `AccountDeletionCubit`, `OutlookApi/Cubit`), sub-barrel `employee_profile_exports.dart`
  - `packages/ui`: `TageaProfileHeader`, `TageaPasswordChecklist`, `TageaWeeklySchedule`, `TageaDataSectionCard`, `TageaKeyValueList`, `TageaDataRow`; `packages/tagea_media`: `TageaFileShare`

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
| Layout | Hub with one sub-page per area (own save bar and dirty guard, UX §3/§4); availability is its own page, linked from the notification settings; „Konto löschen“ is a danger-zone card at the end of the hub | Tabs; „Konto löschen“ inside the personal-data tab | tagea-next-flutter#95 / #98 |
| Profile picture | Square centre crop (PM decision), uploaded as PNG; GIFs lose their animation | Round interactive cropper | tagea-next-flutter#95 |
| UI language | Only de / en offered (Flutter translations); server save first, then runtime switch | 16 languages, reload | tagea-next-flutter#95 |
| E-mail notification switches | Default „on“ for topics without a stored preference (as Angular); PATCH sends only the 7 documented keys | Same default | tagea-next-flutter#95 |
| Notification form pull-to-refresh | None while data is shown (would discard unsaved switches); fresh load on every open; loading / error states pullable | — | tagea-next-flutter#95 |
| Availability, several weekdays | One POST per day, every day tried, refused days named | Stops at the first error | tagea-next-flutter#95 |
| Password change success | Text says all sessions end („… du wirst auf allen Geräten abgemeldet“); immediate sign-out open (Asana 1218860139321039) | — | tagea-next-flutter#95 |
| Clearing a phone number | Sends `null` | Sends `undefined` (number cannot be removed) | tagea-next-flutter#95 |
| Datenauskunft: long lists | First 20 rows, „+50 weitere anzeigen“; values never cut off; full data in PDF / ZIP | All rows | tagea-next-flutter#98 |
| Datenauskunft: rate-limit text | Plural forms („in 1 Minute“ / „in N Minuten“) | — | tagea-next-flutter#98 |
| Outlook sign-in | System browser via `url_launcher` (external; web: same tab); only `https://login.microsoftonline.com` URLs; config reloaded on every return to the foreground | — | tagea-next-flutter#98 |
| Outlook native return (app links) | **Pending hosting:** the universal link / App Link for `/settings/outlook-sync` is not declared yet (host = `FRONTEND_URL`, deployment config; entitlements, intent filter, `.well-known` files, SPA fallback needed — Asana 1218868351837380). Until then the foreground reload covers the return; only the success / error message is missing on iOS / Android | n/a | tagea-next-flutter#98 |
| Outlook settings UI | Calendar picker as bottom sheet; „Jetzt synchronisieren“ as a button in the settings card | Dropdown; icon in the status box | tagea-next-flutter#98 |
| Account deletion on web (accepted risk) | After `DELETE /employees/me` the Keycloak end-session is a full-page redirect; if Keycloak does not redirect back for the deleted user, the local OIDC tokens stay in web storage until the next start, where the refresh fails and the session-expired flow takes over. Accepted by QA | — | tagea-next-flutter#98 |

## Open product / backend questions

- **Outlook app links** (Asana 1218868351837380): host(s) for the universal link / App Link and the `.well-known` hosting.
- **Password change:** sign out immediately after a successful change? (Asana 1218860139321039)
- **UI language after login:** take the language from the server? (Asana 1218859761823960)
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
| 2026-09-25 | Claude (M2 parity) | Parts 1 + 2 merged (tagea-next-flutter#95, #98); Flutter stays 🚧 (Outlook app links pending hosting, timezone / calendar view, languages); deviations and the accepted web-token risk recorded |
