# Feature: Blocked Access

> **Status:** ✅ Spec reviewed against Angular (2026-09-24)
> **Owner:** ltoenjes
> **Last updated:** 2026-09-24

## Vision (Elevator Pitch)

One landing page for every "you are signed in but cannot enter the app right
now" state. The page explains the specific **reason** (`?reason=…`) with a
title, a message, an info box and — where useful — a "Was kannst du tun?"
checklist, and offers the actions that can resolve it: resend the
confirmation e-mail, switch to Teamspace, register again, sign out.

## User Stories

- As a **user whose account is suspended, deleted, pending approval or not
  activated** I want to understand why I cannot sign in, so that I know whom
  to ask.
- As a **user who changed their e-mail address** I want to request a new
  confirmation link myself, so that I do not have to contact an admin.
- As a **user whose e-mail domain is not allowed** I want to see which domain
  is refused, so that I can sign in with my work account instead.
- As any **user** on this page I want to sign out, so that I can switch
  accounts.

## Acceptance Criteria

### Reason resolution

- [ ] **Given** `GET /session/v2` answers 403 with a structured
  `ACCOUNT_BLOCKED` body, **When** the bootstrap runs, **Then** the user lands
  on `/blocked-access?reason=<reason>` (reason from `enrollment.detail.reason`
  when `enrollment.state = blocked`, else from the top-level `reason`).
- [ ] **Given** the 403 carries a `VIVENDI_*` code, **Then** the reason is
  `vivendi-provisioning`.
- [ ] **Given** a 403 that carries no known reason, **Then** the reason is
  `unknown` (general "Zugriff nicht möglich" copy).
- [ ] **Given** a 401 from `/session/v2` (valid token, no Tagea principal),
  **Then** the reason is `not-provisioned` (Angular only — see Flutter note).
- [ ] **Given** the page is opened without `?reason` or with an unrecognised
  value, **Then** the `no-institution` copy renders (Angular default).
- [ ] **Given** a pending-approval **client** (`principalType = client`),
  **Then** Angular routes to the `/join` awaiting flow instead.

### Content per reason

| Reason                       | Icon                | Title (de)                                             | Steps | Extra action                |
| ---------------------------- | ------------------- | ------------------------------------------------------ | ----- | --------------------------- |
| `account-deleted`            | `no_accounts`       | Account gelöscht                                       | –     | –                           |
| `account-suspended`          | `block`             | Account deaktiviert                                    | –     | –                           |
| `account-pending-approval`   | `hourglass_top`     | Warten auf Freigabe                                    | –     | –                           |
| `account-pending-activation` | `mark_email_read`   | Account noch nicht aktiviert                           | –     | –                           |
| `email-not-verified`         | `mark_email_unread` | E-Mail-Bestätigung erforderlich                        | 3     | E-Mail erneut senden        |
| `email-domain-not-allowed`   | `alternate_email`   | E-Mail-Domain nicht freigeschaltet                     | 2     | –                           |
| `vivendi-provisioning`       | `badge`             | Account konnte nicht automatisch eingerichtet werden   | 2     | –                           |
| `not-provisioned`            | `person_off`        | (see i18n)                                             | –     | –                           |
| `no-landing-target`          | `report_problem`    | (see i18n)                                             | 2     | –                           |
| `onboarding-unavailable`     | `cloud_off`         | (see i18n)                                             | –     | –                           |
| `enrollment-rejected`        | `cancel`            | (see i18n)                                             | 2     | Neu registrieren            |
| `no-institution` (default)   | `block`             | (see i18n)                                             | 3     | Zu Teamspace wechseln*      |
| `unknown`                    | `error_outline`     | Zugriff nicht möglich                                  | –     | –                           |

\* only when the Teamspace feature is enabled and the user holds
`tenant.teamspace.home.view`.

- [ ] Every reason shows "Abmelden" and the support footer.
- [ ] `email-domain-not-allowed` names the refused domain (`@example.org`)
  from the OIDC `email` / `preferred_username` claim; without a usable
  address it uses the generic wording.
- [ ] `enrollment-rejected` shows the admin's rejection reason when the
  backend delivered one.

### Resend confirmation e-mail (`email-not-verified`)

- [ ] **When** the user taps "Bestätigungs-E-Mail erneut senden", **Then**
  `POST /auth/resend-email-change-verification` is sent; on success a
  confirmation line shows and the button is disabled for
  `retryAfterSeconds`, counting down ("Erneut senden in 4:59").
- [ ] **Given** 400 with `retryAfterSeconds`, **Then** the cooldown starts
  and a rate-limit message shows.
- [ ] **Given** 404, **Then** "Es liegt keine ausstehende E-Mail-Bestätigung
  vor…" shows.
- [ ] **Given** any other failure, **Then** a generic error shows and the
  button stays enabled.

### Leaving the page

- [ ] **When** the page opens, **Then** Angular refreshes the session once
  and navigates to the landing target if one exists now (e.g. the account was
  reactivated meanwhile).

### Mobile

- [ ] **Given** the viewport is `<= 600px`, **Then** action buttons stack
  full-width and the support footer stacks vertically (icon above text).

## UI States

| State          | When?                          | What does the user see?                         |
| -------------- | ------------------------------ | ----------------------------------------------- |
| Reason page    | always                         | copy per reason (table above)                   |
| Resend running | resend request in flight       | spinner in the resend button                    |
| Resend sent    | 2xx                            | success line, button counts down                |
| Resend failed  | 400 / 404 / other              | error line (rate limit / not pending / generic) |

## Non-Goals

- **Auto-recovery polling** — no interval poll; see the one-shot refresh on
  open.

## Edge Cases

- **Future backend reasons** unknown to the client → `unknown` copy, never a
  blank page.
- **Deep link with no auth** — page still renders.

## Permissions & Tenant/Institution

- **Required roles:** none (error surface after sign-in).
- **Backend access checks:** the resend endpoint is `@Auth({ scope:
  'authenticated', allowEmailUnverified: true })`, so it works while the
  session is refused for `email-not-verified`.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

Transloco keys under `blocked_access.*` (`reasons.<reason>.title|message|
info|instructions.*`, `buttons.*`, `resend.*`, `what_to_do`,
`support_footer`) in `apps/tagea-frontend/src/assets/i18n/<lang>.json`.

## Offline Behavior

**Flutter-specific:**

- The blocked state survives transient failures: a retry that fails with a
  network error, 5xx, 401 or a 4xx other than 403 keeps the reason page; it
  never falls back to the offline navigation. Only a successful session load
  (or a new 403) ends it.
- Resend requires network; offline it shows the generic error.

## Flutter port notes

> **Flutter port note:** In Flutter the page is not a route: the home shell
> renders `BlockedAccessView` instead of any destination while
> `SessionAccessCubit` is `denied`. Only **403** is `denied`; 401 stays a
> transient failure for now (owner decision 2026-09-24), so
> `not-provisioned` has no Flutter surface yet. Scope of the port: the six
> `ACCOUNT_BLOCKED` reasons, `vivendi-provisioning` and `unknown` (also the
> fallback for any other 403, incl. `enrollment-rejected` and
> `NO_TENANT_CONTEXT`). Flutter adds "Erneut versuchen" and pull-to-refresh,
> both reloading `/session/v2` (replaces Angular's one-shot refresh on open).
> Pending-approval clients see the pending-approval page (no `/join` flow in
> Flutter yet).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts`](../../../apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts)
- **Reason routing:** [`apps/tagea-frontend/src/app/auth-session/session-bootstrap.service.ts`](../../../apps/tagea-frontend/src/app/auth-session/session-bootstrap.service.ts) (`fetchSession`, `routeFromEnrollment`)
- **Reason list:** [`packages/session/src/lib/account-block-reason.ts`](../../../packages/session/src/lib/account-block-reason.ts)
- **Backend endpoints:** see [contracts.md](./contracts.md)
