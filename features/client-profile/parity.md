# Parity: Client Profile

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.ts)
- **Template:** [`client-profile.component.html`](../../../apps/tagea-frontend/src/app/pages/client-profile/client-profile.component.html)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/client_portal/profile/client_profile_page.dart`
- **Sub-widgets:**
  - `profile_card.dart`
  - `password_change_form.dart`
  - `custom_fields_section.dart`
  - `managed_clients_section.dart`
- **Unsaved-changes handling:** `PopScope` / `WillPopScope` with a confirmation dialog on dirty form state.
- **Integration tests:** `integration_test/client_profile_test.dart`

## Known Divergences

| Topic                     | Angular                            | Flutter                                                                        |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------ |
| Tab layout                | `MatTabs` desktop / stacked mobile | `TabBar` + `TabBarView` desktop / `ExpansionPanel` or vertical list mobile     |
| Unsaved changes guard     | Router `CanDeactivate` guard       | `PopScope` with confirmation dialog                                            |
| Custom fields renderer    | Dynamic Angular component renders  | Dynamic Flutter widget tree (consider `reactive_forms` + per-type builder map) |
| Password policy source    | Server-fetched                     | Same — fetch once per session, cache in state                                  |
| Managed-client navigation | Switches client context            | Same — navigate to target client's dashboard, propagate context in state       |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
