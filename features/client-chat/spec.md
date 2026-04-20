# Feature: Client Chat

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Clients have access to the same real-time chat system staff uses, but embedded in the client portal shell. This is a thin wrapper over the shared `@tagea/chat` library: the page hosts a router outlet that renders chat-library routes (`CHAT_ROUTES`), plus a tenant-feature guard that redirects out if chat is disabled.

## User Stories

- As a **client** I want to chat with my caseworker in real time, so that I can get quick answers without writing a formal inquiry.
- As a **client** I want the chat experience to match the rest of the app, so that I don't have to learn two UI paradigms.

## Acceptance Criteria

- [ ] **Given** the user navigates to `/client-portal/chat`, **When** the page loads, **Then** the shared chat library renders inside the client-portal shell.
- [ ] **Given** the tenant has chat disabled (`TenantFeaturesService.isChatEnabled()` is false), **When** the page mounts, **Then** redirect to `/client-portal`.
- [ ] **Given** the `@tagea/chat` library's `CHAT_ROUTES` render child routes (room list, single room, etc.), **When** the user navigates within chat, **Then** the router-outlet picks up those routes.
- [ ] **Given** the `CHAT_CONTAINER_CONFIG` sets `defaultSafeArea: 'conversation'`, **When** the chat renders, **Then** it respects client-portal-specific safe-area insets.

## UI States

All UI states are owned by the `@tagea/chat` library (room list, conversation view, composer, etc.). This wrapper itself has no visible state beyond the router outlet.

## Flows

```
/client-portal/chat ── router-outlet ──▶ CHAT_ROUTES (library)
                                             │
                                             ├── room list
                                             ├── conversation view
                                             └── …
```

## Non-Goals

- **Custom UI for client chat** — client portal reuses the shared library.
- **Separate message history** from staff chat — same underlying Matrix/WebSocket backend.

## Edge Cases

- **Chat disabled mid-session:** if `TenantFeaturesService.isChatEnabled()` flips to `false` while the user is on this page, an `effect` redirects them to `/client-portal`.
- **Route-level guard:** `chatFeatureGuard` on the route blocks activation if the tenant has not enabled the chat feature flag (same source of truth as the runtime `effect()` check).

## Permissions & Tenant/Institution

- **Required roles:** Client (via `clientPortalGuard` on the parent route).
- **Route-level guard:** only `chatFeatureGuard` is applied to `/client-portal/chat` — there is **no** `permissionGuard` with a `chat.access` permission on this route (that permission guard lives on the staff-facing `/chat/*` routes).
- **Tenant feature flag:** `chat` — `chatFeatureGuard` checks it at route activation; additionally the component's `effect()` watches `TenantFeaturesService.isChatEnabled()` and redirects out if it flips during a session.
- **Institution context:** handled inside the chat library.

## Notifications (Push / In-App)

- Chat notifications are owned by the `@tagea/chat` library.
- Deep-links from push notifications typically land on `/chat/room/:roomId` (secure-shell route) rather than here — verify navigation target on the Flutter port.

## i18n Keys

- Owned by the `@tagea/chat` library — no wrapper-specific keys.

## Offline Behavior

**Flutter-specific:**

- Owned by the Flutter port of `@tagea/chat`.
- Wrapper adds no offline concerns.

## References

- **Angular implementation (wrapper):** [`apps/tagea-frontend/src/app/pages/client-portal/client-chat-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/client-portal/client-chat-page.component.ts)
- **Chat library:** `@tagea/chat` (separate Nx library in this workspace)
- **Route constants:** `CHAT_ROUTES`, `CHAT_CONTAINER_CONFIG`, `ChatContainerConfig` exported from `@tagea/chat`
- **E2E tests:** covered indirectly via chat library tests
- **Backend endpoints:** owned by chat library (Matrix server or WebSocket backend — check library implementation)
