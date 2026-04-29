# Contracts: Teamspace Home

## HTTP Endpoints

> Routes are written without the `/api` prefix (the frontend's `ApiConfigService` resolves it). Backend controllers are linked for ground truth — when in doubt, the controller decorator wins.

### Feed

| Verb | Route                                | Body / Query                                                | Response                       | Backend                                                                                                                                              |
| ---- | ------------------------------------ | ----------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/feed`                              | `?teamspace_ids[]=…&page=1&limit=20&lang=en` (lang optional, omitted when `de`) | `FeedResponseDto`              | `apps/tagea-backend/src/feed/feed.controller.ts` (`@Auth({ scope: 'authenticated' })`)                                                               |

### Teamspaces

| Verb | Route                              | Response                  | Backend                                                                                                                                                                                                  |
| ---- | ---------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/teamspaces/accessible`           | `TeamspaceResponseDto[]`  | `apps/tagea-backend/src/teamspaces/teamspaces.controller.ts:findAccessible`                                                                                                                              |

### Read status

| Verb | Route                              | Body / Query                                              | Response                                              |
| ---- | ---------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| POST | `/content-read-status/bulk`        | `BulkMarkAsReadDto = { items: MarkAsReadDto[] }`          | `{ marked: number; notificationsMarkedRead: number }` |
| GET  | `/content-read-status/status`      | `?content_type=&content_ids[]=…`                          | `BulkReadStatusResponseDto`                           |
| GET  | `/content-read-status/read-ids`    | `?content_type=`                                          | `string[]` (UUIDs)                                    |

> Backend: `apps/tagea-backend/src/content-read-status/content-read-status.controller.ts`. `MarkAsReadDto.content_type` uses the wire enum (`'article' \| 'event' \| 'submission' \| 'appointment'`) — see Mapping section.

### Articles (like / unread counts)

| Verb | Route                               | Body                                  | Response                       | Backend                                                                                                                       |
| ---- | ----------------------------------- | ------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| POST | `/articles/bulk-unread-counts`      | `{ teamspace_ids: string[] }`         | `BulkUnreadCountResponseDto`   | `apps/tagea-backend/src/articles/articles.controller.ts:getBulkUnreadCounts`                                                  |
| POST | `/articles/:id/like`                | _empty_                               | `{ is_liked: boolean; like_count: number }` (toggle) | `apps/tagea-backend/src/articles/articles.controller.ts` (toggle endpoint)                                |

### Appointments

| Verb | Route                               | Query                  | Response                                | Backend                                                                                                                                |
| ---- | ----------------------------------- | ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| GET  | `/appointments/my-next`             | `?lang=en` (optional)  | `NextAppointmentResponseDto \| null`    | `apps/tagea-backend/src/appointments/controllers/client-appointments.controller.ts:getMyNextAppointment`                                |
| GET  | `/appointments/:id`                 | —                      | full appointment DTO                    | `apps/tagea-backend/src/appointments/controllers/tenant-appointments.controller.ts` (used only for the next-appointment dialog branch) |

### Submissions

| Verb | Route          | Query                                                                 | Response                  | Backend                                                                                                            |
| ---- | -------------- | --------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| GET  | `/submissions` | `?teamspace_id[]=…&employee_id=<uuid>` (additional filters supported) | `Submission[]` (global)   | `apps/tagea-backend/src/submissions/controllers/global-submissions.controller.ts:findAll` (`findAllGlobal` service) |

> Note: this is the **global** submissions endpoint (`@Controller('submissions')`), not the per-teamspace endpoint at `@Controller('teamspaces/:teamspaceId/submissions')`. The teamspace home uses the global one to avoid N requests.

### External contents

| Verb | Route                                  | Body                                | Response                                       | Backend                                                                                            |
| ---- | -------------------------------------- | ----------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| GET  | `/external-contents`                   | —                                   | `ExternalContentResponseDto[]`                 | `apps/tagea-backend/src/external-contents/external-contents.controller.ts:findAll`                 |
| POST | `/external-contents/bulk-image-urls`   | `{ content_ids: string[] }`         | `{ urls: Record<string, string \| null> }`     | `apps/tagea-backend/src/external-contents/external-contents.controller.ts:getBulkImageUrls`        |

### Tenant features (consumed indirectly)

| Verb | Route                        | Response                  | Used for                                  |
| ---- | ---------------------------- | ------------------------- | ----------------------------------------- |
| GET  | `/tenants/current/features`  | `TenantFeaturesDto`       | `proofOfSalary`, `tasks`, `teamspace`, `institutions` flags drive guards + quick links |

## Backend DTOs (authoritative shapes)

```ts
// apps/tagea-backend/src/feed/dto/feed-response.dto.ts
class FeedItemDto {
  type: 'article' | 'event';
  id: string;
  teamspace_id: string;
  title: string;
  display_title?: string;          // translation
  description: string | null;
  content_excerpt?: string;        // server-stripped, max 350 chars
  author_name: string;
  published_at: string;            // ISO; for events this is created_at
  image_url: string | null;
  is_read: boolean;

  // Article-specific
  article_type?: string;           // 'news' | 'knowledge' | 'documentation' | 'announcement'
  is_liked?: boolean;
  like_count?: number;
  comment_count?: number;
  likes_enabled?: boolean;
  comments_enabled?: boolean;
  requires_acknowledgment?: boolean;
  has_acknowledged?: boolean;

  // Event-specific
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  location_type?: string;          // 'online' | 'hybrid' | <onsite>
  current_participants?: number;
  max_participants?: number;
  organizer_name?: string;

  // Translation
  translation_language?: string | null;
}
class FeedResponseDto { items: FeedItemDto[]; page: number; limit: number; hasMore: boolean; }
```

```ts
// apps/tagea-backend/src/articles/dto/bulk-unread-count.dto.ts
class BulkUnreadCountBodyDto { teamspace_ids: string[]; }
class TeamspaceUnreadDataDto {
  article_unread_count: number;
  event_unread_count: number;
  total_unread_count: number;
}
class BulkUnreadCountResponseDto { data: Record<string, TeamspaceUnreadDataDto>; }
```

```ts
// apps/tagea-backend/src/content-read-status/dto/content-read-status.dto.ts
enum ContentTypeEnum { ARTICLE = 'article', EVENT = 'event', SUBMISSION = 'submission', APPOINTMENT = 'appointment' }
class MarkAsReadDto { content_type: ContentTypeEnum; content_id: string; }   // wire enum is lowercase
class BulkMarkAsReadDto { items: MarkAsReadDto[]; }
class BulkReadStatusResponseDto { status: Record<string, boolean>; }
```

```ts
// apps/tagea-backend/src/teamspaces/dto/teamspace-response.dto.ts
class TeamspaceResponseDto {
  id: string;
  name: string;
  description?: string | null;
  type: TeamspaceType;            // PUBLIC | PRIVATE | INSTITUTION_BASED
  is_active: boolean;
  institution_ids: string[];
  institution_id?: string | null; // @deprecated — N:M now lives in institution_ids
  active_modules: Record<string, boolean>;  // see frontend TeamspaceModules below
  created_at: Date;
  updated_at: Date;
}
```

```ts
// Documentation-only shape — frontend reads strict keys, backend DTO is loose.
// This is the strict shape we should rely on for the Flutter port:
type TeamspaceModules = {
  news: boolean;
  events: boolean;
  announcements: boolean;
  knowledge: boolean;
  submissions: boolean;
  offer_booking: boolean;
  files: boolean;
  // Read defensively with `?? false` because the backend DTO does not enforce these keys.
};
```

```ts
// apps/tagea-backend/src/external-contents/dto/external-content-response.dto.ts
class ExternalContentResponseDto {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  display_order: number;
  image_s3_key?: string | null;
  image_s3_bucket?: string | null;
  image_original_filename?: string | null;
  image_mimetype?: string | null;
  image_size?: number | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
```

```ts
// apps/tagea-backend/src/appointments/dto/next-appointment-response.dto.ts
class NextAppointmentResponseDto {
  id: string;
  type: 'appointment' | 'event';
  title: string;
  start_datetime: Date;
  end_datetime: Date;
  location: string | null;
  description: string | null;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'published';
  template_name: string | null;
  participant_count: number;
  duration_minutes: number | null;
  registration_status: string | null;        // events only
  display_title?: string | null;             // translation
  display_description?: string | null;       // translation
  translation_language?: string | null;
  booking_category_id?: string | null;       // teamspace bookings only
  assigned_to_employee_ids?: string[];       // providers
  setting?: string | null;                   // 'vor-ort' | 'telefonat' | 'video' | 'chat'
}
```

## Services Consumed (frontend façade)

> Method signatures live under `apps/tagea-frontend/src/app/services/`. The Flutter port should mirror these names so spec/code/code traceability stays simple.

| Service                       | Method(s) used                                                                                  | Purpose                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `FeedService`                 | `getFeed(teamspaceIds, page, limit, lang?)`                                                     | Aggregated feed (articles + events)                                      |
| `TeamspaceService`            | `getAccessibleTeamspaces()`                                                                     | List of teamspaces the user can access (basis for filter chips)          |
| `AuthorizationStore`          | `hasAnyTeamspacePermissionOf(perms[])`                                                          | News-editor quick-link visibility (replaced `hasAdminOrRedakteurRole`)   |
| `AppointmentsService`         | `getMyNextAppointment(lang?)`, `getTenantAppointment(id)`                                       | Next-appointment sidebar + dialog branch                                 |
| `SubmissionsService`          | `getAllSubmissions({ teamspace_id, employeeId })`                                               | Recent own submissions (sidebar)                                         |
| `ExternalContentsService`     | `getAll()`, `getBulkImageUrls(ids)`                                                             | Tenant-wide external links + signed image URLs                           |
| `ContentReadStatusService`    | `markAsRead(type, id)` (debounced bulk POST), `isRead(type, id)`, `preloadReadStatus(items)`     | Auto-mark-as-read on scroll                                              |
| `TeamspaceUnreadCountService` | `calculateUnreadCounts(teamspaces)`, `updateCountForReadCard(teamspaceId, currentCounts)`       | Chip badges                                                              |
| `ArticleService`              | `toggleLike(id)`, `getBulkUnreadCounts(teamspaceIds)`                                           | Like toggle + bulk-unread bridge                                         |
| `CurrentEmployeeService`      | `getCurrentEmployeeId()`, `hasProofOfSalaryAccess()`                                            | Submissions filter + quick-link gating                                   |
| `TenantFeaturesService`       | `isProofOfSalaryEnabled()`, `isTeamspaceEnabled()`, `isInstitutionsEnabled()`, `isTasksEnabled()` | Feature-flag gates for guard + quick-link + appointment-card validation badge |
| `LanguageService`             | `currentLanguage()`                                                                             | `lang` query param for translated articles/events                        |
| `SecureImageService`          | `loadImage(url)` → `SafeUrl`                                                                    | Authenticated image fetching with two-tier cache                         |
| `HtmlSanitizerService`        | `sanitizeForInnerHtml(html)`                                                                    | Render `content_excerpt` safely                                          |

## Wire Mappings

### Feed-card `contentType` ↔ server `ContentTypeEnum`

The UI distinguishes more variants than the server enum because card visuals diverge for `news` vs. `knowledge` even though both are server-side `ARTICLE`s.

| UI `contentType` | Server `ContentTypeEnum` | Notes                                                              |
| ---------------- | ------------------------ | ------------------------------------------------------------------ |
| `news`           | `'article'`              | `article_type ∈ {'news', 'announcement'}`                          |
| `knowledge`      | `'article'`              | `article_type ∈ {'knowledge', 'documentation'}`                    |
| `article`        | `'article'`              | UI legacy alias; treat identically to `news` for read-status calls |
| `event`          | `'event'`                | 1:1                                                                |
| `submission`     | `'submission'`           | UI value exists for typing; not used by feed cards (sidebar only)  |
| `appointment`    | `'appointment'`          | UI value exists for typing; not used by feed cards (sidebar only)  |
| anything else    | _no-op_                  | navigation and read-status calls are skipped                       |

### Submission status → `BadgeStatus`

Frontend `BadgeStatus` is `'pending' | 'approved' | 'rejected' | 'in-progress'` (`tagea-status-badge.component.ts`). Mapping in `submission-mappers.ts`:

| Server `SubmissionStatus` | UI `BadgeStatus` | Default German label  | Icon              |
| ------------------------- | ---------------- | --------------------- | ----------------- |
| `awaiting_approval`       | `pending`        | "Wartet auf Genehmigung" | `hourglass_empty` |
| `pending`                 | `pending`        | "Eingegangen"         | `inbox`           |
| `in_review`               | `in-progress`    | "In Bearbeitung"      | `pending`         |
| `closed`                  | `approved`       | "Abgeschlossen"       | `check_circle`    |
| `rejected`                | `rejected`       | "Abgelehnt"           | `cancel`          |

### Appointment-card click router (next-appointment branch)

```
type === 'event'                                                 → /teamspace/events/:id  (no dialog)
booking_category_id != null AND user ∉ assigned_to_employee_ids  → /teamspace/buchung/:id (booker)
otherwise                                                         → modal AppointmentDialog (mode='edit', isTeamspaceMode=true)
```

Flutter port note: the modal dialog branch is shared with the appointment-detail spec — see [`appointment-detail/spec.md`](../appointment-detail/spec.md). The Flutter implementation should call the shared appointment-detail widget with `isTeamspaceMode = true`.

### Quick-link click router

| Quick-link `id`     | Route                          |
| ------------------- | ------------------------------ |
| `events`            | `/teamspace/events`            |
| `news`              | `/teamspace/redaktion`         |
| `appointments`      | `/teamspace/kalender`          |
| `book-offer`        | `/teamspace/kalender/neu`      |
| `proof-of-salary`   | `/teamspace/gehaltsnachweise`  |

> A historic `teamspaces` case still exists in the Capacitor switch-case but the corresponding link entry was removed in commit `32096834` (2026-04-22). The Flutter port omits it.

## Mappers

| Mapper                            | Input → Output                              | Notes                                                                                       |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `feedItemToFeedCard`              | `FeedItem` → `FeedCardData`                 | Branches on `item.type`. Article-branch sub-branches on `article_type` (news vs. knowledge) |
| `mapNextAppointmentToCardData`    | `NextAppointmentResponseDto` → `AppointmentData` | Builds locale-aware `day` / `month` / `time`; resolves `setting` icon when no location  |
| `mapSubmissionToItemData`         | `Submission` → `SubmissionItemData`         | Status mapping above; `formatRelativeTime` returns "vor X Minuten/Stunden/Tagen"            |

## Read-status flush protocol

```
mark_as_read(type, id) is called:
  cacheKey = type:id
  if cache[cacheKey] == true: return                  # idempotent
  queue.push({ content_type: type, content_id: id })
  cache[cacheKey] = true
  debounceTrigger.next()                              # debounced 500ms

debounceTrigger fires:
  items = queue.drain()
  POST /content-read-status/bulk { items }
  on success:
    notification-center.unreadCount -= response.notificationsMarkedRead
  on error:
    for each item in items: cache.delete(item.cacheKey)   # so retry can happen on next scroll
```

## Image authentication contract

Feed-card `image_url` and external-content signed URLs reference paths under the tenant API. The Capacitor `SecureImageService` wraps every image fetch:

```
GET <baseUrl><image_url>
  Authorization: Bearer <accessToken>
  X-Tenant-ID:    <tenantId>
  Response-type:  blob
```

The blob is double-cached (memory map + `caches.open()` Cache API). The Flutter port replicates this with:

- A custom `ImageProvider` (or `CachedNetworkImageProvider` with `httpHeaders`) that injects auth headers from the auth cubit.
- A two-tier cache: in-memory LRU + `flutter_cache_manager` disk cache. Cache key includes the user id (multi-tenant safety).
- Eviction on logout.
