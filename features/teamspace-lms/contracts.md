# Contracts: Teamspace LMS

## Services (in `apps/tagea-frontend/src/app/pages/lms/services/` + facades)

| Service / Facade     | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `CatalogService`     | Browse available courses (`CourseSummary[]`) |
| `EnrollmentService`  | User's enrolments (`EnrollmentWithCourse[]`) |
| `LearningFacade`     | Progress, lesson navigation                  |
| `CertificateService` | Issued certificates (`CertificateEntry[]`)   |

## Data Models (indicative)

```ts
// apps/tagea-frontend/src/app/pages/lms/services/catalog.service.ts
interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  status: string;
  certificateUrl?: string | null;
  mandatory?: MandatoryInfo;
}

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
}

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

> **Naming convention note:** The LMS feature uses **camelCase** on the wire (unlike most of the rest of the app which uses snake_case). This is because the LMS backend module was written separately. Flutter port must preserve this exact casing per endpoint — no automatic normalization.

> **Progress calculation:** There is no single `progress_percentage` field; instead, `EnrollmentWithCourse.progress[]` contains per-lesson status entries. The completion percentage is computed client-side from `progress.filter(p => p.status === 'completed').length / totalLessons`.

## Routes

Defined in [`apps/tagea-frontend/src/app/pages/lms/lms.routes.ts`](../../../apps/tagea-frontend/src/app/pages/lms/lms.routes.ts):

- `/teamspace/lms` → `LmsHomeComponent`
- `/teamspace/lms/kurse/:courseId` → `CourseOverviewComponent`
- `/teamspace/lms/kurse/:courseId/lernen` → `CoursePlayerComponent`
- `/teamspace/lms/kurse/:courseId/lesson/:lessonId/pdf` → `PdfViewerComponent`
- `/teamspace/lms/verwaltung/*` → admin (❌ Flutter scope)

## Permissions helper

Component exposes `hasVerwaltungPermission()` which wraps `schulungAdminGuard`'s underlying check — used to show/hide the admin entry button in the header.

> **Flutter port note:** mirror a `LmsPermissionsProvider` that exposes the same boolean. The PDF viewer should use `syncfusion_flutter_pdfviewer` or `flutter_pdfview` with an auth-header-aware loader.
