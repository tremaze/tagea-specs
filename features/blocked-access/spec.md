# Feature: Blocked Access

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Dual-mode error page: either explains that an **email change must be confirmed** (when `?reason=email-not-verified`) or that the user has **no institution assignment** (default mode, so counseling features are inaccessible but teamspace features remain open).

## User Stories

- As a **user who just changed email** I want a clear instruction to click the confirmation link, so that my new address becomes active.
- As a **user without institution assignment** I want to understand I can still use teamspace features, so that my experience isn't dead-ended.
- As any **user** on this page I want a way to log out, so that I can switch accounts.

## Acceptance Criteria

### Mode selection

- [ ] **Given** the query param is `?reason=email-not-verified`, **When** the page loads, **Then** the email-verification variant renders (icon `mark_email_unread`, title "E-Mail-Bestätigung erforderlich").
- [ ] **Given** the query param is absent or any other value, **When** the page loads, **Then** the blocked-access variant renders (icon `block`, title "Zugriff nicht möglich").

### Email-verification variant

- [ ] **Given** this variant renders, **When** the user reads the content, **Then** they see: the main message ("Ihre E-Mail-Adresse wurde geändert…"), an info box about the 24-hour link validity, and a checklist (check inbox incl. spam, click link, contact admin if missing).
- [ ] **Given** this variant renders, **When** actions render, **Then** **only** an "Abmelden" button is shown (no "teamspace" CTA).

### Blocked-access variant

- [ ] **Given** this variant renders, **When** the user reads the content, **Then** they see: the main message, an info box about needing institution assignment, and a checklist (contact admin, request assignment, access teamspace in the meantime).
- [ ] **Given** this variant renders, **When** actions render, **Then** both a primary "Zu Teamspace wechseln" button (routes to `/teamspace`) and a secondary "Abmelden" button are shown.

### Mobile

- [ ] **Given** the viewport is `<= 600px`, **When** the page renders, **Then** action buttons stack full-width and the support footer stacks vertically.

## UI States

| State                    | When?                        | What does the user see?                                                   |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------- |
| Email-not-verified       | `?reason=email-not-verified` | `mark_email_unread` icon + email-verification copy + Abmelden only        |
| Blocked-access (default) | no matching query param      | `block` icon + institution-assignment copy + Teamspace + Abmelden buttons |

## Non-Goals

- **Resending the confirmation email from this page** — user must contact admin.
- **Auto-recovery polling** — unlike [awaiting-approval](../awaiting-approval/spec.md), no interval poll for status changes here.

## Edge Cases

- **Query param malformed** (e.g. `?reason=` empty, `?reason=foo`) → blocked-access variant (default branch wins).
- **Deep link with no auth** — page still renders (no auth guard on the route).

## Permissions & Tenant/Institution

- **Required roles:** none (public-facing error surface, reached from `/auth/callback` redirect or direct link).
- **Institution context:** by definition, the user either has a changed-email issue or no institution assignment.
- **Backend access checks:** none on this page.

## Notifications (Push / In-App)

- Not relevant.

## i18n Keys

> User-facing strings remain in German. **All strings are currently hardcoded in the template** (no `transloco` pipe). Port should add proper i18n keys.

## Offline Behavior

**Flutter-specific:**

- Works offline (pure static UI branching on query param).
- Teamspace navigation requires online.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts`](../../../apps/tagea-frontend/src/app/pages/blocked-access/blocked-access.component.ts)
- **Redirect source:** [`auth-callback spec`](../auth-callback/spec.md) branches here on `EMAIL_NOT_VERIFIED` (passes `?reason=email-not-verified`).
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
