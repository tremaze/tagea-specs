# Contracts: Video Assistance

> API endpoints, DTOs, SSE events, and infrastructure contracts (LiveKit room/token, Voxtral transcription) for the Video Assistance feature.
>
> All endpoints require an authenticated user (employee or client portal session). All endpoints are gated behind `@RequireFeature('videoAssistance')` for the relevant institution.

## Status enums

```ts
// documentation-only
// documentation-only
type VideoAssistanceRequestStatus =
  | 'WAITING'                  // Client requested, no staff has claimed yet
  | 'ASSIGNED'                 // Staff claimed; LiveKit room exists; client modal raised
  | 'IN_CALL'                  // Both parties connected to LiveKit room
  | 'COMPLETED'                // Either party ended cleanly via /end
  | 'CANCELLED_BY_CLIENT'      // Client cancelled before/at modal stage
  | 'ABORTED';                 // Disconnect / staff-never-joined / timeout

type CancellationReason =
  | 'CLIENT_CANCELLED'
  | 'CLIENT_DISCONNECTED'
  | 'STAFF_DISCONNECTED'
  | 'STAFF_NEVER_JOINED'
  | 'TIMEOUT_NO_PICKUP';

type StaffPresenceStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';
```

## Client-portal endpoints (caller = client)

### `POST /client-portal/video-assistance/requests`

Create a new ad-hoc video-assistance request for the calling client.

**Request body:** _(empty — institution + client derived from session)_

**Response 201:**

```ts
// documentation-only
interface VideoAssistanceRequestDto {
  id: string;
  status: VideoAssistanceRequestStatus;
  institution_id: string;
  client_id: string;
  queue_position: number | null;       // null once status leaves WAITING
  staff_display_name: string | null;
  livekit_room_name: string | null;    // populated once ASSIGNED
  livekit_token: string | null;        // populated once ASSIGNED, ≤ 24h TTL
  staff_note: string | null;
  feedback_helpful: boolean | null;
  created_at: string;                  // ISO8601
  assigned_at: string | null;
  ended_at: string | null;
}
```

**Errors:**
- `403 FEATURE_DISABLED` — institution flag off
- `409 NO_STAFF_AVAILABLE` — no staff currently `AVAILABLE` for this institution
- `409 REQUEST_ALREADY_OPEN` — caller already has a request in `WAITING|ASSIGNED|IN_CALL`; response body includes existing `id`

### `GET /client-portal/video-assistance/requests/current`

Return the caller's currently-open request, or `null`.

**Response 200:** `VideoAssistanceRequestDto | null`

### `POST /client-portal/video-assistance/requests/:id/cancel`

Cancel a `WAITING` or `ASSIGNED` request. Idempotent — re-cancelling a `CANCELLED_BY_CLIENT` request returns 200.

**Errors:**
- `403` — request belongs to another client
- `409 INVALID_TRANSITION` — request is already `IN_CALL` or terminal

### `POST /client-portal/video-assistance/requests/:id/feedback`

```ts
// documentation-only
interface FeedbackDto { helpful: boolean; }
```

**Errors:**
- `409 INVALID_TRANSITION` — request not in a terminal state
- `409 ALREADY_RATED` — feedback already submitted

### `GET /client-portal/video-assistance/stream` (SSE)

Server-Sent Events stream scoped to the caller's open request.

**Query:** `?access_token=<jwt>` (per existing client-portal SSE pattern in AI Chat)

**Frames:**

```ts
// documentation-only
type ClientSseFrame =
  | { type: 'snapshot'; data: VideoAssistanceRequestDto | null }
  | { type: 'request.queue_position'; data: { request_id: string; position: number } }
  | { type: 'request.assigned'; data: VideoAssistanceRequestDto }
  | { type: 'request.ended'; data: { request_id: string; status: 'COMPLETED' | 'ABORTED' } }
  | { type: 'request.cancelled'; data: { request_id: string; reason: CancellationReason } }
  | { type: 'note.updated'; data: { request_id: string; staff_note: string | null } }
  | { type: 'heartbeat'; data: { ts: string } };
```

Heartbeat every 25 s. Connection auto-closes when the request reaches a terminal state and 60 s have elapsed.

## Staff/control endpoints (caller = employee)

Permissions are **institution-scoped**. Resolution via `PermissionResolverService.hasPermission(ctx, perm, { type: 'institution', institutionId })`. The active institution is derived from the `X-Institution-ID` header (set by the existing `InstitutionContextMiddleware`). Three permissions:

```ts
// documentation-only
export const VIDEO_ASSISTANCE_PERMISSIONS = {
  SERVE:            'institution.video_assistance.serve',
  HISTORY_VIEW_ALL: 'institution.video_assistance.history.view_all',
  MANAGE:           'institution.video_assistance.manage',
} as const;
```

Each endpoint below documents which permission(s) it requires.

### `GET /video-assistance/presence`

```ts
// documentation-only
interface PresenceDto {
  status: StaffPresenceStatus;
  institution_id: string;
  active_request_id: string | null;
  heartbeat_expires_at: string;        // ISO
}
```

### `PUT /video-assistance/presence`

```ts
// documentation-only
interface UpdatePresenceDto { available: boolean; }
```

Side-effect: opens/refreshes the heartbeat row in `video_assistance_presence`. Setting `available=false` while `status=BUSY` rejects with `409 PRESENCE_BUSY`.

### `POST /video-assistance/presence/heartbeat`

Empty body. Refreshes `heartbeat_expires_at = now() + 60 s`. Called from frontend every 30 s while the page is open and visible.

### `GET /video-assistance/queue`

List of currently `WAITING` requests scoped to staff's institutions, oldest first.

```ts
// documentation-only
interface QueueRowDto {
  id: string;
  client_id: string;
  client_display_name: string;
  client_avatar_initial: string;       // for avatar fallback
  client_color: string;                // deterministic per client (hex)
  institution_id: string;
  institution_name: string;
  waiting_since: string;               // ISO
  waiting_seconds: number;
}
```

### `GET /video-assistance/history`

Paginated history of non-`WAITING` requests scoped to caller (or institution-wide if `tenant.video_assistance.history.view_all`).

**Query:** `?status=&from=&to=&page=&pageSize=`

```ts
// documentation-only
interface HistoryRowDto {
  id: string;
  client: { id: string; display_name: string; initial: string; color: string };
  staff: { id: string; display_name: string; initial: string; color: string } | null;
  status: VideoAssistanceRequestStatus;
  cancellation_reason: CancellationReason | null;
  duration_seconds: number | null;
  date: string;                        // ISO
}
```

### `POST /video-assistance/requests/:id/claim`

Claim a specific row. Race-free.

**Response 200:**

```ts
// documentation-only
interface ClaimResultDto {
  request: VideoAssistanceRequestDto;  // status=ASSIGNED, with token+roomName
  client: { id: string; display_name: string; tags: string[]; age: number | null; member_since: string | null };
}
```

**Errors:**
- `409 ALREADY_CLAIMED`
- `409 PRESENCE_NOT_AVAILABLE` — caller is not `AVAILABLE`
- `403 INSTITUTION_MISMATCH` — request's institution not in caller's institution set

### `POST /video-assistance/requests/claim-next`

Claim the oldest `WAITING` request across the caller's institutions. Same response shape as `/claim`. `204 No Content` if queue is empty.

### `POST /video-assistance/requests/:id/end`

End the call. Either party may call this (client-portal endpoint mirrors this server-side) but the staff-side endpoint is the canonical path:

**Response 200:** `VideoAssistanceRequestDto` (status `COMPLETED`).

Side-effects:
1. Stop LiveKit egress (audio).
2. Delete LiveKit room.
3. Flip staff presence `BUSY → AVAILABLE` (or `OFFLINE` if their tab has been closed).
4. Enqueue the post-call transcription job.

### `PUT /video-assistance/requests/:id/note`

```ts
// documentation-only
interface UpdateNoteDto { staff_note: string; }
```

Saves the editable summary visible to the client on screen ⑥.

### `GET /video-assistance/requests/:id/llm-draft`

Read the LLM-generated draft note for a request. **Staff-only**, never exposed to the client. Permission: `SERVE` (and the caller must be the assigned staff or have `HISTORY_VIEW_ALL`).

```ts
// documentation-only
interface LlmDraftDto {
  request_id: string;
  llm_draft_note: string | null;
  transcription_status: 'PENDING' | 'RUNNING_VOXTRAL' | 'RUNNING_LLM' | 'READY_FOR_REVIEW' | 'APPROVED' | 'FAILED' | 'SKIPPED';
}
```

### `POST /video-assistance/requests/:id/note/regenerate`

Re-run the LLM step on the already-transcribed text. **Not available** if the audio file has been deleted (which is always the case after Voxtral runs successfully) — therefore this endpoint always returns `409 NO_AUDIO_AVAILABLE` for `READY_FOR_REVIEW`/`APPROVED` requests. It exists only as a defensive endpoint for the narrow window where a pod crashes between Voxtral-success and LLM-call. Permission: `SERVE` + assigned staff or `HISTORY_VIEW_ALL`.

### Institution settings (manage permission)

#### `GET /video-assistance/institution-settings`

Read the institution's video-assistance settings. Permission: any of `SERVE | HISTORY_VIEW_ALL | MANAGE`.

```ts
// documentation-only
interface InstitutionSettingsDto {
  institution_id: string;
  hours_hint_text: string;                 // e.g. "Mo–Fr 8–18 Uhr"
  llm_auto_summary_enabled: boolean;       // off → skip LLM step entirely; staff types from scratch
}
```

#### `PUT /video-assistance/institution-settings`

Update settings. Permission: `MANAGE`.

```ts
// documentation-only
interface UpdateInstitutionSettingsDto {
  hours_hint_text?: string;
  llm_auto_summary_enabled?: boolean;
}
```

Storage: `institution_features.videoAssistance.config: { hours_hint_text, llm_auto_summary_enabled }` — extends the existing `InstitutionFeature` JSONB shape with an optional `config` blob. Default `llm_auto_summary_enabled = true`.

### `GET /video-assistance/stream` (SSE)

Server-Sent Events for staff in the Control panel. Scoped to the staff's institutions.

```ts
// documentation-only
type StaffSseFrame =
  | { type: 'snapshot'; data: { presence: PresenceDto; queue: QueueRowDto[] } }
  | { type: 'presence.updated'; data: PresenceDto }
  | { type: 'request.created'; data: QueueRowDto }
  | { type: 'request.queue_changed'; data: { ids: string[] } }       // canonical order after claim/cancel
  | { type: 'request.assigned_to_me'; data: ClaimResultDto }         // when staff claims via another tab
  | { type: 'request.cancelled_by_client'; data: { request_id: string; was_assigned_to_me: boolean } }
  | { type: 'request.transcript_ready'; data: { request_id: string; transcript_text: string; transcript_language: string | null } }
  | { type: 'request.transcript_failed'; data: { request_id: string; reason: string } }
  | { type: 'heartbeat'; data: { ts: string } };
```

## Data models

### `video_assistance_requests`

```sql
CREATE TABLE video_assistance_requests (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id           uuid NOT NULL REFERENCES institutions(id),
  client_id                uuid NOT NULL REFERENCES clients(id),
  staff_id                 uuid REFERENCES employees(id),
  status                   text NOT NULL,                          -- VideoAssistanceRequestStatus
  cancellation_reason      text,                                   -- CancellationReason
  livekit_room_name        text,                                   -- "va-<uuid>"
  livekit_egress_id        text,
  audio_object_key         text,                                   -- S3-style key, deleted post-transcription
  transcript_text          text,
  transcript_language      text,
  transcript_status        text NOT NULL DEFAULT 'PENDING',        -- PENDING | RUNNING | DONE | FAILED | SKIPPED
  staff_note               text,
  feedback_helpful         boolean,
  created_at               timestamptz NOT NULL DEFAULT now(),
  assigned_at              timestamptz,
  in_call_at               timestamptz,
  ended_at                 timestamptz
);

CREATE INDEX video_assistance_requests_queue_idx
  ON video_assistance_requests (institution_id, created_at)
  WHERE status = 'WAITING';

CREATE INDEX video_assistance_requests_client_open_idx
  ON video_assistance_requests (client_id)
  WHERE status IN ('WAITING','ASSIGNED','IN_CALL');
```

### `video_assistance_ai_usage`

Per-feature token usage log. Replaces the missing global `ai_usage_log` until a centralised table appears.

```sql
CREATE TABLE video_assistance_ai_usage (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id               uuid NOT NULL REFERENCES video_assistance_requests(id) ON DELETE CASCADE,
  stage                    text NOT NULL CHECK (stage IN ('VOXTRAL','LLM_SUMMARY')),
  model                    text NOT NULL,                          -- e.g. "voxtral-mini-latest"
  prompt_tokens            integer NOT NULL,
  completion_tokens        integer NOT NULL,
  total_tokens             integer NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX video_assistance_ai_usage_request_idx
  ON video_assistance_ai_usage (request_id);
```

### `video_assistance_presence`

```sql
CREATE TABLE video_assistance_presence (
  staff_id                 uuid NOT NULL REFERENCES employees(id),
  institution_id           uuid NOT NULL REFERENCES institutions(id),
  status                   text NOT NULL,                          -- StaffPresenceStatus
  active_request_id        uuid REFERENCES video_assistance_requests(id),
  heartbeat_expires_at     timestamptz NOT NULL,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, institution_id)
);

CREATE INDEX video_assistance_presence_avail_idx
  ON video_assistance_presence (institution_id)
  WHERE status = 'AVAILABLE';
```

## Atomic claim — SQL

```sql
-- /claim-next: pick the oldest WAITING request the caller is allowed to see, atomically.
WITH claimed AS (
  SELECT r.id
  FROM video_assistance_requests r
  WHERE r.status = 'WAITING'
    AND r.institution_id = ANY($1::uuid[])   -- caller's institutions
  ORDER BY r.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE video_assistance_requests r
SET status = 'ASSIGNED',
    staff_id = $2,
    assigned_at = now()
FROM claimed
WHERE r.id = claimed.id
RETURNING r.*;
```

## LiveKit webhook receiver (new)

LiveKit pushes server-side events (room/participant/egress lifecycle) via signed webhooks. The backend exposes a single ingestion endpoint:

### `POST /internal/livekit/webhook`

- **Auth:** signature-only. The endpoint is **not** behind `@Auth`; it verifies the LiveKit signature using `WebhookReceiver` from `livekit-server-sdk` instantiated with the existing `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` (LiveKit signs webhooks as JWTs with the api_secret — no separate signing key). Requests with invalid or missing signatures return `401`.
- **Body:** standard LiveKit `WebhookEvent` JSON (`event` ∈ `room_started | room_finished | participant_joined | participant_left | egress_started | egress_updated | egress_ended | …`).
- **Routing:**
  - `participant_joined` → if both client and staff are in the room, transition request → `IN_CALL` (idempotent).
  - `participant_left` → start a 30 s reconnect-grace timer; if not back, transition → `ABORTED` with the appropriate `cancellation_reason`.
  - `egress_ended` → enqueue a `video-assistance-transcription` BullMQ job for the request.
  - All other events: log + ignore.
- **Idempotency:** every transition uses the request's current status as a precondition; out-of-order webhook delivery is safe.

## LiveKit contract

- **Room name:** `va-<request-uuid>` — guarantees 1:1 mapping, easy admin lookup.
- **Token claims:**
  - `roomCreate`: false (rooms pre-created by backend on `/claim`)
  - `roomJoin`: true, `room: <roomName>`
  - `canPublish: true`, `canSubscribe: true`, `canPublishData: true`
  - `metadata`: `{ "displayName": "<name>", "isStaff": <bool>, "requestId": "<uuid>" }`
  - `ttl`: 24h (consistent with existing token service)
- **Max participants:** 2. Backend rejects further joins via room metadata enforcement.
- **Egress:** **audio-only**, started by backend immediately after room creation. Output target: the shared S3 bucket already used by the backend (`S3_BUCKET_NAME`). Object key follows the pattern `[<S3_KEY_PREFIX>/]video-assistance-audio/<institution_id>/<request_id>.ogg` — the optional environment-scoped prefix is empty in production, set (e.g. `dev`) on dev. The path is built by the backend and passed to LiveKit when triggering egress; egress writes verbatim using the credentials from `/opt/livekit/egress.yaml`. Egress is stopped by `/end` and the audio file is deleted **after** transcription succeeds (or fails terminally).

## Voxtral pipeline

Trigger: request transitions to `COMPLETED` or `ABORTED` AND `audio_object_key` is non-null.

```ts
// documentation-only
// pseudo
async function transcribeRequest(requestId: string) {
  const r = await repo.findOne(requestId);
  if (!r.audio_object_key) return mark(r, 'SKIPPED');

  await mark(r, 'RUNNING');
  const buf = await objectStorage.download(r.audio_object_key);
  if (buf.length < MIN_AUDIO_BYTES) return mark(r, 'SKIPPED');

  try {
    const out = await mistralService.transcribeAudioWithVoxtral(
      buf,
      'audio/ogg',                     // LiveKit egress default
      `va-${requestId}.ogg`,
    );
    await repo.update(r.id, {
      transcript_text: out.text,
      transcript_language: out.language,
      transcript_status: 'DONE',
    });
    sse.publishToStaff(r.staff_id, { type: 'request.transcript_ready', data: ... });
  } catch (err) {
    await repo.update(r.id, { transcript_status: 'FAILED' });
    sse.publishToStaff(r.staff_id, { type: 'request.transcript_failed', data: ... });
  } finally {
    await objectStorage.delete(r.audio_object_key);
    await repo.update(r.id, { audio_object_key: null });
  }
}
```

`MIN_AUDIO_BYTES = 5 * 1024` (rough proxy for "at least 5 seconds of audio at low bitrate").

## Janitor schedules

Implemented as a BullMQ job on the existing scheduler queue (per project memory: Phase 2/3 of scheduler-queue migration is live).

| Job | Cadence | What it does |
| --- | --- | --- |
| `video-assistance-presence-janitor` | every 30 s | mark presence rows OFFLINE where `heartbeat_expires_at < now()` |
| `video-assistance-claim-janitor` | every 30 s | abort `ASSIGNED` requests where `assigned_at < now()-90s` and staff hasn't joined the LiveKit room |
| `video-assistance-wait-janitor` | every 60 s | abort `WAITING` requests older than `request_max_wait_seconds` (default 600) |
| `video-assistance-transcription` | on demand | one-shot, enqueued by `/end` and `/transcribe-retry` |

> **Flutter port note:** The Capacitor companion app respects the same JSON contracts. SSE endpoint is consumed via the existing `EventSource`-shim already used for AI Chat streaming.
