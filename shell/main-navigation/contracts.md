# Contracts: Main Navigation

> This bundle is purely frontend — no HTTP endpoints are owned here. Everything below is shape + filter logic consumed from other services.

## Navigation Item Schema

The authoritative TypeScript shape declared in `secure-main.component.ts`. All three presenter components (nav-rail, nav-drawer, bottom-nav) each declare their own subset of this interface locally — the shell passes plain objects shaped by the full definition below.

```ts
// Source: apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts
export interface NavigationItem {
  id: string; // stable identifier, used for badge lookup + bottom-nav selection
  icon: string; // Material icon name
  label: string; // hardcoded German label (fallback)
  labelKey?: string; // Transloco i18n key, preferred by presenters
  route?: string; // string route; prefixed with /einrichtung/:id at runtime in einrichtung mode
  requiredPermission?: string; // institution-scoped permission (single)
  requiredPermissions?: string[]; // institution-scoped permissions (any-of)
  requiredTenantPermission?: string; // tenant-scoped permission
  requiredFeature?: keyof TenantFeatures; // checked against tenant features; in einrichtung mode ALSO checked against institution features
  clientOnly?: boolean; // only visible to client users
  superAdminOnly?: boolean; // only visible to super-admins
  tenantAdminOnly?: boolean; // only visible to super-admins or tenant-admins
  mode?: 'einrichtung' | 'teamspace' | 'both'; // mode gate; omitted items are treated as 'both'
  bottomNavOnly?: boolean; // hidden from nav-rail AND nav-drawer; still eligible for bottom-nav
  mobileOnly?: boolean; // hidden from nav-rail; visible in nav-drawer
  mobileHidden?: boolean; // visible in nav-rail; hidden in nav-drawer
  children?: NavigationItem[]; // declared but unused — no sub-menu rendering
  badge?: number | string; // attached at runtime by the badge step
  badgeColor?: 'warn' | 'success';
  exactMatch?: boolean; // RouterLinkActive match strategy (default: prefix match)
}
```

> **Note:** There is no `requiredInstitutionFeature` field. Institution-feature enforcement reuses `requiredFeature`: when `currentMode === 'einrichtung'`, the same key is additionally checked via `InstitutionFeaturesService.isFeatureEnabled()`.

### Supporting types

```ts
// Source: apps/tagea-frontend/src/app/services/navigation-mode.service.ts
export type NavigationMode = 'einrichtung' | 'teamspace';

// Source: apps/tagea-frontend/src/app/services/tenant-features.service.ts
export interface TenantFeatures {
  caseManagement?: TenantFeature;
  reports?: TenantFeature;
  billing?: BillingFeature; // billing adds `provider: 'TAGEA' | 'DISABLED' | ...`
  clientPortal?: TenantFeature;
  chat?: TenantFeature;
  teamspace?: TenantFeature;
  tasks?: TenantFeature;
  clientMessages?: TenantFeature;
  aiChat?: AiChatFeature;
  schulungen?: TenantFeature;
  employeeRegistration?: TenantFeature;
  pep?: TenantFeature;
  fileStorage?: TenantFeature;
}
```

## Full Navigation Catalogue

Ordered as declared in `staticNavigationItems`. Columns: **id** / **labelKey** / **route** / **mode** / **guards** (permission, feature, user-type). `mobile flags` column lists `bottomNavOnly` / `mobileOnly` / `mobileHidden` when present.

### Teamspace mode

| id                              | labelKey            | route                            | guards                                                          | mobile flags |
| ------------------------------- | ------------------- | -------------------------------- | --------------------------------------------------------------- | ------------ |
| `teamspace`                     | `nav.teamspace`     | `/teamspace`                     | tenantPerm `teamspace_home.view`; feature `teamspace`           | —            |
| `teamspace-news`                | `nav.news`          | `/teamspace/news`                | tenantPerm `teamspace_news.view`; feature `teamspace`           | —            |
| `teamspace-submissions`         | `nav.submissions`   | `/teamspace/submissions`         | tenantPerm `teamspace_submissions.view`; feature `teamspace`    | —            |
| `teamspace-events`              | `nav.events`        | `/teamspace/events`              | tenantPerm `teamspace_events.view`; feature `teamspace`         | —            |
| `teamspace-kalender`            | `nav.calendar`      | `/teamspace/kalender`            | tenantPerm `teamspace_calendar.view`; feature `teamspace`       | —            |
| `teamspace-personenverzeichnis` | `nav.directory`     | `/teamspace/personenverzeichnis` | tenantPerm `teamspace_directory.view`; feature `teamspace`      | —            |
| `teamspace-knowledge-base`      | `nav.knowledgeBase` | `/teamspace/knowledge-base`      | tenantPerm `teamspace_knowledge_base.view`; feature `teamspace` | —            |
| `teamspace-lms`                 | `nav.lms`           | `/teamspace/lms`                 | tenantPerm `teamspace_lms.view`; feature `schulungen`           | —            |
| `dateien` (teamspace)           | `nav.files`         | `/dateien`                       | tenantPerm `file_storage.access`; feature `fileStorage`         | —            |
| `einstellungen` (teamspace)     | `nav.settings`      | `/einstellungen`                 | tenantPerm `admin.access`                                       | —            |

### Einrichtung mode

| id                            | labelKey               | route                | guards                                                                   | mobile flags   |
| ----------------------------- | ---------------------- | -------------------- | ------------------------------------------------------------------------ | -------------- |
| `dashboard`                   | `nav.dashboard`        | `/dashboard`         | perm `dashboard.view`                                                    | —              |
| `calendar`                    | `nav.calendar`         | `/calendar`          | perm `appointments.view`                                                 | —              |
| `tasks`                       | `nav.tasks`            | `/tasks`             | perm `institution.access`; feature `tasks`                               | —              |
| `institution-dateien`         | `nav.files`            | `/dateien`           | tenantPerm `file_storage.access`; feature `fileStorage`                  | —              |
| `clients`                     | `nav.clients`          | `/clients`           | perm `clients.view`                                                      | —              |
| `cases`                       | `nav.cases`            | `/cases`             | perm `cases.view`; feature `caseManagement`                              | —              |
| `bulk-messaging`              | `nav.bulkMessaging`    | `/bulk-messaging`    | perm `clients.view`; feature `clientMessages`                            | —              |
| `klienten-news`               | `nav.clientNews`       | `/klienten-news`     | perm `client_news.view`; feature `clientPortal`                          | —              |
| `employees`                   | `nav.employees`        | `/employees`         | perm `employees.view`                                                    | —              |
| `pending-employees`           | `nav.pendingEmployees` | `/pending-employees` | perm `employees.edit`; feature `employeeRegistration`                    | —              |
| `pep`                         | `nav.pep`              | `/pep`               | perm `employees.view`; feature `pep`                                     | —              |
| `reports`                     | `nav.reports`          | `/reports`           | perm `reports.view`; feature `reports`                                   | `mobileHidden` |
| `knowledge-base`              | `nav.knowledgeBase`    | `/knowledge-base`    | (no guards)                                                              | —              |
| `billing`                     | `nav.billing`          | `/billing`           | perm `cases.edit`; feature `billing` AND `billingProvider() === 'TAGEA'` | —              |
| `einstellungen` (einrichtung) | `nav.settings`         | `/einstellungen`     | permissions any-of `['institutions.manage', 'admin.access']`             | —              |

### Both / common

| id            | labelKey         | route          | guards                                      | mobile flags    |
| ------------- | ---------------- | -------------- | ------------------------------------------- | --------------- |
| `chat`        | `nav.chat`       | `/chat`        | tenantPerm `chat.access`; feature `chat`    | `bottomNavOnly` |
| `ai-chat`     | `nav.aiChat`     | `/ai-chat`     | tenantPerm `ai_chat.view`; feature `aiChat` | `mobileOnly`    |
| `super-admin` | `nav.superAdmin` | `/super-admin` | `superAdminOnly`                            | —               |

### Client-Portal (all `mode: 'both'`, `clientOnly: true`)

| id                   | labelKey             | route                        | feature guard            | mobile flags    |
| -------------------- | -------------------- | ---------------------------- | ------------------------ | --------------- |
| `client-dashboard`   | `nav.myOverview`     | `/client-portal`             | —                        | —               |
| `client-termine`     | `nav.myAppointments` | `/client-portal/termine`     | —                        | —               |
| `client-dokumente`   | `nav.myDocuments`    | `/client-portal/dokumente`   | —                        | —               |
| `client-news`        | `nav.newsUpdates`    | `/client-portal/news`        | —                        | —               |
| `client-chat`        | `nav.chat`           | `/client-portal/chat`        | feature `chat`           | `bottomNavOnly` |
| `client-nachrichten` | `nav.myMessages`     | `/client-portal/nachrichten` | feature `clientMessages` | —               |

## Filter Pipeline

Executed in order inside `navigationItems = computed(...)`. The first rule that rejects an item drops it.

```ts
// documentation-only

// 1. User type — clientOnly must match
if (item.clientOnly && !isClient) drop;

// 2. Elevation flags
if (item.superAdminOnly && !isSuperAdmin) drop;
if (item.tenantAdminOnly && !isSuperAdmin && !isTenantAdmin) drop;

// 3. Permissions (institution-scoped)
if (item.requiredPermission && !hasPermission(item.requiredPermission)) drop;
if (item.requiredPermissions?.length && !item.requiredPermissions.some((p) => hasPermission(p))) drop;

// 4. Tenant-scoped permission
if (item.requiredTenantPermission && !hasTenantPermission(item.requiredTenantPermission)) drop;

// 5. Feature gate (tenant level)
if (item.requiredFeature && !tenantFeaturesService.isFeatureEnabled(item.requiredFeature)) drop;

// 5a. Billing special case
if (item.requiredFeature === 'billing' && tenantFeaturesService.billingProvider() !== 'TAGEA') drop;

// 5b. Feature gate (institution level, einrichtung mode only)
if (item.requiredFeature && currentMode === 'einrichtung' && !institutionFeaturesService.isFeatureEnabled(item.requiredFeature)) drop;

// 6. Mode
if (item.mode && item.mode !== 'both' && item.mode !== currentMode) drop;

// 7. Institution access (einrichtung mode only)
if (item.mode === 'einrichtung' && !hasAccessibleInstitutions && !isTenantAdmin && !isSuperAdmin) drop;

// 8. Badge attach — see Badge Sources
// 9. Route templating — see below
```

### Step 9 — Route templating

After badges, routes are rewritten for einrichtung items that target an institution-scoped page:

```ts
// documentation-only
const NON_INSTITUTION_ROUTES = new Set(['/einstellungen', '/teamspace', '/chat', '/ai-chat', '/super-admin', '/client-portal']);

if (item.mode === 'einrichtung' && institutionId && item.route && !NON_INSTITUTION_ROUTES.has(item.route) && !item.route.startsWith('/einrichtung/')) {
  item.route = `/einrichtung/${institutionId}${item.route}`;
}
```

## Computed Collections

Derived from the filtered + badged + templated list.

```ts
// Source: apps/tagea-frontend/src/app/layouts/secure-main/secure-main.component.ts

// Desktop nav-rail — omit bottomNavOnly and mobileOnly
desktopNavigationItems = computed(() => navigationItems().filter((i) => !i.bottomNavOnly && !i.mobileOnly));

// Mobile nav-drawer — omit bottomNavOnly and mobileHidden; move chat items to end
mobileNavigationItems = computed(() => {
  const items = navigationItems().filter((i) => i.id !== 'admin' && !i.bottomNavOnly && !i.mobileHidden);
  const chatIds = ['client-chat', 'client-nachrichten', 'ai-chat'];
  return [...items.filter((i) => !chatIds.includes(i.id)), ...items.filter((i) => chatIds.includes(i.id))];
});

// Mobile bottom-nav — hardcoded essential ids per user/mode, sorted in declared order
bottomNavigationItems = computed(() => {
  let essentialIds: string[];
  if (isClient) essentialIds = ['client-dashboard', 'client-termine', 'client-chat', 'knowledge-base'];
  else if (currentMode === 'teamspace') essentialIds = ['teamspace', 'teamspace-events', 'chat'];
  else essentialIds = ['dashboard', 'clients', 'calendar', 'chat'];

  return navigationItems()
    .filter((i) => essentialIds.includes(i.id))
    .sort((a, b) => essentialIds.indexOf(a.id) - essentialIds.indexOf(b.id));
});
```

Additionally `totalBadgeCount` sums numeric badges across `mobileNavigationItems` for the hamburger button.

Detail-route visibility (owned by the shell template) hides `bottomNav` entirely when `isDetailRoute()` matches one of:

```
/^\/teamspace\/news\/[^/]+$/
/^\/teamspace\/events\/(?!verwaltung(?:$|\/))([^/]+)$/
/^\/veranstaltungen\/[^/]+$/
/^\/knowledge-base\/[^/]+$/
/^\/client-portal\/chat\/room\/.+$/
/^\/chat\/room\/.+$/
```

## Badge Sources

Signals owned outside the component and read during the badge-attach step. All are keyed by `item.id`.

| Item id (matched)                         | Source signal / service                                                          | Badge value                                             | Color rule                    |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| `tasks`                                   | `TasksService.getTasksSummary()` → `tasksSummary.total`                          | total open tasks                                        | `warn` if > 0, else `success` |
| `teamspace-submissions`                   | `SubmissionsService.getAllSubmissionsStats()` + `getAcknowledgedSubmissionIds()` | (pending + inReview) + unacknowledged institution items | `warn`, only shown if > 0     |
| `teamspace-lms`                           | `EnrollmentService.getPendingCoursesCount()`                                     | pending courses                                         | `warn`, only shown if > 0     |
| `pending-employees`                       | `EmployeesService.getPendingEmployeesCount()`                                    | pending employee registrations                          | `warn` if > 0, else `success` |
| `chat`, `teamspace-chat`\*, `client-chat` | `ChatNotificationService.totalUnreadCount$`                                      | unread chat messages                                    | `warn`, only shown if > 0     |
| `client-nachrichten`                      | `ClientMessagesService.clientPortalUnreadCount()`                                | unread client messages                                  | `warn`, only shown if > 0     |
| `bulk-messaging`                          | `ClientMessagesService.employeeInquiriesCount()`                                 | new employee-facing inquiries                           | `warn`, only shown if > 0     |
| `client-dokumente`                        | `ClientDocumentService.getPendingSignatureCount()`                               | documents awaiting signature                            | `warn`, only shown if > 0     |

\*`teamspace-chat` is referenced in code but no item with that id exists in the static list — the branch is dead.

Reload triggers:

| Signal                           | Reload trigger                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tasksSummary`                   | `effect` on auth+institution+mode+`isTasksEnabled`; `TasksService.onRefreshNeeded$`                    |
| `openSubmissionsCount`           | `effect` on auth+teamspace role flags; `SubmissionsService.onRefreshNeeded$`; on every `NavigationEnd` |
| `unacknowledgedInstitutionCount` | `effect` on auth+teamspace feature; `SubmissionsService.onRefreshNeeded$`; on every `NavigationEnd`    |
| `pendingEmployeesCount`          | `effect` on auth+`employeeRegistration`+`employees.edit`                                               |
| `pendingLmsCount`                | `effect` on auth+`schulungen`                                                                          |
| `chatUnreadCount`                | `ChatNotificationService.totalUnreadCount$` push                                                       |
| `clientPortalUnreadCount`        | `effect` on auth+isClient; service pushes                                                              |
| `employeeInquiriesCount`         | `effect` on auth+mode+`clientMessages`; `ClientMessagesService.onInquiriesRefreshNeeded$`              |
| `pendingSignatureCount`          | `effect` on auth+isClient                                                                              |

## Events (WebSocket / Push)

None owned here. Badge signals react to whatever push / polling the individual feature services implement.

> **Flutter port note:** Mirror the schema, filter pipeline, and three collections exactly. Keep badge reads behind a `NavBadgeRepository` abstraction so the Flutter port can swap between polling and WebSocket-driven signals without touching the filter logic.

```dart
// Flutter port
enum NavigationMode { einrichtung, teamspace }

class NavigationItem {
  final String id;
  final String icon;
  final String label;
  final String? labelKey;
  final String? route;
  final String? requiredPermission;
  final List<String>? requiredPermissions;
  final String? requiredTenantPermission;
  final String? requiredFeature;
  final bool clientOnly;
  final bool superAdminOnly;
  final bool tenantAdminOnly;
  final NavigationMode? mode; // null == both
  final bool bottomNavOnly;
  final bool mobileOnly;
  final bool mobileHidden;
}
```
