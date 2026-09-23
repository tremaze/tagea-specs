# Feature: Teamspace Employee Directory (Personenverzeichnis)

> **Status:** ✅ Angular · 🚧 Flutter
> **Owner:** Claude (WP5)
> **Last updated:** 2026-09-23

## Vision (Elevator Pitch)

Every staff member can find a colleague of the organisation (Träger) by name
or e-mail, narrow the list to one or more institutions (Einrichtungen) and
reach the person by e-mail or phone in one tap.

## User Stories

- As a **staff member** I want to **search the directory by name or e-mail**
  so that **I find a colleague without scrolling through everyone**.
- As a **staff member** I want to **filter the directory by institution** so
  that **I only see the people of the sites I work with**.
- As a **staff member** I want to **open a person and start an e-mail or a
  call** so that **I can contact them directly from the app**.

## Acceptance Criteria

- [ ] **Given** a user with `tenant.teamspace_directory.view` **When** they
  open `/teamspace/personenverzeichnis` **Then** the first page (50 people,
  sorted by last name, then first name) is shown as cards with avatar or
  initials, full name, role, visible e-mail / phone and teamspace chips;
  further pages load while scrolling until `page >= pages`.
- [ ] **Given** the list **When** the user types into the search field
  **Then** the list is re-queried server-side 300 ms after the last
  keystroke (first name, last name, e-mail); rows of the previous query are
  not shown while the new one loads, and a clear button empties the search.
- [ ] **Given** the list **When** the user opens the filter sheet, selects
  one or more institutions and taps "Anwenden" **Then** only people assigned
  to any of them are listed, the filter button shows the number of selected
  institutions, and each selected institution appears as a removable chip
  under the search field; "Filter zurücksetzen" clears the selection.
- [ ] **Given** no person matches **When** the query returns no rows
  **Then** the empty state "Keine Mitarbeitenden gefunden" is shown, with
  "Suche zurücksetzen" when a search term is set.
- [ ] **Given** a card **When** the user taps it **Then** the detail of that
  person opens (`GET /tenant/employees/:id/details`) with contact rows, the
  institution → department structure and the teamspaces; tapping the e-mail
  opens the mail app (`mailto:`), tapping a phone number the dialer
  (`tel:`). Fields the backend hides (`null`) are not shown.
- [ ] **Given** a request fails **When** the list or detail cannot be
  loaded **Then** an error state with "Erneut versuchen" is shown; a failed
  next-page request keeps the rows already loaded.

## UI States

| State             | When?                                       | What does the user see?                                                 | A11y notes                                |
| ----------------- | ------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| Initial / Loading | Nothing has finished loading for this query | Busy indicator "Lade Mitarbeitende..." — never a zero state             | Busy state announced                      |
| Empty             | Query returned no rows                      | Icon, "Keine Mitarbeitenden gefunden", hint (search vs. no data), reset | Reset button reachable                    |
| Populated         | ≥ 1 row                                     | Card list; spinner row while the next page loads                       | Card is one button labelled with the name |
| Error             | First page failed                           | Error icon, "Fehler beim Laden der Mitarbeitenden", "Erneut versuchen"  |                                           |
| Offline           | No network                                  | Same as Error (no cache)                                                |                                           |

Filter sheet: title "Filter", multi-select list of active institutions,
footer "Filter zurücksetzen" / "Anwenden". Closing without "Anwenden"
discards the draft selection.

Detail: avatar (64), full name; contact rows (e-mail, mobile, landline);
"Organisationsstruktur" (institution with nested departments); "Teamspaces"
(chips, or "Keinem Teamspace zugeordnet"); actions "E-Mail" / "Anrufen"
(mobile number preferred over landline).

## Flows

1. Open page → load institutions (filter options) and page 1 in parallel.
2. Type search → 300 ms debounce → drop rows → load page 1 for the new term.
3. Tap filter button → sheet → select institutions → "Anwenden" → drop rows
   → load page 1. "Filter zurücksetzen" → clear → reload.
4. Tap × on an institution chip → remove it → reload.
5. Scroll near the end → load page `n + 1` → append.
6. Tap card → detail → mail / call → back → list keeps query, rows and
   scroll position.

## Non-Goals

- Creating, editing, suspending or inviting people (employee management,
  `context=management`).
- Role / status filters (the endpoint supports them; the directory does not
  expose them).
- Searching by phone number (the backend does not match phone columns,
  although the Angular placeholder mentions "Telefon").
- Offline cache of the directory.

## Edge Cases

- **Hidden contact data:** without `tenant.employees.edit` the backend
  nulls `email`, `phone_mobile`, `phone_landline` (and `phone_fax`) of
  people who hid them (`*_visible = false`). Rows and actions for `null`
  values are omitted — no placeholder, no disabled button.
- **Short pages:** `excludePendingOnboarding` is applied after the page is
  cut, so a page can hold fewer than `limit` rows while more pages exist.
  "More pages" is decided by `page < pages`, never by the row count.
- **Institution filter unavailable:** `GET /tenant/institutions` answers
  403 when the tenant feature `institutions` is off. The directory then
  works without the filter (filter button hidden); no error is shown.
- **Inactive institutions** are not offered as filter options.
- **Roles:** the card shows the single distinct `institutionRoles` value
  translated, "Verschiedene Rollen" for several, or the legacy `role` when
  the list is empty.
- **Detail 403/404:** the person is outside the caller's scope or was
  deleted meanwhile → detail error state; the list is unchanged.

## Permissions & Tenant/Institution

- **Required roles:** any staff member (`UserType.EMPLOYEE`).
- **Frontend gate:** tenant permission `tenant.teamspace_directory.view` and
  tenant feature `teamspace` (route guard + navigation entry).
- **Institution context:** none — the directory is tenant-wide; the
  institution filter is a query parameter, not the `X-Institution-ID`
  header.
- **Backend access checks:** `GET /tenant/employees/directory` and
  `GET /tenant/employees/:id/details` require `tenant.employees.list`
  (the details endpoint additionally checks per-target access).
  `GET /tenant/institutions` is open to every authenticated employee
  (`scope: 'authenticated'`, `allowedUserTypes: [EMPLOYEE]`) behind the
  tenant feature `institutions` — no extra permission needed.
  401 → session handling; 403 → error state.

## Notifications (Push / In-App)

None.

## i18n Keys

Angular: `employeeDirectory.*`, `employeeDetailDialog.*`,
`employeeCard.teamspaces.*`, `employees.role*` / `employees.status*`,
`employeeFormDialog.roles.various`, `common.apply`. Flutter: namespace
`directory.*`.

## Offline Behavior

No cache. Personal data (names, e-mail addresses, phone numbers) is held in
memory for the lifetime of the page only and is never written to disk or
logs. Without network the list shows its error state with retry.

## References

- **Angular implementation:** `apps/tagea-frontend/src/app/pages/teamspace/personenverzeichnis/`
- **E2E tests:** _(none; usage specs `personenverzeichnis-page.usage.spec.ts`,
  `employee-detail-dialog.usage.spec.ts`)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
