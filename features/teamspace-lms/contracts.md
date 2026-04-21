# Contracts: Teamspace LMS

## Services (in `apps/tagea-frontend/src/app/pages/lms/services/` + facades)

| Service / Facade     | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `CatalogService`     | Browse courses (`CourseSummary[]`) + fetch `CourseDetail` |
| `EnrollmentService`  | User's enrolments, progress + video-progress persistence  |
| `LearningFacade`     | Signal-based state for enrolments + certificates          |
| `CertificateService` | Issued certificates (`CertificateEntry[]`)                |
| `LessonQuizService`  | Per-lesson quiz fetch / attempt / response / submit       |
| `QuizService`        | Course-level quiz fetch / attempt / response / submit     |
| `QuizFacade`         | Signal-based state for quiz flows                         |

## Data Models

```ts
// apps/tagea-frontend/src/app/pages/lms/services/catalog.service.ts
interface MandatoryInfo {
  isMandatory: true;
  renewalIntervalMonths: number;
  status: 'valid' | 'due_soon' | 'overdue' | 'in_progress' | 'pending' | 'never_completed';
  validUntil: string | null;
}

interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  status: string;
  certificateUrl?: string | null;
  mandatory?: MandatoryInfo;
}

interface Lesson {
  id: string;
  title: string;
  type: string;
  order: number;
  durationSeconds?: number | null;
  body?: string | null;
  mediaRef?: string | null;
  lessonQuizId?: string | null;
}

interface CourseModule {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

interface CourseQuiz {
  id: string;
  settings: Record<string, unknown>;
}

interface CourseDetail extends CourseSummary {
  modules: CourseModule[];
  quiz: CourseQuiz | null;
  quizId?: string | null;
}
```

```ts
// apps/tagea-frontend/src/app/pages/lms/services/enrollment.service.ts
// Note: the shape is FLAT (not nested under `enrollment`) and fields are camelCase.
interface EnrollmentWithCourse {
  id: string;
  courseId: string;
  userId: string;
  tenantId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  course: CourseDetail;
  certificateUrl?: string | null;
  progress: Array<{
    id: string;
    lessonId: string;
    status: string;
    updatedAt: string;
  }>;
  videoProgress: Array<{
    id: string;
    enrollmentId: string;
    lessonId: string;
    seconds: number;
    updatedAt: string;
  }>;
  progressSummary: {
    completedLessons: number;
    totalLessons: number;
  };
}

interface ProgressUpdateRequest {
  enrollmentId: string;
  lessonId: string;
  status: 'in_progress' | 'completed';
}

interface ProgressUpdateResult {
  progress: {
    id: string;
    enrollmentId: string;
    lessonId: string;
    status: 'in_progress' | 'completed';
    updatedAt: string;
  };
  enrollmentStatus: string;
  completedAt: string | null;
  certificateUrl: string | null;
}

interface VideoProgressUpdateRequest {
  enrollmentId: string;
  lessonId: string;
  positionSeconds: number;
}

interface VideoProgressEntry {
  id: string;
  enrollmentId: string;
  lessonId: string;
  seconds: number;
  updatedAt: string;
}
```

```ts
// apps/tagea-frontend/src/app/pages/lms/services/certificate.service.ts
interface CertificateEntry {
  id: string;
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  learnerName: string | null;
  institutionName: string | null;
  serial: string;
  issuedAt: string;
  completedAt: string | null;
  pdfUrl: string | null;
}
```

> **Naming convention note:** The LMS feature uses **camelCase** on the wire (unlike most of the rest of the app which uses snake_case). This is because the LMS backend module was written separately. The backend DTOs (`CertificateResponseDto` etc.) and Nest controller bodies are all camelCase. Flutter port must preserve this exact casing per endpoint — no automatic normalization.

> **Progress calculation:** Completion percentage is taken directly from `EnrollmentWithCourse.progressSummary` (`completedLessons / totalLessons`), which is populated by the backend. The `progress[]` array is the per-lesson detail (used for persisting + merging lesson-status updates client-side), but the aggregate counts come from `progressSummary`. There is no `progress_percentage` field on the wire.

## Backend Endpoints

Controller: [`apps/tagea-backend/src/lms/lms.controller.ts`](../../../apps/tagea-backend/src/lms/lms.controller.ts) — mounted at `/lms`, guarded by `@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.EMPLOYEE] })`.

User-facing routes (in Flutter scope):

| Method | Path                                             | Purpose                              |
| ------ | ------------------------------------------------ | ------------------------------------ |
| GET    | `/lms/courses`                                   | List tenant-visible courses          |
| GET    | `/lms/courses/:id`                               | Course detail (modules + lessons)    |
| GET    | `/lms/enrollments/me`                            | Current user's enrolments            |
| POST   | `/lms/enrollments`                               | Create enrolment `{courseId}`        |
| POST   | `/lms/progress`                                  | Update lesson progress               |
| POST   | `/lms/video-progress`                            | Save video position                  |
| GET    | `/lms/lessons/:lessonId/quiz`                    | Lesson quiz                          |
| POST   | `/lms/lessons/:lessonId/quiz/attempts`           | Start lesson quiz attempt            |
| POST   | `/lms/lessons/:lessonId/quiz/attempts/retry`     | Retry lesson quiz                    |
| POST   | `/lms/lesson-quiz-attempts/:attemptId/responses` | Save lesson quiz responses           |
| POST   | `/lms/lesson-quiz-attempts/:attemptId/submit`    | Submit lesson quiz attempt           |
| GET    | `/lms/quizzes/:quizId`                           | Course quiz                          |
| POST   | `/lms/quizzes/:quizId/attempts`                  | Start course quiz attempt            |
| POST   | `/lms/quizzes/:quizId/attempts/retry`            | Retry course quiz                    |
| POST   | `/lms/attempts/:attemptId/responses`             | Save course quiz responses           |
| POST   | `/lms/attempts/:attemptId/submit`                | Submit course quiz attempt           |
| POST   | `/lms/events`                                    | Tracking event                       |
| GET    | `/lms/my-certificates`                           | User's certificates                  |
| GET    | `/lms/certificates/:id`                          | Single certificate                   |
| GET    | `/lms/certificates/:id/download`                 | Redirect to signed PDF URL           |
| GET    | `/lms/certificates/by-enrollment/:enrollmentId`  | Certificate by enrolment             |
| GET    | `/lms/media/:filename`                           | Signed S3 URL (302 redirect or JSON) |

Admin routes (❌ Flutter scope): everything under `/lms/admin/*` + `POST /lms/certificates/issue`.

## Routes

Defined in [`apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`](../../../apps/tagea-frontend/src/app/pages/lms/lms.routes.ts):

- `/teamspace/lms` → `LmsHomeComponent`
- `/teamspace/lms/kurse/:courseId` → `CourseOverviewComponent`
- `/teamspace/lms/kurse/:courseId/lernen` → `CoursePlayerComponent`
- `/teamspace/lms/kurse/:courseId/lesson/:lessonId/pdf` → `PdfViewerComponent`
- `/teamspace/lms/verwaltung/*` → admin (❌ Flutter scope)

## Permissions helper

`LmsHomeComponent.hasVerwaltungPermission()` returns `isSuperAdmin() || isTenantAdmin() || isSchulungAdmin()` from `UnifiedAuthService` — used to show/hide the "Verwaltung" header button. The underlying `schulungAdminGuard` enforces the same three-role check on the `/verwaltung/*` subtree.

> **Flutter port note:** mirror an `LmsPermissionsProvider` that exposes the same boolean. The PDF viewer should use `syncfusion_flutter_pdfviewer` or `flutter_pdfview` with an auth-header-aware loader.
