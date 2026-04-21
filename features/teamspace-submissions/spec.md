# Feature: Teamspace Submissions

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff-facing hub for creating and tracking submissions (e.g. incident reports, equipment requests) across teamspaces. List view with filter chips per teamspace + status, a create flow driven by dynamic category-defined custom fields, and a detail route for reviewing a single submission.

## User Stories

- As a **staff member** I want to submit a categorized report, so that the right handlers get it.
- As a **staff member** I want to see the status of my submissions, so that I know when something's resolved.
- As a **staff member** I want a deep-linked creation flow from a notification, so that I can act on a prompt quickly.

## Acceptance Criteria

### List (`/teamspace/submissions`)

- [ ] **Given** the user opens the page, **When** `SubmissionsService` + `SubmissionCategoriesService` + `TeamspaceService` resolve, **Then** submissions render as `TageaSubmissionCardComponent` cards with status, category, submitter, and timestamp.
- [ ] **Given** multiple teamspaces are accessible, **When** filter chips render, **Then** one chip per teamspace is shown; an active filter scopes the list.
- [ ] **Given** status chips render, **When** a status chip is selected (e.g. `awaiting_approval`, `pending`, `in_review`, `closed`, `rejected`), **Then** the list additionally filters on `SubmissionStatus`.
- [ ] **Given** a card is tapped, **When** navigation resolves, **Then** open `/teamspace/submissions/:id`.
- [ ] **Given** a "New submission" CTA fires, **When** the user is on the list, **Then** they can pick a category and the creation form for that category renders (dynamic fields based on `FieldGroup[]`).

### Deep link new (`/teamspace/submissions/new/:teamspaceId/:categoryId`)

- [ ] **Given** a deep link carries a teamspace + category, **When** the route loads with `data.mode === 'deepLink'`, **Then** the creation form prefills that teamspace + category and skips the picker step.

### Deep link new (`/teamspace/submissions/new/:categoryId`)

- [ ] **Given** the deep link carries only a category, **When** the route loads, **Then** the user is prompted to pick a teamspace before the creation form proceeds.

### Detail (`/teamspace/submissions/:id`)

- [ ] **Given** a submission id is present, **When** the detail page loads with `data.mode === 'global'`, **Then** the submission's content, attachments, history, and status are shown (read-only for the submitter).

## UI States

| State           | When?                | What does the user see?            | A11y notes      |
| --------------- | -------------------- | ---------------------------------- | --------------- |
| Loading         | Initial fetch        | Spinner                            | `role="status"` |
| Empty           | No submissions yet   | Empty state + "New submission" CTA | —               |
| Populated       | Cards rendered       | Chips + cards + "New" CTA          | —               |
| Creating (form) | In the category form | Dynamic field group + submit       | —               |
| Submitting      | Submit in-flight     | Button disabled + spinner          | `aria-busy`     |
| Error           | Fetch/submit failure | Error banner + retry               | `role="alert"`  |

## Non-Goals

- **Submission-categories configuration** — handled under `/teamspace/submissions/konfiguration` (teamspace-admin surface, marked ❌ for Flutter).
- **Global admin management** — handled under `/teamspace/submissions/verwaltung` (admin-only, ❌ for Flutter).
- **Bulk actions** — not implemented.

## Edge Cases

- **Deep link with unknown category/teamspace** — form falls back to picker or shows a friendly error.
- **Category custom fields change between list and open** — the form uses the current `FieldGroup[]`; historical submissions are displayed with their stored values regardless.
- **Status transitions** — `SubmissionStatus` enum values live in the model; UI chips must mirror exactly (no implicit translations).

## Permissions & Tenant/Institution

- **Required permission:** `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_submissions.view'`.
- **Feature guard:** `teamspaceFeatureGuard`.
- **Institution context:** derived from the chosen teamspace.

## Notifications (Push / In-App)

- Status-change notifications deep-link to the detail route.
- Submissions influence the teamspace-home badge via `TeamspaceUnreadCountService`.

## i18n Keys

> User-facing strings remain in German. Owned by the external template and category metadata.

## Offline Behavior

**Flutter-specific:**

- List view cached offline.
- Creating a submission requires online; large attachments queue on reconnect (or block — decide during port).

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.ts)
- **Template:** [`teamspace-submissions-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-submissions-page.component.html)
- **Detail:** [`submission-detail-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/submission-detail-page.component.ts)
- **Services:** `SubmissionsService`, `SubmissionCategoriesService`, `TeamspaceService`
- **Models:** `Submission`, `SubmissionStatus`, `SubmissionCategory`, `FieldGroup`
- **Card:** `TageaSubmissionCardComponent`
- **Field renderer:** `TageaCustomFieldsComponent`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
