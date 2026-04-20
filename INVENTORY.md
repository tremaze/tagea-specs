# Feature Inventory

Derived from the Angular router tree — this is the **user-facing surface** that the Flutter app must mirror.

> **How this file is used:**
>
> - **Source of truth** for what features exist (perspective: user navigation, not code structure)
> - **Prioritization input** — `Port Priority` column drives Flutter port order (P0 → P2, ❌ = non-goal)
> - **Spec coverage tracker** — `Spec?` column links to `features/<slug>/` once a spec is written
>
> **Keeping it fresh:** when a route is added/removed in `apps/tagea-frontend/src/app/**/*.routes.ts`, update this file in the same PR.
>
> **Priority legend (assigned by Claude, revise per domain knowledge):**
>
> - **P0** — Flutter MVP: end-user client-facing flows (Client Portal) + Auth
> - **P1** — Flutter v1 extensions: cross-cutting shared components, secondary user flows, foundational platform features
> - **P2** — Later phases: staff-facing web-first features
> - **❌** — Non-goal for Flutter (web-only admin surfaces, dev tools)
>
> **Route files covered:**
> `app.routes.ts`, `routes/public.routes.ts`, `routes/institution.routes.ts`, `routes/teamspace.routes.ts`, `routes/client-portal.routes.ts`, `routes/case.routes.ts`, `routes/profile.routes.ts`, `pages/files/files.routes.ts`, `pages/lms/lms.routes.ts`, `pages/einstellungen/**`, super-admin module.

## Cross-Cutting Pages (Mode-Based Reuse)

These components are mounted at multiple routes with different modes. **One spec each**, with an explicit "Modes" section.

| Feature            | Slug                 | Mounts                                                                                                                     | Spec?                                                       | Port Priority |
| ------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------- |
| Appointment Detail | `appointment-detail` | `einrichtung/:id/staff/appointments/:id` (staff) · `teamspace/buchung/:id` (booker) · `client-portal/termine/:id` (client) | [appointment-detail](./features/appointment-detail/spec.md) | **P0** ✅     |
| News Detail        | `news-detail`        | `teamspace/news/:id` · `client-portal/news/:id` (`data.context`)                                                           | [news-detail](./features/news-detail/spec.md)               | **P0** ✅     |
| Knowledge Base     | `knowledge-base`     | `einrichtung/:id/knowledge-base/**` · `teamspace/knowledge-base/**`                                                        | [knowledge-base](./features/knowledge-base/spec.md)         | **P2** ✅     |
| Redaktion (Editor) | `redaktion`          | `einrichtung/:id/redaktion/**` · `teamspace/redaktion/**` · `einrichtung/:id/klienten-news/**`                             | [redaktion](./features/redaktion/spec.md)                   | **P2** ✅     |

## Public (Pre-Auth)

Routes under `PUBLIC_ROUTES`, no auth guard. Layout: `PublicMainComponent`.

| Feature             | Slug                 | Route                                   | Component                      | Spec?                                                       | Port Priority |
| ------------------- | -------------------- | --------------------------------------- | ------------------------------ | ----------------------------------------------------------- | ------------- |
| Login / Auth Entry  | `login`              | (implicit `/` → `rootRedirectGuard`)    | —                              | [login](./features/login/spec.md)                           | **P0** ✅     |
| Auth Callback       | `auth-callback`      | `/auth/callback`                        | `AuthCallbackComponent`        | [auth-callback](./features/auth-callback/spec.md)           | **P0** ✅     |
| Session Expired     | `session-expired`    | `/session-expired`                      | `SessionExpiredComponent`      | [session-expired](./features/session-expired/spec.md)       | **P0** ✅     |
| Auth Error          | `auth-error`         | `/auth-error`                           | `AuthErrorComponent`           | [auth-error](./features/auth-error/spec.md)                 | **P1** ✅     |
| No Tenant           | `no-tenant`          | `/no-tenant`                            | `NoTenantComponent`            | [no-tenant](./features/no-tenant/spec.md)                   | **P1** ✅     |
| Blocked Access      | `blocked-access`     | `/blocked-access`                       | `BlockedAccessComponent`       | [blocked-access](./features/blocked-access/spec.md)         | **P1** ✅     |
| Password Reset      | `password-reset`     | `/public/password-reset/:userId/:token` | `PublicPasswordSetupComponent` | [password-reset](./features/password-reset/spec.md)         | **P1** ✅     |
| Welcome / Landing   | `landing-page`       | `/welcome` (`/landing` redirects)       | `LandingPageComponent`         | ⏳                                                          | P2            |
| Email Verified      | `email-verification` | `/public/email-verified`                | `EmailVerificationComponent`   | [email-verification](./features/email-verification/spec.md) | **P1** ✅     |
| Public Booking      | `public-booking`     | `/booking`                              | `BookingPageComponent`         | ⏳                                                          | P2            |
| Public Registration | `public-register`    | `/public/register`                      | `PublicRegisterPageComponent`  | [public-register](./features/public-register/spec.md)       | **P1** ✅     |
| Public Video Join   | `public-video-join`  | `/public/video/:token`                  | `PublicVideoJoinComponent`     | ⏳                                                          | P2            |

## Secure Shell (Auth Required, No Employee Approval)

Gated by `AUTH_GUARD`. Layout: `SecureShellComponent`. These routes work even for pending employees.

| Feature           | Slug                | Route                  | Component                           | Guards                                | Spec?                                                     | Port Priority |
| ----------------- | ------------------- | ---------------------- | ----------------------------------- | ------------------------------------- | --------------------------------------------------------- | ------------- |
| Awaiting Approval | `awaiting-approval` | `/awaiting-approval`   | `EmployeeAwaitingApprovalComponent` | `pendingEmployeeGuard`                | [awaiting-approval](./features/awaiting-approval/spec.md) | **P1** ✅     |
| Chat Room         | `chat-room`         | `/chat/room/:roomId`   | `CHAT_ROOM_ROUTE` (`@tagea/chat`)   | `permissionGuard`, `chatFeatureGuard` | [chat-room](./features/chat-room/spec.md)                 | **P1** ✅     |
| Chat Invite       | `chat-invite`       | `/chat/invite/:roomId` | `CHAT_INVITE_ROUTE` (`@tagea/chat`) | `permissionGuard`, `chatFeatureGuard` | [chat-invite](./features/chat-invite/spec.md)             | **P1** ✅     |

## Secure Main (Employee Approved)

Gated by `activeEmployeeGuard`. Layout: `SecureMainComponent`.

### Top-Level

| Feature              | Slug               | Route               | Component                                | Guards                                | Spec?                                 | Port Priority       |
| -------------------- | ------------------ | ------------------- | ---------------------------------------- | ------------------------------------- | ------------------------------------- | ------------------- |
| AI Chat              | `ai-chat`          | `/ai-chat`          | `AiChatPageComponent`                    | `aiChatFeatureGuard`                  | [ai-chat](./features/ai-chat/spec.md) | **P1** ✅           |
| Chat                 | `chat`             | `/chat`             | `ChatPageComponent` (`CHAT_BASE_ROUTES`) | `permissionGuard`, `chatFeatureGuard` | [chat](./features/chat/spec.md)       | **P1** ✅           |
| Super Admin          | `super-admin`      | `/super-admin/**`   | lazy `SuperAdminModule`                  | `permissionGuard: admin.access`       | ⏳                                    | ❌                  |
| Files (Global)       | `files-global`     | `/dateien`          | lazy `FILES_ROUTES`                      | `fileStorageFeatureGuard`             | ⏳                                    | P2                  |
| Employee Profile     | `employee-profile` | `/employee-profile` | `EmployeeProfileComponent`               | `UnsavedChangesGuard`                 | ⏳                                    | P2                  |
| Einstellungen (Root) | `einstellungen`    | `/einstellungen/**` | lazy `EINSTELLUNGEN_ROUTES`              | `einstellungenGuard`                  | ⏳                                    | (see sub-inventory) |

### Institution Scope — `/einrichtung/:institutionId/*`

Gated by `institutionUrlGuard`. All child routes receive the active `institutionId`.

| Feature                    | Slug                 | Route                        | Component                          | Permission                                    | Spec?                                     | Port Priority |
| -------------------------- | -------------------- | ---------------------------- | ---------------------------------- | --------------------------------------------- | ----------------------------------------- | ------------- |
| Dashboard                  | `dashboard`          | `.../dashboard`              | `DashboardPageComponent`           | `dashboard.view`                              | [dashboard](./features/dashboard/spec.md) | **P2** ✅     |
| Tasks                      | `tasks`              | `.../tasks`                  | `TasksPageComponent`               | `institution.access` + `tasksFeatureGuard`    | [tasks](./features/tasks/spec.md)         | **P2** ✅     |
| Appointment Detail (Staff) | `appointment-detail` | `.../staff/appointments/:id` | (see Cross-Cutting)                | `appointments.view` (mode: staff)             | ⏳                                        | (covered)     |
| Calendar                   | `calendar`           | `.../calendar`               | `CalendarPageComponent`            | `appointments.view`                           | [calendar](./features/calendar/spec.md)   | **P2** ✅     |
| Clients List               | `clients`            | `.../clients`                | `ClientsPageComponent`             | `clients.view`                                | [clients](./features/clients/spec.md)     | **P2** ✅     |
| Bulk Messaging             | `bulk-messaging`     | `.../bulk-messaging`         | `BulkMessagingPageComponent`       | `clients.view` + `clientMessagesFeatureGuard` | ⏳                                        | P2            |
| Cases List                 | `cases`              | `.../cases`                  | `CasesPageComponent`               | `cases.view` + `caseFeatureGuard`             | [cases](./features/cases/spec.md)         | **P2** ✅     |
| Case Detail                | `case-detail`        | `.../cases/:id/**`           | `CaseDetailLayoutComponent` + tabs | `UnsavedChangesGuard`                         | ⏳                                        | P2            |
| Employees List             | `employees`          | `.../employees`              | `EmployeesPageComponent`           | `employees.view`                              | ⏳                                        | P2            |
| Pending Employees          | `pending-employees`  | `.../pending-employees`      | `PendingEmployeesPageComponent`    | `employees.edit`                              | ⏳                                        | P2            |
| PEP                        | `pep`                | `.../pep`                    | `PepPageComponent`                 | `employees.view` + `pepFeatureGuard`          | ⏳                                        | P2            |
| Billing                    | `billing`            | `.../billing`                | `BillingPageComponent`             | `cases.edit` + `billingFeatureGuard`          | ⏳                                        | ❌            |
| Profile Detail             | `profile-detail`     | `.../profile/:id/**`         | `ProfileLayoutComponent` + tabs    | `clients.view`                                | ⏳                                        | P2            |
| Reports                    | `reports`            | `.../reports`                | lazy `ReportsModule`               | `reports.view` + `reportsFeatureGuard`        | ⏳                                        | P2            |
| Knowledge Base (Inst.)     | `knowledge-base`     | `.../knowledge-base/**`      | (see Cross-Cutting)                | —                                             | ⏳                                        | (covered)     |
| Redaktion (Inst.)          | `redaktion`          | `.../redaktion/**`           | (see Cross-Cutting)                | `teamspaceEditorGuard`                        | ⏳                                        | (covered)     |
| Klienten-News              | `klienten-news`      | `.../klienten-news/**`       | (see Cross-Cutting)                | `client_news.view`                            | ⏳                                        | (covered)     |
| Files (Institution)        | `files-institution`  | `.../dateien`                | `FilesPageComponent`               | `fileStorageFeatureGuard`                     | ⏳                                        | P2            |
| Tenant Debug               | `tenant-debug`       | `.../debug/tenant`           | `TenantDebugComponent`             | — (dev tool)                                  | ⏳                                        | ❌            |

#### Case Detail Tabs — `.../cases/:id/{tab}`

| Tab                | Path           | Component                      | Guard                          |
| ------------------ | -------------- | ------------------------------ | ------------------------------ |
| Overview (default) | `overview`     | `CaseOverviewTabComponent`     | —                              |
| Appointments       | `appointments` | `CaseAppointmentsTabComponent` | —                              |
| Financial          | `financial`    | `CaseFinancialTabComponent`    | `financialSupportFeatureGuard` |
| Approvals          | `approvals`    | `CaseApprovalsTabComponent`    | `approvalsFeatureGuard`        |
| Data               | `data`         | `CaseDataTabComponent`         | —                              |
| Reminders          | `reminders`    | `CaseRemindersTabComponent`    | —                              |
| Documents          | `documents`    | `CaseDocumentsTabComponent`    | —                              |

#### Profile Detail Tabs — `.../profile/:id/{tab}`

| Tab                | Path                | Component                          | Guard                          |
| ------------------ | ------------------- | ---------------------------------- | ------------------------------ |
| Overview (default) | `overview`          | `ProfileOverviewTabComponent`      | —                              |
| Appointments       | `appointments`      | `ProfileAppointmentsTabComponent`  | —                              |
| Stammdaten         | `stammdaten`        | `ProfileStammdatenTabComponent`    | `UnsavedChangesGuard`          |
| Relationships      | `relationships`     | `ProfileRelationshipsTabComponent` | —                              |
| Financial          | `financial`         | `ProfileFinancialTabComponent`     | `financialSupportFeatureGuard` |
| Reminders          | `reminders`         | `ProfileRemindersTabComponent`     | —                              |
| Documents          | `documents`         | `ProfileDocumentsTabComponent`     | —                              |
| Messages           | `messages`          | `ProfileMessagesTabComponent`      | —                              |
| Cases              | `cases`             | `ProfileCasesTabComponent`         | `caseFeatureGuard`             |
| Reports            | `reports`           | `ProfileReportsTabComponent`       | `clientReportsFeatureGuard`    |
| Report Detail      | `reports/:reportId` | `ClientReportEditorComponent`      | `clientReportsFeatureGuard`    |

### Teamspace Scope — `/teamspace/*`

All gated by `teamspaceFeatureGuard`. Many routes additionally require `tenantPermissionGuard`.

| Feature                      | Slug                    | Route                                      | Component                                                                                            | Permission                                          | Spec?                                                             | Port Priority |
| ---------------------------- | ----------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- | ------------- |
| Personenverzeichnis          | `personenverzeichnis`   | `/teamspace/personenverzeichnis`           | `PersonenverzeichnisPageComponent`                                                                   | `teamspace_directory.view`                          | ⏳                                                                | P2            |
| Submissions Admin            | `submissions-admin`     | `/teamspace/submissions/verwaltung`        | `GlobalSubmissionsVerwaltungPageComponent`                                                           | `teamspaceAdminGuard`                               | ⏳                                                                | P2            |
| Submission Categories Config | `submission-categories` | `/teamspace/submissions/konfiguration`     | `GlobalSubmissionCategoriesPageComponent`                                                            | `teamspaceAdminOnlyGuard`                           | ⏳                                                                | ❌            |
| Booking Categories Config    | `booking-categories`    | `/teamspace/terminbuchungen/konfiguration` | `TeamspaceBookingCategoriesAdminComponent`                                                           | `teamspaceAdminOnlyGuard`                           | ⏳                                                                | ❌            |
| Teamspace Home               | `teamspace-home`        | `/teamspace`                               | `TeamspaceV2PageComponent`                                                                           | `teamspace_home.view`                               | [teamspace-home](./features/teamspace-home/spec.md)               | **P1** ✅     |
| Teamspace News               | `teamspace-news`        | `/teamspace/news/**`                       | `NewsPageComponent` + News Detail                                                                    | `teamspace_news.view`                               | [teamspace-news](./features/teamspace-news/spec.md)               | **P1** ✅     |
| Teamspace Submissions        | `teamspace-submissions` | `/teamspace/submissions/**`                | `TeamspaceSubmissionsPageComponent`, `SubmissionDetailPageComponent`                                 | `teamspace_submissions.view`                        | [teamspace-submissions](./features/teamspace-submissions/spec.md) | **P1** ✅     |
| Teamspace LMS                | `teamspace-lms`         | `/teamspace/lms/**`                        | lazy `LMS_ROUTES`                                                                                    | `teamspace_lms.view` + `schulungenFeatureGuard`     | [teamspace-lms](./features/teamspace-lms/spec.md)                 | **P1** ✅     |
| Teamspace Redaktion          | `redaktion`             | `/teamspace/redaktion/**`                  | (see Cross-Cutting)                                                                                  | `teamspaceEditorGuard`                              | ⏳                                                                | (covered)     |
| Teamspace Events             | `teamspace-events`      | `/teamspace/events/**`                     | `EventsPageComponent`, `EventsVerwaltungComponent`, `EventsEditorComponent`, `EventsDetailComponent` | `teamspace_events.view`                             | [teamspace-events](./features/teamspace-events/spec.md)           | **P1** ✅     |
| Teamspace Knowledge Base     | `knowledge-base`        | `/teamspace/knowledge-base/**`             | (see Cross-Cutting)                                                                                  | `teamspace_knowledge_base.view`                     | ⏳                                                                | (covered)     |
| Teamspace Calendar           | `teamspace-calendar`    | `/teamspace/kalender/**`                   | `TerminePageComponent`, `TermineNeuComponent`, `TermineDetailComponent`                              | `teamspace_calendar.view`                           | [teamspace-calendar](./features/teamspace-calendar/spec.md)       | **P1** ✅     |
| Teamspace Booking Detail     | `appointment-detail`    | `/teamspace/buchung/:id`                   | (see Cross-Cutting, mode: booker)                                                                    | `teamspace_calendar.view`                           | ⏳                                                                | (covered)     |
| Gehaltsnachweise             | `gehaltsnachweise`      | `/teamspace/gehaltsnachweise`              | `ProofOfSalaryPageComponent`                                                                         | `teamspace_home.view` + `proofOfSalaryFeatureGuard` | [gehaltsnachweise](./features/gehaltsnachweise/spec.md)           | **P1** ✅     |

### Client Portal — `/client-portal/*`

Gated by `clientPortalGuard`. **This is the Flutter MVP target.**

| Feature            | Slug                 | Route                           | Component                                                                                     | Spec?                                                       | Port Priority |
| ------------------ | -------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------- |
| Client Dashboard   | `client-dashboard`   | `/client-portal`                | `ClientPortalDashboardComponent`                                                              | [client-dashboard](./features/client-dashboard/spec.md)     | **P0** ✅     |
| Client Termine     | `client-termine`     | `/client-portal/termine/**`     | `ClientTerminePageComponent`, `ClientTermineNeuComponent`, Appointment Detail (mode: client)  | [client-termine](./features/client-termine/spec.md)         | **P0** ✅     |
| Client Dokumente   | `client-dokumente`   | `/client-portal/dokumente/**`   | `ClientDokumentePageComponent`, `ClientDokumentDetailComponent`                               | [client-dokumente](./features/client-dokumente/spec.md)     | **P0** ✅     |
| Client News        | `client-news`        | `/client-portal/news/**`        | `ClientNewsPageComponent`, News Detail (context: client-portal)                               | [client-news](./features/client-news/spec.md)               | **P0** ✅     |
| Client Nachrichten | `client-nachrichten` | `/client-portal/nachrichten/**` | `ClientMessagesPageComponent`, `ClientInquiryDetailComponent`, `ClientMessageDetailComponent` | [client-nachrichten](./features/client-nachrichten/spec.md) | **P0** ✅     |
| Client Chat        | `client-chat`        | `/client-portal/chat`           | `ClientChatPageComponent` (`CHAT_ROUTES`)                                                     | [client-chat](./features/client-chat/spec.md)               | **P0** ✅     |
| Client Profile     | `client-profile`     | `/client-portal/profil`         | `ClientProfileComponent`                                                                      | [client-profile](./features/client-profile/spec.md)         | **P0** ✅     |

### LMS — `/teamspace/lms/*`

| Feature                | Slug                  | Route                                                 | Component                                                                           | Guard                | Spec?                                                          | Port Priority |
| ---------------------- | --------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------- | ------------- |
| LMS Home               | `lms-home`            | `/teamspace/lms`                                      | `LmsHomeComponent`                                                                  | —                    | (covered by [teamspace-lms](./features/teamspace-lms/spec.md)) | **P1** ✅     |
| Course Overview        | `lms-course-overview` | `/teamspace/lms/kurse/:courseId`                      | `CourseOverviewComponent`                                                           | —                    | (covered)                                                      | **P1** ✅     |
| Course Player          | `lms-course-player`   | `/teamspace/lms/kurse/:courseId/lernen`               | `CoursePlayerComponent`                                                             | —                    | (covered)                                                      | **P1** ✅     |
| Lesson PDF Viewer      | `lms-pdf-viewer`      | `/teamspace/lms/kurse/:courseId/lesson/:lessonId/pdf` | `PdfViewerComponent`                                                                | —                    | (covered)                                                      | **P1** ✅     |
| LMS Admin (Schulungen) | `lms-admin`           | `/teamspace/lms/verwaltung/**`                        | `SchulungenPageComponent`, `ComplianceMatrixComponent`, `SchulungenDetailComponent` | `schulungAdminGuard` | ⏳                                                             | ❌            |

### Einstellungen — `/einstellungen/traeger/*`

All gated by `tenantAdminGuard` or `adminAccessGuard` at parent level. Tenant-wide configuration surfaces.

| Feature                | Slug                                  | Route                                             | Component                                                                        | Spec? | Port Priority |
| ---------------------- | ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- | ----- | ------------- |
| Organisation (Root)    | `einstellungen-organisation`          | `.../organisation/{teamspaces,einrichtungen}`     | `OrganisationComponent` + tabs                                                   | ⏳    | ❌            |
| Mitarbeitende (Träger) | `einstellungen-mitarbeitende-traeger` | `.../mitarbeitende`                               | `MitarbeitendeComponent`                                                         | ⏳    | ❌            |
| Rollen & Rechte        | `einstellungen-rollen-rechte`         | `.../rollen-rechte/**`                            | `RollenRechteComponent` + tabs                                                   | ⏳    | ❌            |
| Sicherheit             | `einstellungen-sicherheit`            | `.../sicherheit/einstellungen`                    | `SicherheitComponent` + `SicherheitTabComponent`                                 | ⏳    | ❌            |
| Tätigkeiten            | `einstellungen-taetigkeiten`          | `.../taetigkeiten/uebersicht`                     | `TaetigkeitenComponent` + `TaetigkeitenListComponent`                            | ⏳    | ❌            |
| Fachbereiche (Träger)  | `einstellungen-fachbereiche-traeger`  | `.../fachbereiche/uebersicht`                     | `FachbereicheComponent` + `DepartmentListComponent`                              | ⏳    | ❌            |
| Integrationen          | `einstellungen-integrationen`         | `.../integrationen/{vivendi,microsoft-365,datev}` | `IntegrationenComponent` + tabs                                                  | ⏳    | ❌            |
| Anmeldeprotokolle      | `einstellungen-anmeldeprotokolle`     | `.../anmeldeprotokolle/**`                        | `AnmeldeprotokolleComponent`, `LoginLogListComponent`, `LoginLogDetailComponent` | ⏳    | ❌            |
| Externe Inhalte        | `einstellungen-externe-inhalte`       | `.../externe-inhalte/inhalt`                      | `ExterneInhalteComponent` + `ExternalContentsTabComponent`                       | ⏳    | ❌            |
| Schulungsverwaltung    | `einstellungen-schulungsverwaltung`   | `.../schulungsverwaltung/uebersicht`              | `SchulungsverwaltungComponent` + tab                                             | ⏳    | ❌            |
| Tagea AI Config        | `einstellungen-tagea-ai`              | `.../tagea-ai/einstellungen`                      | `TageaAiComponent` + `TageaAiTabComponent`                                       | ⏳    | ❌            |
| Willkommensseite       | `einstellungen-willkommensseite`      | `.../willkommensseite/inhalt`                     | `WillkommensseiteComponent` + `WelcomeTabComponent`                              | ⏳    | ❌            |

### Einstellungen — `/einstellungen/einrichtung/:institutionId/*`

Institution-scoped config, gated by `permissionGuard: institutions.manage`.

| Feature                   | Slug                                      | Route                        | Component                                                                                                              | Spec? | Port Priority |
| ------------------------- | ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- | ------------- |
| Einrichtung Mitarbeitende | `einstellungen-mitarbeitende-einrichtung` | `.../mitarbeitende`          | `EinrichtungMitarbeitendeComponent`                                                                                    | ⏳    | ❌            |
| Einrichtung Fachbereiche  | `einstellungen-fachbereiche-einrichtung`  | `.../fachbereiche/**`        | `FachbereicheComponent` + `DepartmentListComponent`                                                                    | ⏳    | ❌            |
| Berechtigungsmatrix       | `einstellungen-berechtigungsmatrix`       | `.../berechtigungsmatrix/**` | `BerechtigungsmatrixComponent`                                                                                         | ⏳    | ❌            |
| Klienten-Felder (Custom)  | `einstellungen-klienten-felder`           | `.../klienten-felder/**`     | `ClientsCustomFieldsAdminComponent`, `FieldDefinitionFormComponent`                                                    | ⏳    | ❌            |
| Terminvorlagen            | `einstellungen-terminvorlagen`            | `.../terminvorlagen`         | `AppointmentTemplatesAdminComponent`                                                                                   | ⏳    | ❌            |
| Sachmittel-Vorlagen       | `einstellungen-sachmittel`                | `.../sachmittel`             | `FinancialSupportTemplatesAdminComponent`                                                                              | ⏳    | ❌            |
| Fallverwaltung Config     | `einstellungen-fallverwaltung`            | `.../fallverwaltung`         | `CaseManagementAdminComponent`                                                                                         | ⏳    | ❌            |
| Berichtsvorlagen          | `einstellungen-berichtsvorlagen`          | `.../berichtsvorlagen`       | `ClientReportTemplatesAdminComponent`                                                                                  | ⏳    | ❌            |
| Abrechnung Config         | `einstellungen-abrechnung`                | `.../abrechnung`             | `BillingAdminComponent`                                                                                                | ⏳    | ❌            |
| Arbeitszeiten Templates   | `einstellungen-arbeitszeiten`             | `.../arbeitszeiten`          | `ShiftTemplatesAdminComponent`                                                                                         | ⏳    | ❌            |
| Einrichtungsdaten         | `einstellungen-einrichtungsdaten`         | `.../einrichtungsdaten`      | `CurrentInstitutionAdminComponent`                                                                                     | ⏳    | ❌            |
| Custom Fields Definitions | `einstellungen-custom-fields`             | `.../custom-fields/**`       | `FieldDefinitionsListComponent`, `FieldDefinitionFormComponent`, `FieldGroupsListComponent`, `FieldGroupFormComponent` | ⏳    | ❌            |

### Super-Admin — `/super-admin/*`

All gated by `superAdminGuard`. Tenant-management surfaces — **all non-goals for Flutter.**

| Feature                 | Slug                          | Route                             | Component                                                                                                  | Spec? | Port Priority |
| ----------------------- | ----------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- | ------------- |
| Features / Institutions | `super-admin-features`        | `/super-admin/features/**`        | `SuperAdminFeaturesComponent`, `InstitutionsTabComponent`                                                  | ⏳    | ❌            |
| Global Articles         | `super-admin-global-articles` | `/super-admin/global-articles/**` | `GlobalArticlesAdminComponent`, `GlobalArticleEditorPageComponent`                                         | ⏳    | ❌            |
| Patch Notes             | `super-admin-patch-notes`     | `/super-admin/patch-notes/**`     | `PatchNotesAdminComponent`, `PatchNoteEditorPageComponent`                                                 | ⏳    | ❌            |
| Super-Admin LMS         | `super-admin-lms`             | `/super-admin/lms/**`             | `LmsCourseListComponent`, `LmsCourseEditorComponent`                                                       | ⏳    | ❌            |
| Report Inspector        | `super-admin-reports`         | `/super-admin/reports/**`         | `ReportInspectTenantListComponent`, `ReportInspectDefinitionListComponent`, `ReportInspectDetailComponent` | ⏳    | ❌            |
| Brand Management        | `super-admin-brands`          | `/super-admin/brands`             | `BrandManagementComponent`                                                                                 | ⏳    | ❌            |

## Priority Summary

| Priority | Count | What it covers                                                                                                                        | Spec coverage |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **P0**   | 12    | Client Portal (7) + Auth (3: login ✅, callback ✅, session-expired ✅) + Cross-cutting (2: appointment-detail ✅, news-detail ✅)    | **12/12 ✅**  |
| **P1**   | ~18   | Auth-error surfaces (7) + Chat/AI (4) + Teamspace (7: home, news, submissions, lms, events, calendar, gehaltsnachweise)               | **18/~18 ✅** |
| **P2**   | ~20   | Staff-facing institution/teamspace features — core 7 specced (dashboard, tasks, calendar, clients, cases + knowledge-base, redaktion) | **7/~20 ⏳**  |
| **❌**   | ~40   | Admin/settings/super-admin surfaces — web-only                                                                                        | N/A           |

## Open Items

- **Platform Concerns** (not router-visible): Push notifications, Auth bootstrap, i18n, Deep-linking, State sync between tabs — need a separate `specs/platform/` tree, not features.
- **E2E coverage mapping**: for each feature, link its Playwright test file in the spec's References section.
