# Parity: Blocked Access

## Angular

- **Status:** ✅ Implemented (dual-mode)
- **Path:** [`apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts`](../../../apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts)
- **E2E:** _(to be identified)_

## Flutter

- **Status:** 🚧 In progress — 403 reasons ported
- **Path:** `apps/tagea_frontend/lib/home/blocked_access_view.dart` (rendered by
  the home shell while `SessionAccessCubit` is `denied`), copy in
  `blocked_access_copy.dart`, page layout `TageaNoticePage` (`packages/ui`)
- **Reason model:** `AccountBlockReason` (`packages/teamspace_core`)
- **Tests:** `apps/tagea_frontend/test/home/blocked_access_view_test.dart`,
  `packages/teamspace_core/test/src/access/`

## Known Divergences

| Topic               | Angular                                         | Flutter                                                    |
| ------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Surface             | Route `/blocked-access?reason=…`                | Home shell body while access is `denied`                   |
| 401 (`not-provisioned`) | Blocked page                                | Transient error for now (decision 2026-09-24)              |
| Reasons in scope    | All (incl. no-institution, rejected, …)         | 403 `ACCOUNT_BLOCKED` reasons, Vivendi, `unknown`          |
| Refresh             | One refresh on open, redirect if usable         | "Erneut versuchen" + pull-to-refresh reload `/session/v2`  |
| Pending client      | `/join` awaiting flow                           | Pending-approval page                                      |
| Rate-limit message  | Server `message`                                | Localised text                                             |
| Layout              | Card on a gradient background                   | Plain page in the app theme, brand-coloured icon badge     |

## Port Log

| Date       | Who      | What                                        |
| ---------- | -------- | ------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created                                |
| 2026-09-24 | Claude   | Spec updated to current Angular; 403 reasons ported to Flutter |
