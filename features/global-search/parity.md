# Parity: Global Search (Globale Suche)

## Angular

- **Status:** ✅ Implemented for Einrichtung mode; in teamspace mode intentionally hidden (entry points), with a Ctrl/⌘+K gap that still opens the dialog
- **Path:**
  - [`apps/tagea-frontend/src/app/components/global-search-dialog/global-search-dialog.component.ts`](../../../apps/tagea-frontend/src/app/components/global-search-dialog/global-search-dialog.component.ts) (+ `.html`, `.scss`)
  - [`apps/tagea-frontend/src/app/services/global-search.service.ts`](../../../apps/tagea-frontend/src/app/services/global-search.service.ts)
  - [`apps/tagea-frontend/src/app/models/search.model.ts`](../../../apps/tagea-frontend/src/app/models/search.model.ts)
  - `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts` (`openSearchDialog`, `hideSearch`, shortcut setup)
  - `apps/tagea-frontend/src/app/layouts/secure-main/search-shortcut.util.ts`
  - `apps/tagea-frontend/src/app/auth-session/navigation-mode.service.ts` (`shouldHideGlobalSearch`)
  - Entry points: `components/nav-rail/nav-rail.component.html`, `components/top-bar/top-bar.component.html`, `components/nav-drawer/nav-drawer.component.html`
- **Unit tests:** `global-search-dialog.component.spec.ts`, `global-search-dialog.usage.spec.ts`, `search-shortcut.util.spec.ts`, `navigation-mode.service.spec.ts` (`shouldHideGlobalSearch` truth table)
- **E2E:** `apps/tagea-frontend-e2e/src/tests/clients/anonymous-contact-redaction.spec.ts` (part b). No E2E for teamspace-mode hiding, debounce, grouping or navigation.
- **Backend:** `apps/tagea-backend/src/search/` (`search.controller.ts`, `search.service.ts`, `search.service.spec.ts`)

## Flutter

- **Status:** ⏳ Not started
- **Path:** `lib/features/...` _(in tagea-flutter repo)_
- **Integration tests:** `integration_test/global_search_test.dart` _(planned)_ — at minimum: no search entry point in teamspace mode; anonymous alias findable, real email no hit.

## Known Divergences

| Topic                        | Angular                                                     | Flutter (target)                                              |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Ctrl/⌘+K in teamspace mode   | Opens the dialog (guard ignores `hideSearch`)               | No shortcut / no search in teamspace mode                     |
| Keyboard activation of hits  | Cards focusable, Enter/Space do nothing                     | Results activatable by Enter and screen reader                |
| Error state                  | Errors shown as "Keine Ergebnisse gefunden"                 | Distinct error / offline message (pending product decision)   |
| Cache key                    | Query only (not Einrichtung)                                | Tenant + Einrichtung + query; cleared on logout/switch        |
| Mobile presentation          | Centred dialog (800 px, 90 vw / 90 vh)                      | Full-screen search page or sheet is idiomatic                 |
| Top-bar icon label           | Hard-coded `aria-label="Search"`                            | Translated "Suchen"                                           |
| `contact` result type        | Modelled + labelled, never returned                         | Tolerate unknown types; no dedicated UI needed                |

## Port Log

| Date       | Who                   | What         |
| ---------- | --------------------- | ------------ |
| 2026-09-25 | Claude (M2-Specs)     | Spec created |
