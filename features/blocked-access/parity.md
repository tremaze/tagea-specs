# Parity: Blocked Access

## Angular

- **Status:** ✅ Implemented (dual-mode)
- **Path:** [`apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts`](../../../apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** ⏳ Planned
- **Suggested path:** `lib/features/auth/blocked_access_page.dart`
- **Mode enum:** `BlockedAccessMode { emailNotVerified, noInstitution }`
- **Integration tests:** `integration_test/blocked_access_test.dart`

## Known Divergences

| Topic               | Angular                                   | Flutter                         |
| ------------------- | ----------------------------------------- | ------------------------------- |
| Mode discrimination | Query param `?reason=email-not-verified`  | Route parameter + enum          |
| Localization        | Hardcoded German strings                  | Proper `intl` keys              |
| Background          | CSS gradient                              | `LinearGradient` in `Container` |
| Teamspace route     | Angular `Router.navigate(['/teamspace'])` | `GoRouter.go('/teamspace')`     |

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-20 | ltoenjes | Spec created |
