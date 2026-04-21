# Feature: Teamspace LMS (Lernplattform)

> **Status:** 🚧 Spec drafted — awaiting review
> **Owner:** ltoenjes
> **Last updated:** 2026-04-20

## Vision (Elevator Pitch)

Staff learning platform: browse available courses, view progress on enrolled ones, collect certificates, launch the course player for videos/quizzes/PDF lessons. Admin surface (`/lms/verwaltung/*`) is explicitly out of scope for Flutter.

## User Stories

- As a **staff member** I want to see courses I can take, so that I can plan my training.
- As a **staff member** I want to resume a course I already started, so that I don't lose progress.
- As a **staff member on a lesson** I want a distraction-free player for videos/PDFs, so that learning feels focused.
- As a **staff member** I want to download certificates I've earned, so that I can store proof.

## Acceptance Criteria

### LMS Home (`/teamspace/lms`)

- [ ] **Given** the user opens LMS, **When** `CatalogService` + `LearningFacade` + `CertificateService` resolve, **Then** the page renders: header with course count, a **stats grid** (completed / in-progress / not-started / overall-progress%), a single unified course grid (enrolled + not-enrolled courses in one list, with progress bars rendered per card where an enrollment exists), and a certificates / history section below.
- [ ] **Given** the stats grid renders, **When** computed signals resolve, **Then** it shows four tiles: `completedCourses()`, `inProgressCourses()`, `notStartedCourses()`, and `overallProgress()` (percentage across all enrolments).
- [ ] **Given** `hasVerwaltungPermission()` is true (the current user is a **superAdmin, tenantAdmin, or schulungAdmin**), **When** the header renders, **Then** a "Verwaltung" button is visible that routes to `/teamspace/lms/verwaltung`. The underlying `schulungAdminGuard` only gates the child route, so the button visibility is broader than the route gate.
- [ ] **Given** a course card is tapped, **When** navigation resolves, **Then** open `/teamspace/lms/kurse/:courseId` (overview).

### Course Overview (`/teamspace/lms/kurse/:courseId`)

- [ ] **Given** a course id is present, **When** the overview loads, **Then** course description, modules/lessons, prerequisites, and progress are shown.
- [ ] **Given** the user presses "Lernen" (or equivalent), **When** action fires, **Then** navigate to `/teamspace/lms/kurse/:courseId/lernen` (course player).

### Course Player (`/teamspace/lms/kurse/:courseId/lernen`)

- [ ] **Given** the player loads, **When** lessons render, **Then** the user can advance through video / PDF / quiz lessons in order.
- [ ] **Given** a PDF lesson is entered, **When** the user opens it, **Then** navigate to `/teamspace/lms/kurse/:courseId/lesson/:lessonId/pdf`.
- [ ] **Given** a lesson is completed, **When** progress is persisted (`POST /lms/progress`), **Then** the backend response updates `enrollmentStatus`, `completedAt`, and `certificateUrl`; the client recomputes the enrolment's percentage from `progressSummary.completedLessons / progressSummary.totalLessons` so it is reflected on next visit to LMS Home.

### PDF Viewer (`/teamspace/lms/kurse/:courseId/lesson/:lessonId/pdf`)

- [ ] **Given** the viewer loads, **When** the PDF is fetched, **Then** it renders inline (authenticated source).
- [ ] **Given** the user finishes reading (or presses a "Completed" action), **When** the event fires, **Then** the lesson is marked complete and the player returns to the course flow.

## UI States

| State                | When?                            | What does the user see?                                                    | A11y notes      |
| -------------------- | -------------------------------- | -------------------------------------------------------------------------- | --------------- |
| Loading              | Initial fetch                    | Spinner with localized label                                               | `role="status"` |
| Error                | Fetch failure                    | Error panel + retry                                                        | `role="alert"`  |
| Empty (no courses)   | No enrolled + no available       | Empty state with encouragement                                             | —               |
| Populated            | Courses rendered                 | Header → stats grid (4 tiles) → unified course grid → certificates/history | —               |
| Admin (extra button) | `hasVerwaltungPermission()` true | "Verwaltung" button in header                                              | —               |

## Non-Goals

- **LMS admin** (`/teamspace/lms/verwaltung/**`) — marked ❌ for Flutter (web-only).
- **Course authoring** — same, admin-only.
- **Offline course download** — not implemented on web; Flutter could add later but not in scope.

## Edge Cases

- **Course deleted mid-progress** — detail route gracefully 404s; user returns to LMS home.
- **Certificate issuance lag** — some certificates are issued asynchronously; home shows "Ausstehend" until ready.
- **Pflichtunterweisungen (compliance courses)** — highlighted specially in admin, but appear in normal course list for users.

## Permissions & Tenant/Institution

- **Required permissions:**
  - Route parent: `tenantPermissionGuard` with `requiredTenantPermission: 'teamspace_lms.view'`
  - Feature gates: `teamspaceFeatureGuard`, `schulungenFeatureGuard`
  - Admin: `schulungAdminGuard` (only for `/verwaltung/*` subtree — ❌ Flutter scope)
- **Institution context:** courses are tenant-scoped by `CatalogService`.

## Notifications (Push / In-App)

- Compliance-course due reminders may deep-link here (`courseId` in query) — verify with backend.

## i18n Keys

> User-facing strings remain in German.

- `lms.home.{title,availableCourses,manage,loading,error}`
- Rest owned by player + detail templates.

## Offline Behavior

**Flutter-specific:**

- Cached course list offline; player requires online to fetch lesson media.
- Consider caching PDFs for offline reading as future enhancement.

## References

- **LMS home:** [`apps/tagea-frontend/src/app/pages/lms/components/lms-home.component.ts`](../../../apps/tagea-frontend/src/app/pages/lms/components/lms-home.component.ts)
- **Course overview:** [`course-overview.component.ts`](../../../apps/tagea-frontend/src/app/pages/lms/components/course-overview.component.ts)
- **Course player:** [`course-player.component.ts`](../../../apps/tagea-frontend/src/app/pages/lms/components/learning/course-player.component.ts)
- **PDF viewer:** [`pdf-viewer.component.ts`](../../../apps/tagea-frontend/src/app/pages/lms/components/learning/pdf-viewer.component.ts)
- **Route file:** [`apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`](../../../apps/tagea-frontend/src/app/pages/lms/lms.routes.ts)
- **Services / facades:** `CatalogService`, `LearningFacade`, `EnrollmentService`, `CertificateService`
- **E2E tests:** _(to be identified)_
- **Backend endpoints:** see [contracts.md](./contracts.md)
