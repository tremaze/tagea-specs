# Feature: Chat (Staff)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Full-page staff-facing chat surface at `/chat`. Thin wrapper over the shared `@tagea/chat` library's `CHAT_BASE_ROUTES`: hosts a `<router-outlet>` and redirects out if the tenant has chat disabled. On mobile this is the primary chat UI; on desktop it coexists with a chat FAB.

## User Stories

- As a **staff member** I want a dedicated full-page chat view, so that I can focus on conversations on mobile or when FAB is closed on desktop.
- As any **user** on this page I want the chat to close gracefully if my tenant disables the feature mid-session, so that I don't get stuck in a broken state.

## Acceptance Criteria

- [ ] **Given** the user navigates to `/chat`, **When** the page loads, **Then** `CHAT_BASE_ROUTES` render inside the page via `<router-outlet>`.
- [ ] **Given** the tenant feature flag `chat` is off (`TenantFeaturesService.isChatEnabled() === false`), **When** the `effect()` runs, **Then** the router navigates to `/teamspace`.
- [ ] **Given** the tenant feature flag is on, **When** the `effect()` runs, **Then** the component reads `AuthService.idToken` but currently does **not** initiate an explicit connect (the `chatService.connect(idToken)` call is commented out — documented as a known implementation detail).
- [ ] **Given** the container config `CHAT_CONTAINER_CONFIG = { defaultSafeArea: 'conversation' }` is provided, **When** child chat components render, **Then** they respect that safe-area preset.

## UI States

Owned by the shared `@tagea/chat` components rendered through `CHAT_BASE_ROUTES` (ChatLoadingComponent / ChatEmptyComponent / ChatContainerComponent). The wrapper itself has no visible state beyond the router outlet.

## Flows

```
/chat ── RouterOutlet ──▶ CHAT_BASE_ROUTES
                              │
                              ├── '' → ChatLoadingComponent
                              └── 'empty' → ChatEmptyComponent
```

Room- and invite-level routes are not under `/chat/*` but on the secure-shell level (`/chat/room/:roomId`, `/chat/invite/:roomId`) — see [chat-room](../chat-room/spec.md) and [chat-invite](../chat-invite/spec.md).

## Non-Goals

- **Room-level or invite-level UI** — handled by the separate [chat-room](../chat-room/spec.md) / [chat-invite](../chat-invite/spec.md) routes.
- **Custom chat protocol** — engine is owned by `@tagea/chat` (Matrix SDK under the hood).

## Edge Cases

- **Feature flag toggles `false` mid-session** → `effect()` re-evaluates and redirects to `/teamspace`. The user's in-flight chat state is lost (owned by the library; not persisted locally).
- **Double-mount during navigation** — Angular guarantees single effect ownership per component instance.

## Permissions & Tenant/Institution

- **Required roles:** `permissionGuard: chat.access` + `chatFeatureGuard` at route level (in `app.routes.ts`).
- **Tenant feature flag:** `chat` — also double-checked inside the component via the runtime `effect()`.
- **Institution context:** handled inside the chat library (Matrix rooms scoped by tenant).

## Notifications (Push / In-App)

- Owned by `@tagea/chat` — the wrapper does not drive notifications.
- Push deep-links for a specific room land on `/chat/room/:roomId`, not here.

## i18n Keys

- Owned by the `@tagea/chat` library.

## Offline Behavior

**Flutter-specific:**

- Mirrors [client-chat](../client-chat/spec.md) — wrapper adds no offline concerns. Offline behavior lives in the Flutter port of `@tagea/chat`.

## References

- **Angular implementation (wrapper):** [`apps/tagea-frontend/src/app/pages/chat/chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/chat/chat-page.component.ts)
- **Template:** [`chat-page.component.html`](../../../apps/tagea-frontend/src/app/pages/chat/chat-page.component.html)
- **Chat library routes:** [`packages/chat/src/lib/routes.ts`](../../../packages/chat/src/lib/routes.ts) — exports `CHAT_BASE_ROUTES`, `CHAT_ROOM_ROUTE`, `CHAT_INVITE_ROUTE`, `CHAT_ROUTES`
- **E2E tests:** owned by chat library tests
- **Backend endpoints:** owned by the Matrix server; see chat library docs
