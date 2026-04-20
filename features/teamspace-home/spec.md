# Feature: Teamspace Home

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Teamspace landing page — an aggregated feed of news, events, submissions, and external content across all teamspaces the employee belongs to. Filter chips per teamspace drive both the feed and the unread counts; sidebar shows next appointment, quick links, and open submissions. Mobile collapses sidebar into a bottom sheet.

## User Stories

- As a **staff member** I want a single place that shows what's new across my teamspaces, so that I don't have to check each one individually.
- As a **staff member** I want per-teamspace unread badges, so that I can triage attention across multiple teamspaces.
- As a **mobile user** I want the sidebar in a bottom sheet, so that the feed gets full width.

## Acceptance Criteria

### Teamspace filter chips

- [ ] **Given** the user has access to multiple teamspaces, **When** the page loads, **Then** filter chips render one-per-teamspace — filtered to those with `is_active` and at least one active module (`news`, `events`, or `knowledge`).
- [ ] **Given** `TeamspaceUnreadCountService` has per-teamspace unread counts, **When** chips render, **Then** each chip shows a numeric badge if the teamspace has unread items.
- [ ] **Given** an "All" chip is shown, **When** rendered, **Then** its badge is the sum of per-teamspace counts.
- [ ] **Given** the user toggles a teamspace chip, **When** the selection changes, **Then** the feed reloads filtered by the active set.

### Feed

- [ ] **Given** teamspace selection is committed, **When** `FeedService` loads, **Then** cards for news + events + appointments + knowledge-base articles are merged into one chronological feed.
- [ ] **Given** a feed card is clicked, **When** `navigateToSource()` dispatches by `contentType`, **Then** the user is routed to: `/appointments/:id` for `appointment`, `/teamspace/news/:id` for `news`, `/teamspace/knowledge-base/article/:id` for `knowledge`, `/teamspace/events/:id` for `event`. Any other content type is a no-op.
- [ ] **Given** a feed card scrolls into view, **When** `ContentReadStatusService.markAsRead(type, id)` fires, **Then** the unread count decrements locally.

> **Submissions are not feed cards.** They appear only in the sidebar section below — the feed navigation `switch` has no `submission` branch.

### Next appointment

- [ ] **Given** the employee has upcoming appointments, **When** `AppointmentsService` resolves, **Then** the sidebar's next-appointment card uses `mapNextAppointmentToCardData`.
- [ ] **Given** the card's `type === 'event'`, **When** it is clicked, **Then** navigate to `/teamspace/events/:id` (no dialog).
- [ ] **Given** the appointment has `booking_category_id` AND the current employee is **not** in `assigned_to_employee_ids`, **When** the card is clicked, **Then** navigate to `/teamspace/buchung/:id` (booker flow).
- [ ] **Given** neither of the above branches matches, **When** the card is clicked, **Then** `AppointmentDialogV2Component` opens as a `MatDialog` with `mode: 'edit'`, `isTeamspaceMode: true`, and the appointment's `teamspace_id`.

### Recent submissions (sidebar)

- [ ] **Given** `CurrentEmployeeService.getCurrentEmployeeId()` is null, **When** the submissions load fires, **Then** the call is short-circuited — the sidebar shows empty (no error, no spinner).
- [ ] **Given** the employee id resolves, **When** `SubmissionsService` returns, **Then** the sidebar lists up to N recent submissions (verify exact cap) mapped via `mapSubmissionToItemData`.
- [ ] **Given** a submission is clicked, **When** navigation resolves, **Then** the user goes to `/teamspace/submissions/:id`.

### Quick links + external content

- [ ] **Given** the employee's teamspaces have external content configured, **When** `ExternalContentsService` resolves, **Then** the sidebar shows a quick-links list.

### Mobile

- [ ] **Given** the viewport is `max-width: 599px`, **When** `isMobile()` is true, **Then** the sidebar collapses and a FAB opens `TeamspaceMobileSheetComponent`.

## UI States

| State     | When?                                 | What does the user see?         | A11y notes      |
| --------- | ------------------------------------- | ------------------------------- | --------------- |
| Loading   | Initial fetch                         | Full-page spinner               | `role="status"` |
| Error     | Any sub-load fails catastrophically   | Error panel + retry             | `role="alert"`  |
| Populated | Feed + sidebar render                 | Chips + feed list + sidebar/FAB | —               |
| Empty     | All selected teamspaces have no items | Empty state illustration        | —               |

## Non-Goals

- **Creating content** from this page — news/events/submissions each have their own creation flows.
- **Submissions list view** — lives at `/teamspace/submissions` (see [teamspace-submissions](../teamspace-submissions/spec.md)).
- **Cross-teamspace search** — only filter-chip-based scoping.

## Edge Cases

- **User has a single teamspace** — filter chips may or may not render; verify product intent.
- **Teamspace modules disabled** — e.g. `news: false, events: false, knowledge: false` teamspaces are excluded from chips entirely.
- **`TeamspaceUnreadCountService` stale** — counts are recomputed on chip change and on auto-mark-as-read; no realtime push.
- **Managed-by-service read state** — `ContentReadStatusService` uses `ContentType` enum; each card type maps to a distinct type.

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_home.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Institution context:** derived from the employee's teamspace memberships.

## Notifications (Push / In-App)

- Per-teamspace unread counts drive filter-chip badges.
- Push notifications for news/events deep-link to the respective detail routes, not to this aggregator.

## i18n Keys

> User-facing strings remain in German. Owned by the external template.

## Offline Behavior

**Flutter-specific:**

- Cached feed visible offline; scroll-to-mark-read queues locally.
- Dialogs and submission navigation require online.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts)
- **Template:** [`teamspace-v2-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.html)
- **Services:** `FeedService`, `TeamspaceService`, `AppointmentsService`, `SubmissionsService`, `ExternalContentsService`, `TeamspaceUnreadCountService`, `ContentReadStatusService`, `ArticleService`
- **Mobile sheet:** `TeamspaceMobileSheetComponent`
- **Mappers:** `feedItemToFeedCard`, `mapSubmissionToItemData`, `mapNextAppointmentToCardData`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
