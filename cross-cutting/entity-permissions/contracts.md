# Contracts: Entity-Level Permissions

> Wire contract for `_permissions` / `_fieldPermissions`, plus the pilot vocabulary for Appointments.

## Shared Shape

> Documentation-only shape. The concrete TypeScript types live in `apps/tagea-backend/src/permissions/ability/ability.types.ts` once implemented.

```ts
// Exactly one boolean per declared action for this entity type.
type ActionPermissions<A extends string> = Record<A, boolean>;

// Only forbidden fields appear; value is always `false`. Missing key = writable.
type FieldPermissions<F extends string> = Partial<Record<F, false>>;

interface WithPermissions<A extends string, F extends string = never> {
  _permissions: ActionPermissions<A>;
  _fieldPermissions?: FieldPermissions<F>;
}
```

## Endpoints

### `GET /<resource>/:id`

**Response (augmented):**

```ts
// Documentation-only shape.
interface EntityDetailResponse<T, A extends string, F extends string = never>
  extends WithPermissions<A, F> {
  // ...concrete entity fields for T...
}
```

**Error codes:** 401, 403 (no read access), 404.

### `PATCH /<resource>/:id`

**Request:** partial entity body.

**Response:** the updated entity (augmented with `_permissions` / `_fieldPermissions` computed from the **post-update** state).

**Error codes:**

- `403 Forbidden` — user may not `update` this entity (symmetry with `_permissions.update === false`).
- `422 Unprocessable Entity` — body touches a field where `_fieldPermissions[field] === false`. Error body names the forbidden field(s).

### `GET /<resource>` (list)

**Response:** items MUST NOT contain `_permissions` or `_fieldPermissions`.

## Pilot Vocabulary: Appointment

Source for rules: `apps/tagea-frontend/src/app/pages/appointment-detail/appointment-detail.component.ts:259–342` and `apps/tagea-frontend/src/app/services/calendar-event.service.ts:205–214`.

Rules match the Angular frontend 1:1 — they mirror what the frontend currently computes and gates. Domain actions that the frontend does not separately gate (`cancel`, `reschedule`, `reassignEmployee`, `addParticipant`) share the same rule as `update`; they exist as vocabulary hints for UI rather than as finer-grained authorization.

### Actions

| Action                   | True when                                                                                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `read`                   | User has read access to the appointment (already enforced by existing route guard).                                                                                                        |
| `update`                 | User is staff AND coarse `appointments.edit` permission.                                                                                                                                   |
| `delete`                 | User is staff AND coarse `appointments.delete` permission.                                                                                                                                 |
| `cancel`                 | Same as `update` (frontend has no distinct cancel-appointment gate for staff; cancellation is an edit that changes status).                                                                |
| `reschedule`             | Same as `update`.                                                                                                                                                                          |
| `reassignEmployee`       | Same as `update`.                                                                                                                                                                          |
| `addParticipant`         | Same as `update`.                                                                                                                                                                          |
| `removeParticipant`      | `update` AND current staff-participant count > 1.                                                                                                                                          |
| `editDocumentation`      | User is staff (frontend gates the documentation tab by staff mode only, with no terminal-state or permission check).                                                                       |
| `joinVideoMeeting`       | Tenant has video meetings enabled AND appointment `is_video_meeting` AND status ∉ `{cancelled_by_client, cancelled_by_counselor, no_show_short_notice, no_show_no_notice, no_show_with_notice}` AND `startsAt - 15min ≤ now ≤ endsAt + 30min`. Note: `completed` is joinable. |
| `cancelOwnParticipation` | User is a participant on this appointment AND own participant row has `cancelled_at == null` AND status ∉ non-cancellable set AND `now < startsAt - 15min`.                                |

**Non-cancellable status set** (used by `cancelOwnParticipation`): `cancelled_by_client`, `cancelled_by_counselor`, `completed`, `no_show_short_notice`, `no_show_no_notice`, `no_show_with_notice`.

**Non-joinable status set** (used by `joinVideoMeeting`): `cancelled_by_client`, `cancelled_by_counselor`, `no_show_short_notice`, `no_show_no_notice`, `no_show_with_notice`. `completed` is explicitly joinable.

### Fields (Positive Default — Only Forbidden Entries)

| Field                      | `false` when                                                                   |
| -------------------------- | ------------------------------------------------------------------------------ |
| `status`                   | User is not staff.                                                             |
| `template_id`              | Template already persisted on the entity (frozen after first save).            |
| `assigned_to_employee_ids` | User is not staff.                                                             |

`caseId`, `clientIds`, and `employeeIds` from earlier drafts are not entity fields on the Appointment PATCH surface; client/case/employee assignments are managed via participant endpoints and are not gated through field permissions on the appointment detail.

Any field not listed here is always writable (subject to the usual `update` check).

## Example Responses (Documentation-Only)

### Staff user fetches a future, scheduled appointment

```json
{
  "id": "appt-123",
  "title": "Erstgespräch",
  "status": "scheduled",
  "start_datetime": "2026-04-22T10:00:00Z",
  "_permissions": {
    "read": true,
    "update": true,
    "delete": true,
    "cancel": true,
    "reschedule": true,
    "reassignEmployee": true,
    "addParticipant": true,
    "removeParticipant": true,
    "editDocumentation": true,
    "joinVideoMeeting": false,
    "cancelOwnParticipation": false
  }
}
```

No `_fieldPermissions` — nothing is forbidden, every key is writable.

### Client user fetches the same appointment

```json
{
  "id": "appt-123",
  "title": "Erstgespräch",
  "status": "scheduled",
  "start_datetime": "2026-04-22T10:00:00Z",
  "_permissions": {
    "read": true,
    "update": false,
    "delete": false,
    "cancel": false,
    "reschedule": false,
    "reassignEmployee": false,
    "addParticipant": false,
    "removeParticipant": false,
    "editDocumentation": false,
    "joinVideoMeeting": false,
    "cancelOwnParticipation": true
  },
  "_fieldPermissions": {
    "status": false,
    "assigned_to_employee_ids": false
  }
}
```

### Staff user fetches a completed appointment

```json
{
  "id": "appt-456",
  "status": "completed",
  "_permissions": {
    "read": true,
    "update": true,
    "delete": true,
    "cancel": true,
    "reschedule": true,
    "reassignEmployee": true,
    "addParticipant": true,
    "removeParticipant": false,
    "editDocumentation": true,
    "joinVideoMeeting": false,
    "cancelOwnParticipation": false
  }
}
```

The frontend does not gate edit-scoped staff actions by terminal status, so the backend does not either. Cancellation workflows for clients are expressed via `cancelOwnParticipation` and respect the non-cancellable status set.
