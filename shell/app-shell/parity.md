# Parity: App Shell

## Angular

- **Status:** ✅ Implemented
- **Path:**
  - `apps/tagea-frontend/src/app/layouts/secure-shell/secure-shell.component.ts`
  - `apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts`
  - `apps/tagea-frontend/src/app/layouts/public-main/public-main.component.ts`
  - `apps/tagea-frontend/src/app/app.routes.ts`
  - `packages/chat/src/lib/components/crypto/crypto-bootstrap-orchestrator.ts`
- **E2E:** No shell-level E2E tests. The shell is exercised indirectly by every authenticated scenario under `apps/tagea-frontend-e2e/src/tests/`.

## Flutter

- **Status:** 🚧 In progress (v0.1-alpha 2-tier subset)
- **Path:**
  - `apps/tagea_frontend/lib/app.dart` — root `TageaApp` widget + provider tree
  - `apps/tagea_frontend/lib/app/auth_bridges.dart` — auth-driven side-effect hosts (profile-cache owner, brand-theme bridge, push lifecycle)
  - `apps/tagea_frontend/lib/app/router_host.dart` — owns the `GoRouter` lifecycle + `MaterialApp.router`
  - `apps/tagea_frontend/lib/auth/login_page.dart` + `error_page.dart` — pre-shell screens
  - `apps/tagea_frontend/lib/home/home_shell.dart` — secure-main equivalent (nav chrome)
- **Integration tests:** `integration_test/shell/` — cover the three-tier nesting by verifying that `/awaiting-approval` and `/chat/room/:id` render without nav chrome while chat/push/presence still initialize. _(planned for v0.2)_
- **v0.1 covers:** 2 of the 3 layouts — pre-shell (login / error) and secure-main (full nav chrome). Auth-driven hosts initialise chat profile cache + brand theme + push.
- **v0.1 deliberately omits:** the secure-shell vs. secure-main separation (no fullscreen chat-room layout), awaiting-approval flow, public-shell distinction, crypto bootstrap dialog host (lives inside matrix_chat for now).

## Known Divergences

- **Router architecture.** Angular uses nested `<router-outlet>` components driven by declarative `Routes`. Flutter should use `go_router` with `ShellRoute` (outer: secure-shell, providing chat/push/presence + crypto dialog host) and an inner `ShellRoute` or `StatefulShellRoute` for the nav chrome. The `awaiting-approval` and chat-room routes attach to the outer shell as siblings of the inner nav shell.
- **Crypto bootstrap dialog host.** Angular renders `<tagea-crypto-bootstrap-orchestrator />` as a sibling of the outlet — an invisible component whose template is empty but which opens `MatDialog`s reactively. Flutter equivalent: a stateless `CryptoBootstrapListener` widget mounted in the outer shell that watches a `cryptoBootstrapStateProvider` and calls `showDialog(...)` from a navigator-key captured at shell mount.
- **App-state listener.** Angular branches on `PlatformService.isNative`: Capacitor `App.addListener('appStateChange', ...)` for native, `document.addEventListener('visibilitychange', ...)` for web. Flutter uses a single `AppLifecycleListener` — no branching needed.
- **Cold-start push route.** Angular stores the pending route in `sessionStorage['__pendingPushRoute']` so a pre-Angular native handler can hand it off. Flutter should read initial notifications via `firebase_messaging`'s `getInitialMessage()` / local-notifications `getNotificationAppLaunchDetails()` inside the secure-shell widget's `initState`.
- **Host CSS.** Angular sets `style: 'display: block; height: 100dvh; overflow: hidden;'` on the host element. Flutter is full-screen by default — no equivalent needed.
- **Effect semantics.** Angular `effect()` re-runs when signal dependencies change. Flutter equivalent: a single-fire guard (`bool _chatInitialized`) combined with a `ref.listen(authStateProvider, ...)` that fires when auth transitions to authenticated. Both platforms must guard against double-init on hot reload / rebuild.

## Port Log

| Date       | Who      | What                                                |
| ---------- | -------- | --------------------------------------------------- |
| 2026-04-21 | ltoenjes | Spec created — documents 3-tier shell architecture. |
| 2026-04-27 | sven     | v0.1-alpha 2-tier subset shipped (pre-shell + secure-main). Awaiting-approval flow and fullscreen chat-room layout deferred to v0.2. Auth-driven hosts (`AuthBridges`) initialise chat profile cache + brand theme + push lifecycle. |
