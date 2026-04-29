# Feature: Teamspace Home

> **Status:** 🚧 Port-prep — drift fixed, ready for v0.2 Flutter port
> **Owner:** ltoenjes (spec) · sven (port-prep)
> **Last updated:** 2026-04-29

## Vision (Elevator Pitch)

Teamspace landing page — an aggregated feed of articles (news, knowledge, documentation, announcements) and events across all teamspaces the employee belongs to. Filter chips per teamspace drive both the feed and the unread counts; sidebar shows next appointment, recent own submissions, quick links, and tenant-wide external links. Mobile collapses the sidebar into a bottom sheet.

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

- [ ] **Given** teamspace selection is committed, **When** the feed endpoint resolves, **Then** the response merges **two** content sources into one chronological list (newest first by `published_at` for articles / `created_at` for events): published articles (`article_type ∈ {news, knowledge, documentation, announcement}`, `target_audience ∈ {employees, all}`, `hide_from_feed = false`, `is_deleted = false`) AND published events (`status = 'published'`, `deleted_at IS NULL`).
- [ ] **Given** the response, **When** mapped to UI cards, **Then** `article_type` discriminates the visual variant: `news` and `announcement` → news card (icon `article`, like + comment footer when enabled); `knowledge` and `documentation` → knowledge card (icon `school`, no like/comment footer); events → event card (icon `celebration`, participants + location footer).
- [ ] **Given** a feed card is clicked, **When** `navigateToSource()` dispatches by `contentType`, **Then** the user is routed to: `/teamspace/news/:id` for `news`, `/teamspace/knowledge-base/article/:id` for `knowledge`, `/teamspace/events/:id` for `event`, `/appointments/:id` for `appointment` (used only by the next-appointment sidebar card, not by feed cards). Any other content type is a no-op.
- [ ] **Given** a feed card has `≥50%` of its bounding box visible in the scroll viewport, **When** the visibility threshold is crossed, **Then** the card is locally marked as read (`isRead = true`), the per-teamspace unread badge decrements by 1, and the read event is enqueued for backend persistence.
- [ ] **Given** read events accumulate while scrolling, **When** the user pauses for `≥500 ms`, **Then** the queue is flushed via a single bulk request to the backend; on flush failure the local cache entries are reverted so a retry on the next scroll is possible.
- [ ] **Given** the feed list contains a transition between unread and read cards, **When** rendered, **Then** a "Du bist auf dem neusten Stand" divider is inserted at the index of the first read card. If all cards are unread, no divider; if all cards are read, the divider is at index 0.
- [ ] **Given** the user reaches the bottom of the loaded list, **When** an infinite-scroll trigger becomes visible AND `hasMore` is true AND no load is in flight, **Then** the next page is fetched (page size **20**) and appended. The backend signals `hasMore` by returning `limit + 1` rows and trimming the sentinel.
- [ ] **Given** all pages have been loaded, **When** the trigger is reached, **Then** an "end-of-feed" marker is shown instead of a spinner.

> **Submissions are not feed cards.** They appear only in the recent-submissions sidebar section — the feed navigation `switch` has no `submission` branch.
>
> **Appointments are not feed cards.** Appointments appear only in the next-appointment sidebar card. The `appointment` `contentType` exists for the read-status enum and for the next-appointment card's deep link, but the feed endpoint never returns `type: 'appointment'` rows.

### Next appointment

- [ ] **Given** the employee has upcoming appointments, **When** `AppointmentsService` resolves, **Then** the sidebar's next-appointment card uses `mapNextAppointmentToCardData`.
- [ ] **Given** the card's `type === 'event'`, **When** it is clicked, **Then** navigate to `/teamspace/events/:id` (no dialog).
- [ ] **Given** the appointment has `booking_category_id` AND the current employee is **not** in `assigned_to_employee_ids`, **When** the card is clicked, **Then** navigate to `/teamspace/buchung/:id` (booker flow).
- [ ] **Given** neither of the above branches matches, **When** the card is clicked, **Then** `AppointmentDialogV2Component` opens as a `MatDialog` with `mode: 'edit'`, `isTeamspaceMode: true`, and the appointment's `teamspace_id`.

### Recent submissions (sidebar)

- [ ] **Given** `CurrentEmployeeService.getCurrentEmployeeId()` is null, **When** the submissions load fires, **Then** the call is short-circuited — the sidebar shows empty (no error, no spinner).
- [ ] **Given** the employee id resolves, **When** `SubmissionsService.getAllSubmissions({ teamspace_id, employeeId })` returns, **Then** the sidebar lists up to **4** most recent submissions (sorted by `submittedAt` desc) mapped via `mapSubmissionToItemData`.
- [ ] **Given** a submission is clicked, **When** navigation resolves, **Then** the user goes to `/teamspace/submissions/:id` with `teamspaceId` as a query param (derived from the submission).

### Quick links

- [ ] **Given** the page renders, **When** quick links are computed, **Then** the list always contains: `events` (`celebration`, → `/teamspace/events`), `appointments` (`calendar_today`, → `/teamspace/kalender`), and `book-offer` (`event_available`, → `/teamspace/kalender/neu`).
- [ ] **Given** the user has any of `news.create` or `news.edit` teamspace permissions, **When** quick links are computed, **Then** the list also contains a `news` entry (`edit_note`, → `/teamspace/redaktion`), inserted between `events` and `appointments`.
- [ ] **Given** the tenant has `proofOfSalary` enabled AND the current employee has access to it, **When** quick links are computed, **Then** the list also contains `proof-of-salary` (`receipt_long`, → `/teamspace/gehaltsnachweise`), appended at the end.

### External contents (tenant-wide links)

- [ ] **Given** the tenant has external contents configured, **When** the listing endpoint resolves, **Then** a sidebar card "Externe Inhalte" renders one tile per entry sorted by `display_order`.
- [ ] **Given** entries reference S3 images (`image_s3_key`), **When** the page loads, **Then** all signed image URLs are resolved in **one** bulk request keyed by content id; entries without an image fall back to a generic link icon.
- [ ] **Given** an external content tile is activated, **When** the user taps/clicks, **Then** `content.url` opens in an external browser tab with `rel="noopener,noreferrer"`. On Flutter mobile, the platform's external URL launcher is used (no in-app browser).

### Like / Comments (news cards only)

- [ ] **Given** the user taps the like footer item on a news card, **When** the handler fires, **Then** the UI updates optimistically: `isLiked` is toggled and `likeCount` is incremented or floored at 0.
- [ ] **Given** the optimistic update has been applied, **When** the API call resolves, **Then** the UI reconciles to the server-returned `is_liked` and `like_count` (so a parallel like by another device cannot drift).
- [ ] **Given** the API call fails, **When** the error is caught, **Then** both `isLiked` and `likeCount` are reverted to their pre-tap values and a non-blocking error indicator is shown.
- [ ] **Given** the user taps the comments footer item, **When** the handler fires, **Then** navigation routes the user to the news detail page (`/teamspace/news/:id`); inline commenting is not in scope for this feature.

### Mobile

- [ ] **Given** the viewport width crosses the mobile breakpoint, **When** `isMobile` becomes true, **Then** the sidebar collapses and a FAB opens a bottom sheet with three logical groupings: quick links + external contents (tab 1), recent submissions (tab 2). The Capacitor reference uses `max-width: 599px`; the Flutter port uses the project-wide `< 720dp` breakpoint (Material 3 compact window class) — see `parity.md` for the divergence rationale.
- [ ] **Given** the bottom sheet is open, **When** the user activates a quick link, an external content tile, a submission item, or "Alle anzeigen", **Then** the sheet dismisses and the same navigation as the desktop sidebar is performed.

## UI States

| State            | When?                                                                           | What does the user see?                              | A11y notes      |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------- |
| Initial loading  | First feed fetch in flight                                                      | Centered spinner + "Lade Beiträge…" copy             | `role="status"` |
| Pagination       | `loadMore` in flight while a page is already rendered                           | Bottom-of-list spinner; existing cards stay visible  | `aria-busy`     |
| Empty            | All selected teamspaces have no items                                           | "Keine Beiträge"-Empty-state with inbox icon         | —               |
| Error            | Any sub-load fails catastrophically                                             | Error panel + retry                                  | `role="alert"`  |
| Populated        | Feed + sidebar render                                                           | Chips + feed list + read-divider + sidebar/FAB       | —               |
| Read divider     | At least one card is read AND at least one is unread (or all read)              | Horizontal rule with "Du bist auf dem neusten Stand" | —               |
| End of feed      | `allLoaded` is true                                                             | Bottom marker with check_circle icon and "Alles geladen" | —           |

## Non-Goals

- **Creating content** from this page — news/events/submissions each have their own creation flows.
- **Submissions list view** — lives at `/teamspace/submissions` (see [teamspace-submissions](../teamspace-submissions/spec.md)).
- **Appointments in the feed** — appointments are sidebar-only; only events and articles populate the feed.
- **Cross-teamspace search** — only filter-chip-based scoping.
- **Inline commenting** — like has inline UI, comments do not. Tapping the comments footer navigates to the article detail page.

## Edge Cases

- **User has a single teamspace** — filter chips render normally (single teamspace + "Alle"); both behave identically. Selecting "Alle" resets selection to the full set.
- **All teamspaces deselected** — the feed and recent-submissions calls short-circuit to empty without hitting the network.
- **Teamspace inactive or feed-modules all off** — teamspaces with `is_active = false`, or with `news = events = knowledge = false`, are excluded from filter chips entirely (but the underlying list of accessible teamspaces still includes them, so other features may still see them).
- **Unread counts vs. local cache drift** — counts are recomputed on chip change and on auto-mark-as-read; no realtime server push. After background activity (e.g. another device read items), the next chip-change refresh reconciles.
- **Mark-as-read failure** — when the bulk POST fails, affected cache entries are evicted so the items become eligible to be marked again on a later flush.
- **`getCurrentEmployeeId()` returns null** — the recent-submissions load short-circuits to an empty list (no spinner, no error) so the sidebar slot stays clean. This protects against client-portal users / not-yet-resolved sessions.
- **External content image bulk fetch returns nulls** — entries whose key resolves to a `null` URL fall back to the generic link icon.
- **Translated content available** — when the user's active language ≠ `de` AND a translation row exists, `display_title` and `display_description` are used in place of the originals; a translate-icon is shown next to the title. If only one of the two fields has a translation, the available translated field is used and the missing one falls back to original.
- **Article requires acknowledgment** — `requires_acknowledgment: true` shows an inline chip; tapping the card routes to the detail page where the acknowledgment is performed (this page does not perform the ack itself).

## Permissions & Tenant/Institution

- **Tenant permission required:** `tenant.teamspace_home.view`. Enforced server-side and via `tenantPermissionGuard` (`requiredTenantPermission: 'teamspace_home.view'`).
- **Feature guard:** `teamspaceFeatureGuard` — the tenant must have the `teamspace` feature enabled. If teamspace is disabled but `institutions` is enabled, redirect to `/dashboard`; otherwise to `/blocked-access`.
- **Fallback redirect:** when the user lacks `teamspace_home.view` but holds another teamspace permission (e.g. `teamspace_news.view`), redirect to the first matching destination from the fallback order: news → submissions → events → calendar → directory → knowledge → lms.
- **Quick-link visibility:** the news-editor entry requires `news.create` OR `news.edit` (per-teamspace permission, evaluated via `AuthorizationStore.hasAnyTeamspacePermissionOf`). The proof-of-salary entry requires the `proofOfSalary` tenant feature AND a per-employee access flag.
- **Institution context:** derived implicitly from the employee's teamspace memberships; this page is teamspace-scoped and does not request an institution id.
- **Image authentication:** feed-card and external-content images are loaded as authenticated requests (`Authorization: Bearer <accessToken>` + `X-Tenant-ID: <tenantId>` headers). The Flutter port must not use `Image.network` directly; use an authenticated image provider with two-tier (memory + persistent) caching. See `parity.md`.

## Notifications (Push / In-App)

- Per-teamspace unread counts drive filter-chip badges.
- Push notifications for news / events deep-link to the respective detail routes, not to this aggregator.
- The badge counts on this page are not real-time — they reflect the snapshot at chip-change time and at every auto-mark-as-read.

## i18n Keys

> User-facing strings remain in German. Keys live under `teamspacePage.*` in the central translation file.

| Key prefix                        | Used for                                                                |
| --------------------------------- | ----------------------------------------------------------------------- |
| `teamspacePage.title`             | Page header title                                                       |
| `teamspacePage.subtitle`          | Page header subtitle                                                    |
| `teamspacePage.helpTooltip`       | Help-button tooltip text                                                |
| `teamspacePage.filters.all`       | "Alle" filter chip                                                      |
| `teamspacePage.feed.loading`      | Initial spinner copy                                                    |
| `teamspacePage.feed.loadingMore`  | Pagination spinner copy                                                 |
| `teamspacePage.feed.empty`        | Empty-state copy                                                        |
| `teamspacePage.feed.upToDate`     | "Du bist auf dem neusten Stand" divider                                 |
| `teamspacePage.feed.allLoaded`    | End-of-feed marker                                                      |
| `teamspacePage.errors.loadFeed`   | Feed load error                                                         |
| `teamspacePage.errors.loadTeamspaces` | Teamspaces load error                                               |
| `teamspacePage.errors.loadSubmissions` | Submissions load error                                             |
| `teamspacePage.sidebar.nextAppointment` | Sidebar card title                                                |
| `teamspacePage.sidebar.quickLinks` | Sidebar card title                                                     |
| `teamspacePage.sidebar.externalContent` | Sidebar card title                                                |
| `teamspacePage.sidebar.submissions.{title,empty,loading,viewAll}` | Recent submissions sidebar |
| `teamspacePage.quickLinks.{events,calendar,bookOffer,newsEditor,proofOfSalary}` | Quick-link labels |
| `teamspacePage.appointmentCard.{empty,bookButton,noLocation,openAppointment,openMandatoryFields}` | Next-appointment card |
| `teamspacePage.mobile.openQuickActions` | FAB aria-label                                                    |
| `submissionsPage.statuses.{awaitingApproval,pending,inReview,closed,rejected}` | Submission status labels |
| `submissionsPage.relativeTime.{minute,minutes,hour,hours,day,days}` | Relative-time strings   |
| `feedCard.*`                      | Feed-card metadata labels (`like`, `comments`, `participants`, `online`, `news`, `event`, `unknown`, `notAssigned`, `forClient`, `translated`, `readMore`, `register`, `default`, `knowledgeBase`, `documentation`, `announcement`, `minutes`, `appointment`, `showDetails`) |
| `article.{acknowledged,acknowledgmentRequired}` | Acknowledgment chip labels                              |

> **Capacitor-bug note:** the Capacitor `TeamspaceMobileSheetComponent` has 7 hardcoded German strings ("Schnellaktionen", "Schließen", "Schnellzugriffe", "Meldungen", "Externe Inhalte", "Meldungen werden geladen…", "Keine Meldungen vorhanden"). The Flutter port MUST NOT replicate this — every visible string goes through Slang.

## Offline Behavior

**Flutter-specific (informative; not enforced in v1):**

- Cached feed visible offline; mark-as-read events queue locally and flush when connectivity returns.
- Dialogs (next-appointment edit) and like/acknowledge actions require online and surface a clear "Aktion nicht verfügbar"-hint when offline.

## References

- **Angular implementation:** [`apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.ts) (~931 LoC; refactor candidate but behaviorally authoritative)
- **Template:** [`teamspace-v2-page.component.html`](../../../apps/tagea-frontend/src/app/pages/teamspace/teamspace-v2-page.component.html)
- **Services:** `FeedService`, `TeamspaceService`, `AppointmentsService`, `SubmissionsService`, `ExternalContentsService`, `TeamspaceUnreadCountService`, `ContentReadStatusService`, `ArticleService`, `AuthorizationStore`, `CurrentEmployeeService`, `TenantFeaturesService`, `LanguageService`, `SecureImageService`, `HtmlSanitizerService`
- **Mobile sheet:** `TeamspaceMobileSheetComponent` (caveat: hardcoded German — see i18n note above)
- **Mappers:** `feedItemToFeedCard`, `mapSubmissionToItemData`, `mapNextAppointmentToCardData`
- **E2E tests:** archived under `apps/tagea-frontend-e2e/.archive/2026-04-22-rebuild/tests/feed-teamspace.spec.ts` — to be re-implemented as Flutter `integration_test/teamspace_home_test.dart`
- **Backend endpoints:** see [contracts.md](./contracts.md)
