# Feature: Awaiting Approval

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Holding page for newly-registered employees whose account is `PENDING_APPROVAL`. Explains the situation, offers a logout action, and polls the backend every 5 seconds for approval. When approval is detected, shows a success state for 2 seconds, then auto-navigates to `/`.

## User Stories

- As a **newly-registered employee** I want to know that my email is verified but I still need admin approval, so that I don't panic about being stuck.
- As a **recently-approved employee** I want to be automatically redirected when the approval lands, so that I don't have to refresh manually.

## Acceptance Criteria

### Default (awaiting)

- [ ] **Given** the user lands on `/awaiting-approval`, **When** the page renders, **Then** the default icon (`hourglass_empty`), title "Registrierung wird geprüft", explanatory text, and a "Logout" button are shown.
- [ ] **Given** the page is mounted, **When** 5 seconds pass, **Then** `EmployeesService.getCurrentEmployee()` is polled; if `status !== 'active'`, the page remains in the waiting state and polls again 5s later.

### Approval detected

- [ ] **Given** a poll returns `status === 'active'`, **When** the signal updates, **Then** the UI swaps to the success variant (`check_circle` icon, title "Registrierung genehmigt!", message "Sie werden in Kürze weitergeleitet…").
- [ ] **Given** the success state is shown, **When** 2 seconds pass, **Then** `Router.navigate(['/'])` fires and the user leaves the page.

### Logout

- [ ] **Given** the user clicks "Abmelden", **When** the click fires, **Then** `UnifiedAuthService.logout()` runs and polling stops.

### Teardown

- [ ] **Given** the component is destroyed, **When** teardown runs, **Then** the polling interval is cancelled via `destroy$` (no further `getCurrentEmployee` calls).

## UI States

| State                    | When?                           | What does the user see?                                       | A11y notes                     |
| ------------------------ | ------------------------------- | ------------------------------------------------------------- | ------------------------------ |
| Waiting                  | default, `approved() === false` | `hourglass_empty` icon + "wird geprüft" title + Logout button | `role="status"` on the message |
| Approved (transient, 2s) | `approved() === true`           | `check_circle` icon + success title + redirect message        | `role="status"`                |

## Non-Goals

- **Push notifications on approval** — polling-only for now. A future Flutter port could layer FCM on top, but the spec mirrors the current polling contract.
- **Manual refresh button** — the 5s interval handles it.

## Edge Cases

- **Browser tab in background** — JS timers throttle; approval detection may lag by up to 60s until the tab regains focus. Acceptable.
- **Network failures during poll** — uncaught errors would kill the stream; the current impl does NOT explicitly handle errors. Flutter port should add retry/backoff.
- **Employee status changes to non-`active`/non-pending value** (e.g., `rejected`) — filter gate only lets `active` through; other values cause the user to wait forever. Verify this is intentional with product.

## Permissions & Tenant/Institution

- **Route guard:** `pendingEmployeeGuard` (`apps/tagea-frontend/src/app/guards/employee-approval.guard.ts`). Waits for auth to resolve; redirects unauthenticated users to `/welcome`, clients to `/client-portal`, and any non-pending employee to `/dashboard`. Only `status === 'pending_approval'` may stay.
- **Sibling guard:** `activeEmployeeGuard` protects the rest of the secure shell and redirects `pending_approval` employees here (`/awaiting-approval`).
- **Institution context:** not applicable — the page runs before institution assignment.
- **Backend access checks:** `GET /employees/me` is declared `@Auth({ scope: 'authenticated' })` on `EmployeeSelfServiceController`, so any authenticated (including pending) user can poll it.

## Notifications (Push / In-App)

- Not wired currently. Suggested future enhancement: FCM push from backend when admin approves, so the user doesn't need to keep the tab open.

## i18n Keys

> User-facing strings remain in German. **Strings are currently hardcoded in the template** (despite `TranslocoModule` being imported — it's unused). Port should add proper i18n keys.

## Offline Behavior

**Flutter-specific:**

- Offline: polling fails silently; page shows stale "waiting" state. Add offline indicator + manual retry button for better UX.
- Logout requires online.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/employee-awaiting-approval/employee-awaiting-approval.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-awaiting-approval/employee-awaiting-approval.component.ts)
- **Route registration:** `apps/tagea-frontend/src/app/app.routes.ts` (child of the `AUTH_GUARD`-protected secure shell, path `awaiting-approval`, guarded by `pendingEmployeeGuard`).
- **Guards:** `pendingEmployeeGuard` and `activeEmployeeGuard` in `apps/tagea-frontend/src/app/guards/employee-approval.guard.ts`.
- **Service:** `EmployeesService.getCurrentEmployee()` (`apps/tagea-frontend/src/app/services/employees.service.ts`) → `GET /employees/me`.
- **Backend:** `EmployeeSelfServiceController` (`apps/tagea-backend/src/users/controllers/employee-self-service.controller.ts`); status enum in `apps/tagea-backend/src/common/types/user-principal.types.ts` (`UserStatus`).
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
