# Feature: Support-Ticket Notifications

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-05-29

## Vision (Elevator Pitch)

The internal support-ticket system under `/administration/support` currently
delivers tickets silently — a user must poll the Kanban board to learn that a
ticket was assigned to them, answered, or resolved. This feature fans out
**push / email / in-app** notifications on the meaningful ticket events so that
creators, assignees, the work-team, and explicitly mentioned colleagues are
pulled back to the ticket exactly when their attention is needed — and **only**
then.

This spec covers the notification fan-out and the **@mention** capability that
feeds it. The ticket CRUD, Kanban UI, attachments, and inline editing are
already shipped and are **not** in scope here. The generic notification
delivery infrastructure (`NotificationService` / `NotificationDispatchService`
/ in-app notification center) is reused as-is.

## Guiding Principle

> **Status labels organize the board; assignment and conversation drive the
> notifications.**

A status column (`backlog`, `open`, `in_progress`, `waiting`) describes *where*
a ticket sits, not *who must act*. "Who must act" is encoded in the **assignee**
and in **comments / mentions**. Therefore status transitions — with the single
exception of reaching the terminal `done` state — emit **no** notification.
This is a deliberate decision (see [Design Decisions](#design-decisions)) and
the reason the "move to waiting, then reassign" flow produces exactly one
notification to the right person instead of two.

## Personas & Permission Matrix

The `tenant.support_tickets.*` permission set (seeded by
`20260529100001-AddSupportTicketsPermissions`) maps cleanly onto E2E personas:

| Persona             | create | view | work | delete | Notification role                                  |
| ------------------- | :----: | :--: | :--: | :----: | -------------------------------------------------- |
| `mitarbeiter`       |   ✅   |  –   |  –   |   –    | **Creator** — opens tickets, comments on own       |
| `personalverwalter` |   ✅   |  ✅  |  ✅  |   –    | **Work-Team / Assignee** — triages and works tickets |
| `traeger-manager`   |   ✅   |  ✅  |  ✅  |   ✅   | Work-Team + the one who **deletes**                |
| 2nd `mitarbeiter`   |   ✅   |  –   |  –   |   –    | **Outsider** — not a recipient, not mentionable    |
| `traegeradmin`      | (TA bypass → all four) |||| Work-Team via tenant-admin bypass                  |

**Work-Team** = the set of employees whose assigned **tenant role** effectively
grants `tenant.support_tickets.work` (i.e. `personalverwalter`,
`traeger-manager`, and any custom role cloning them). Resolution is done purely
against the tenant-DB role tables (standard + custom roles with grant/deny
overrides), mirroring `PrincipalLoaderService` tenant-scope semantics.

> **Scoping note (implementation):** the tenant-admin *bypass*
> (`auth_user_tenant.is_tenant_admin`) lives in the Meta DB and grants every
> permission at request time, but is **not** used to auto-subscribe a
> tenant-admin to the work-team notification feed. A `traegeradmin` receives
> work-team notifications only if they also hold a role granting the `work`
> permission. They retain full board access regardless. This keeps the
> notification module decoupled from the Meta DB and fully tenant-DB-testable.

**View-capable** = `canViewTicket` is true: holds `view` **or** `work`, **or**
is the ticket creator. This set is the gate for both **assignee selection** and
**@mention** targeting (see below) so that no notification can ever deep-link a
recipient into a `403`.

## User Stories

- As the **creator** (`mitarbeiter`) of a ticket I want a notification when my
  ticket is **resolved**, so I know the request is done without polling the board.
- As the **creator** I want a notification when someone **comments** on my
  ticket, so I can answer follow-up questions.
- As a member of the **work-team** I want a notification when a **new ticket**
  is created, so the inbox is covered without anyone watching the board.
- As an **assignee** I want a notification when a ticket is **assigned to me**,
  with the ticket's current status visible, so I immediately know whether the
  ball is in my court or still with the requester.
- As **anyone working a ticket** I want to **@mention** a view-capable colleague
  in a comment and have them notified, so I can pull in a third person without
  reassigning the ticket.
- As the **actor** of any change I do **not** want to be notified about my own
  action.
- As a user who moves a ticket through Kanban columns I do **not** want every
  column move to land in someone's inbox.

## Acceptance Criteria

### Recipient resolution (applies to every trigger)

A single private helper `SupportTicketNotificationService.resolveRecipients(
ticket, trigger, actorId, context)` MUST enforce all of the following before
any dispatch:

- [ ] **Self-exclude.** **Given** the actor is in the computed recipient set,
      **When** recipients are resolved, **Then** the actor is removed
      (via `NotificationScope.excludeEmployeeId` for audience sends, or an
      explicit filter for per-employee sends).
- [ ] **Dedupe.** **Given** the same employee qualifies for a trigger through
      more than one role (e.g. creator **and** assignee), **When** recipients
      are resolved, **Then** they appear **once**.
- [ ] **Soft-delete gate.** **Given** `ticket.is_deleted === true`, **When** any
      trigger other than `SUPPORT_TICKET_DELETED` fires, **Then** no
      notification is sent.
- [ ] **Missing recipient identifiers.** **Given** a resolved recipient has no
      `auth_user_id` (push) or no `email`, **When** dispatched, **Then** the
      unavailable channel is skipped by the existing dispatch logic; other
      channels still fire. No crash, logged at `debug`.
- [ ] **Empty set.** **Given** the resolved set is empty after exclusion,
      **When** dispatched, **Then** it is a silent no-op (logged at `debug`).

### Trigger matrix

| #   | Trigger                          | Recipients                                  | `NotificationType`              | in_app | push | email |
| --- | -------------------------------- | ------------------------------------------- | ------------------------------- | :----: | :--: | :---: |
| 1   | Ticket created                   | Work-Team, **⊖ creator**                    | `SUPPORT_TICKET_CREATED`        |   ✅   |  ✅  |   –   |
| 2   | Assignee set / changed           | new assignee, **⊖ actor**                   | `SUPPORT_TICKET_ASSIGNED`       |   ✅   |  ✅  |  ✅   |
| 3   | Status reaches `done`            | creator, **⊖ actor**                        | `SUPPORT_TICKET_RESOLVED`       |   ✅   |  ✅  |   –   |
| 4   | New comment                      | creator **+** assignee, **⊖ author**        | `SUPPORT_TICKET_COMMENT`        |   ✅   |  ✅  |   –   |
| 5   | @mention (comment or description)| mentioned, view-capable employees, **⊖ author** | `SUPPORT_TICKET_MENTION`    |   ✅   |  ✅  |  ✅   |
| 6   | Ticket soft-deleted              | creator **+** assignee, **⊖ actor**         | `SUPPORT_TICKET_DELETED`        |   ✅   |  –   |   –   |

#### #1 — Ticket created

- [ ] **Given** a ticket is created via `SupportTicketService.create`, **When**
      the transaction commits, **Then** every Work-Team member except the
      creator receives `SUPPORT_TICKET_CREATED` on `[IN_APP, PUSH]`.
- [ ] **Given** the creator is themselves a Work-Team member (e.g.
      `traeger-manager` opening a ticket), **When** #1 fires, **Then** they do
      **not** receive their own ticket notification.
- [ ] **Given** the ticket is created **with an assignee already set** (one
      atomic create), **When** the transaction commits, **Then** the assignee
      receives `SUPPORT_TICKET_ASSIGNED` (#2) **and** the rest of the Work-Team
      receives `SUPPORT_TICKET_CREATED` (#1); the assignee is **de-duped** out
      of #1 (they get the more specific #2 only).

#### #2 — Assigned

- [ ] **Given** an `update` changes `assignee_employee_id` to a new employee,
      **When** the change is saved, **Then** the new assignee (if ≠ actor)
      receives `SUPPORT_TICKET_ASSIGNED` on `[IN_APP, PUSH, EMAIL]`.
- [ ] **Given** the actor assigns the ticket **to themselves**, **When** saved,
      **Then** no notification is sent.
- [ ] **Given** the assignee is unchanged (idempotent write — same value),
      **When** saved, **Then** no notification is sent.
- [ ] **Given** the ticket's status is `waiting`, **When** #2 fires, **Then**
      the payload body and `data.status` carry the **current** status so the new
      assignee can tell the ball is with the requester, not with them.
- [ ] **Given** the assignee is cleared (`assignee_employee_id → null`), **When**
      saved, **Then** no notification is sent (no "unassigned" notification in
      this version — see [Non-Goals](#non-goals)).

#### #3 — Resolved (status → `done`)

- [ ] **Given** `changeStatus` sets `status = done` from any other status,
      **When** saved, **Then** the creator (if ≠ actor) receives
      `SUPPORT_TICKET_RESOLVED` on `[IN_APP, PUSH]`.
- [ ] **Given** the status is set to `done` **again** while already `done`
      (idempotent), **When** saved, **Then** no notification is sent.
- [ ] **Given** the status changes between any **non-terminal** columns
      (`backlog`/`open`/`in_progress`/`waiting` in any direction), **When**
      saved, **Then** **no** notification is sent — neither to creator nor
      assignee. This is the core "status labels don't notify" rule.

#### #4 — New comment

- [ ] **Given** a comment is added via `addComment`, **When** saved, **Then**
      the creator and the current assignee (each if ≠ author, de-duped) receive
      `SUPPORT_TICKET_COMMENT` on `[IN_APP, PUSH]`.
- [ ] **Given** the comment also contains @mentions, **When** dispatched,
      **Then** a mentioned recipient who is *also* creator/assignee receives
      **only** `SUPPORT_TICKET_MENTION` (#5 outranks #4 for that person).

#### #5 — @mention

- [ ] **Given** a comment (or the description on create/update) contains a
      mention of employee `X`, **When** dispatched, **Then** `X` (if ≠ author and
      ≠ already excluded) receives `SUPPORT_TICKET_MENTION` on
      `[IN_APP, PUSH, EMAIL]`.
- [ ] **Given** the author mentions **themselves**, **When** dispatched, **Then**
      no self-notification is sent.
- [ ] **Given** the client submits a mention for an employee `Y` who is **not**
      view-capable for this ticket, **When** the backend re-validates the
      mention IDs against `canViewTicket`, **Then** `Y` is **silently dropped**
      from the persisted `mentioned_employee_ids` and receives no notification.
      (No error to the author — invalid mentions are pruned, not rejected.)

#### #6 — Soft-deleted

- [ ] **Given** `softDelete` runs, **When** the ticket is flagged deleted,
      **Then** the creator and assignee (each if ≠ actor, de-duped) receive
      `SUPPORT_TICKET_DELETED` on `[IN_APP]` only.

### Channel policy

- [ ] Email fires **only** for `SUPPORT_TICKET_ASSIGNED` and
      `SUPPORT_TICKET_MENTION` — the two "you specifically need to come back"
      events. All other triggers stay on in-app (+push where listed).
- [ ] **Given** a recipient has `email_notifications === false` on their employee
      record, **When** an email-eligible trigger fires, **Then** the email
      channel is suppressed by the existing preference filter; push and in-app
      still fire. (Reuse current behavior — no new preference plumbing.)

### Deep-linking

- [ ] **Given** any in-app notification is built, **When** the payload is
      assembled, **Then** `contentType = 'support_ticket'` and
      `contentId = ticket.id` are set, and the in-app entry links to
      `/administration/support/tickets/{ticket.id}`.
- [ ] **Given** a recipient opens the ticket detail page, **When** the page
      loads, **Then** unread support-ticket notifications for that `contentId`
      are dismissed (`dismissByContentId('support_ticket', ticketId)`), mirroring
      the appointment-detail convention.
- [ ] **Given** every mentionable/assignable employee is by construction
      view-capable, **Then** following any notification deep-link can **never**
      land on a `403`.

## @Mention capability

Mentions are the only way (after the deliberately narrow comment scope) to pull
a third person into a ticket conversation, so they are specified as a
first-class part of this feature.

### Data model

- [ ] A migration adds `mentioned_employee_ids uuid[] NOT NULL DEFAULT '{}'` to
      `support_ticket_comments`. (Description-level mentions persist on the
      ticket row analogously **only if** description mentions ship; MVP may scope
      mentions to comments — see test plan.)
- [ ] The frontend captures mentions via a **chip multi-select of view-capable
      employees** attached to the comment composer (the `@tiptap/extension-mention`
      package is not installed; a multi-select avoids a new dependency and a
      fragile suggestion popup while keeping the backend contract — resolved
      employee IDs on the comment — identical). The selected IDs are sent as
      `mentioned_employee_ids` on the add-comment request.

### Targeting & validation

- [ ] The mention autocomplete lists **only view-capable employees** for the
      current ticket (those who would pass `canViewTicket`).
- [ ] The backend treats the client-supplied mention ID list as untrusted: it
      re-validates each ID against `canViewTicket` and persists only the survivors
      (no implicit access grant — consistent with the assignee constraint).

> **Implementation note (assignee picker scope):** the per-ticket
> `GET /tenant/support-tickets/:id/mentionable-employees` endpoint returns the
> view-capable set and powers **both** the mention multi-select **and** the
> detail-page inline assignee picker, so reassignment on the detail page is
> view-capable by construction. The create/edit **dialog**'s assignee dropdown
> still lists all employees (its existing WORK-gated behaviour); narrowing it to
> view-capable is a small follow-up. Mentions are additionally enforced at the
> API (pruned server-side); the assignee field is currently UI-constrained on the
> detail page.

## Non-Goals

- **No `STATUS_CHANGED` / `WAITING_ON_YOU` notification.** Non-terminal status
  moves are silent by design.
- **No "unassigned" notification** to a former assignee when the assignee is
  cleared or replaced. (Open for a future quiet `SUPPORT_TICKET_UNASSIGNED`
  in_app-only ping; explicitly out of this version.)
- **No `SUPPORT_TICKET_STALE` / SLA reminder.** Time-based "ticket untouched for
  X" / "waiting too long" notifications require a scheduler and belong to the
  BullMQ scheduler-queue migration, not here.
- **No client-portal notifications.** Support tickets are an internal
  (`/administration`) staff feature; clients are never recipients.
- No changes to ticket CRUD, Kanban, attachments, or inline-editing behavior.

## Design Decisions

| # | Decision                                                                 | Rationale |
| - | ------------------------------------------------------------------------ | --------- |
| 1 | New ticket notifies the **whole work-team** (not just on assignment).    | Central triage inbox; the team is small and every ticket should be seen. |
| 2 | Channels: **in-app + push + email**, email only on `ASSIGNED`/`MENTION`. | Full reach for "come back now" events; everything else stays quiet. |
| 3 | Comment scope = **creator + assignee only**; third parties via @mention. | Avoids re-pinging every past commenter; mentions make inclusion explicit. |
| 4 | **Only view-capable employees are mentionable/assignable.**              | No implicit access grant; deep-links can never 403. No policy change to `canViewTicket`. |
| 5 | **Status changes don't notify** (except → `done`).                       | Status organizes the board; assignment + comments drive notifications. Resolves the "waiting + reassign = double ping" problem. |

## Implementation pointers (non-normative)

- Add 6 values to `NotificationType`: `SUPPORT_TICKET_CREATED`, `_ASSIGNED`,
  `_RESOLVED`, `_COMMENT`, `_MENTION`, `_DELETED`.
- New `SupportTicketNotificationService` holding `resolveRecipients` + the
  per-trigger dispatch calls; injected into `SupportTicketService`.
- Touchpoints: `create` (#1 / #2 / description-mentions), `update` (#2 diff,
  description-mentions), `changeStatus` (#3 only when crossing into `done`),
  `addComment` (#4 + #5), `softDelete` (#6).
- The "work-team" recipient set is resolved by querying employees holding
  `tenant.support_tickets.work` (including tenant-admin bypass), built into
  `NotificationRecipient[]` and dispatched per-employee — not via the
  audience/scope path, which targets broad audiences rather than a permission set.

---

# Test Plan

Coverage is **persona-driven** end to end: every recipient rule is asserted from
the point of view of a concrete persona, and each negative case names the
persona that must **not** be notified. Push and email assertions live at the
unit/integration layer (dispatch spy); E2E asserts the **in-app** channel
(notification center + deep-link), which is the only one observable in a browser.

## Layer 1 — Unit: `resolveRecipients` & policy

Pure-function tests on the resolver with hand-built ticket/actor fixtures
(no DB). One assertion per rule:

- [ ] **Self-exclude** — actor never in the result for any trigger.
- [ ] **Dedupe** — creator-is-assignee yields one recipient for #4/#6.
- [ ] **Mention outranks comment** — a mentioned creator/assignee gets `MENTION`
      only, not `COMMENT`.
- [ ] **Soft-delete gate** — every trigger except `DELETED` returns `[]` when
      `is_deleted`.
- [ ] **Status rule** — `resolveRecipients` for a `waiting`/`in_progress`/`open`
      transition returns `[]`; only `→ done` returns the creator.
- [ ] **Mention pruning** — a mention ID failing `canViewTicket` is dropped.
- [ ] **Channel map** — each trigger maps to exactly the channels in the matrix.
- [ ] Extend the existing `support-ticket-policy.service.spec.ts` if
      `canViewTicket` is reused as the mention/assignee gate.

## Layer 2 — Integration: `SupportTicketService` + dispatch spy

NestJS testing module with a **mocked `NotificationDispatchService`**; assert
the `(recipients, payload, channels)` it is called with. Real repositories
against the test DB so permission resolution and diff detection are exercised.

- [ ] `create` (no assignee) → dispatch called once with `CREATED`, recipients =
      work-team minus creator, channels `[IN_APP, PUSH]`.
- [ ] `create` **with** assignee → two dispatches: `ASSIGNED` to assignee
      (`[IN_APP, PUSH, EMAIL]`) and `CREATED` to work-team **excluding** that
      assignee.
- [ ] `update` assignee A→B → `ASSIGNED` to B only; A gets nothing.
- [ ] `update` assignee unchanged → **no** dispatch.
- [ ] `update` assignee → self → **no** dispatch.
- [ ] **The headline scenario:** ticket in `in_progress`, actor sets
      `status = waiting` (call 1) then reassigns to B (call 2) → call 1 yields
      **zero** dispatches, call 2 yields exactly **one** `ASSIGNED` to B whose
      payload reports `status = waiting`. Creator receives nothing.
- [ ] `changeStatus` → `done` → `RESOLVED` to creator; `done`→`done` idempotent
      → nothing; `open`→`in_progress` → nothing.
- [ ] `addComment` by assignee → `COMMENT` to creator only.
- [ ] `addComment` with a mention of a third view-capable employee → `MENTION`
      to that employee + `COMMENT` to the non-mentioned party.
- [ ] `addComment` with a mention of a **non-view-capable** employee → mention
      pruned, no dispatch to them.
- [ ] `softDelete` → `DELETED` (`[IN_APP]`) to creator + assignee, not the deleter.

## Layer 3 — E2E (Playwright, persona-based)

New folder `apps/tagea-frontend-e2e/src/tests/support/`. Each test provisions
the personas it needs via `tenantFactory` and verifies the **in-app**
notification (bell / notification center) and the deep-link. Per CLAUDE.md:
role/text selectors only, no `data-testid`, no `waitForSelector`, assert with
`expect(...).toBeVisible()`. Use `test.describe.serial` where one ticket flows
through multiple steps.

Personas (all real entries in `personas.ts`):
`mitarbeiter` = creator/outsider, `personalverwalter` = work-team/assignee,
`traeger-manager` = second work-team member + deleter.

| #   | Scenario                              | Setup personas                                   | Assertion (in-app)                                                                                       |
| --- | ------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| E1  | New ticket reaches the work-team      | `mitarbeiter` (creator), `personalverwalter`     | Creator opens a ticket; logging in as `personalverwalter` shows a "new support ticket" bell entry linking to the detail page. The creator's own bell stays empty. |
| E2  | Assignment notifies only the assignee | `personalverwalter`, `traeger-manager`           | `personalverwalter` assigns the ticket to `traeger-manager`; `traeger-manager` gets an "assigned to you" entry, `personalverwalter` (actor) gets none. |
| E3  | Waiting-then-reassign = one ping      | `mitarbeiter` (creator), `personalverwalter` (A), `traeger-manager` (B) | A moves the ticket to **Waiting** then assigns B. B gets exactly **one** "assigned" entry; the **creator's bell shows nothing** (the core regression guard). |
| E4  | Resolution notifies the creator       | `mitarbeiter` (creator), `personalverwalter`     | `personalverwalter` drags the ticket to **Done**; the creator gets a "resolved" entry; non-terminal moves beforehand produced none. |
| E5  | Comment reaches creator + assignee    | `mitarbeiter` (creator), `personalverwalter` (assignee) | `personalverwalter` comments; the creator gets a "new comment" entry. A separate non-terminal status change in the same test produces no extra entry. |
| E6  | Mention pulls in a third person       | `mitarbeiter` (creator), `personalverwalter` (assignee), `traeger-manager` (mentioned) | `personalverwalter` @mentions `traeger-manager` in a comment; `traeger-manager` gets a "mention" entry and the deep-link opens the ticket (no 403). |
| E7  | Outsider is never a recipient         | `mitarbeiter` (creator), `personalverwalter`, 2nd `mitarbeiter` (outsider) | Through E1–E6 activity, the outsider `mitarbeiter` is **absent from the mention autocomplete** and their bell stays empty. |
| E8  | Self-action is silent                 | `traeger-manager`                                | `traeger-manager` (work-team) creates **and** self-assigns a ticket; their own bell shows neither a "created" nor an "assigned" entry. |
| E9  | Deep-link dismisses on open           | `mitarbeiter` (creator), `personalverwalter`     | After receiving a "resolved" entry, the creator clicks it, lands on the detail page, and the unread badge for that ticket clears. |

### Automated coverage status

The cross-persona scenarios are automated in
`apps/tagea-frontend-e2e/src/tests/support/support-ticket-notifications.spec.ts`
using two isolated browser contexts (actor ⊥ recipient):

- **Automated:** E2 (assignment → assignee bell, actor silent), E8 (self-action
  silent — folded into the assignment test), E6 (mention → colleague bell),
  E7 (outsider + self absent from the mention picker).
- **Documented (manual / future):** E1, E3 (waiting-then-reassign — covered at
  the integration layer by the headline service test), E4, E5, E9. These reuse
  the same two-context harness and are straightforward extensions.

### E2E infrastructure notes

- The notification center / bell is the observable surface; `tenantFactory`
  already provisions Keycloak accounts + employee rows for each persona, so
  cross-persona delivery is testable by logging in as the recipient with
  `loginAs`.
- For multi-recipient work-team scenarios, use the two distinct work-capable
  personas (`personalverwalter` + `traeger-manager`) rather than two identical
  ones.
- The Tiptap description/comment is a `contenteditable` (`.tiptap-content`) —
  fill via `click` + `keyboard.type`, and trigger the mention popup with `@`.
- If push/email need any smoke coverage, do it at Layer 2 with a dispatch spy —
  do not attempt to assert push/email in the browser.
