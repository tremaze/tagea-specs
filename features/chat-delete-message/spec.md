# Chat — Delete Message

## Overview

Lets users delete messages from a Matrix room timeline. The
deletion is server-side (a Matrix redaction) so the message
disappears for every participant and federates automatically.

This spec covers v1: **delete for everyone**. A future
"delete for me" mode (Matrix-foreign, client-only hide) is
explicitly out of scope.

## User stories

- **Sender, within the WhatsApp window:** I sent something I
  regret. I want to remove it for everyone. I open the
  message action menu and tap "Delete".
- **Sender, after the WhatsApp window:** I sent a message
  yesterday and noticed a typo. The "Delete" option is no
  longer offered to me — I cannot rewrite history beyond
  48 hours without moderator power.
- **Moderator / admin:** Someone posted abusive or
  off-topic content. I have redaction power in the room and
  can remove their message at any time, regardless of when
  it was sent.
- **Recipient of a deleted message:** I see a placeholder
  bubble where the original message used to be ("This
  message was deleted"). The author / a moderator no longer
  wants me to see the original content.

## Permission rules

The "Delete" action is offered when **at least one** of the
following is true:

1. The message is **mine** AND was sent **within the last
   48 hours**.
2. The current user has **redaction power** in the room
   (Matrix `m.room.power_levels` `redact` ≤ user level —
   queried via `Room.canRedact` in the SDK).

Both predicates collapse to false if the message is
**already redacted** (`isDeleted`).

The 48-hour window is a **client-side convention** chosen
to mirror WhatsApp parity. Matrix itself accepts redactions
of one's own events with no time limit. The window is
defined as a single constant in code so it can be tuned or
made configurable later without touching call sites.

```dart
static const _whatsappDeleteWindow = Duration(hours: 48);
```

## UI

### Action menu entry

- **Where:** the existing message action menu used for
  Reply / Edit / Download.
  - Mobile: long-press → modal bottom sheet (entry below
    Edit / Share).
  - Desktop / web: hover chevron → popup menu (same
    position).
- **Visibility:** rendered only when the permission rules
  above hold (i.e. `onDelete != null` is passed in by the
  list). Hidden — not greyed out — when not permitted.
- **Optics:** destructive styling — error-colored icon
  (`Icons.delete_outline`) and label, matching the existing
  destructive patterns in the room-detail page.

### Confirmation dialog

Tapping "Delete" opens an `AlertDialog` from `packages/ui`:

- **Title:** "Delete message?"
- **Body:** "This message will be removed for everyone in
  this chat."
- **Actions:** Cancel (default) / Delete (destructive).

Confirmation is required for every deletion; the destructive
button is the non-default action, so accidental triggers
require an extra step.

### Deleted-message placeholder

When `ChatMessage.isDeleted` is true, the bubble renders a
single italic, muted line and skips:

- Reactions (the SDK redacts the relations server-side; UI
  must not render any straggler that lingers in the local
  cache).
- Inline reply block — the redacted message's reply target
  preview itself becomes a placeholder; see below.
- Edit indicator (`bearbeitet`).
- The action menu (no replying to / editing / sharing a
  redacted event).
- Read receipts (no receipt list on a tombstone).

The placeholder text varies by source so users can tell who
performed the deletion:

| Condition | String key |
| --- | --- |
| Sender deleted their own message | `deletedMessageOwnPlaceholder` — "You deleted this message" |
| Someone else deleted (and we know who, but they are not the original sender) | `deletedMessageByModeratorPlaceholder` — "This message was deleted by a moderator" |
| Anyone else / unknown | `deletedMessagePlaceholder` — "This message was deleted" |

Source detection: the redaction event itself
(`Event.redactedBecause`) has its own `senderId`. If that
sender ID matches the current user, the message was deleted
by us; if it matches the original sender, it was a self-
deletion; otherwise it is a moderator deletion. This is a
**display-only** signal — the permission check above does
not depend on it.

### Inline reply preview of a redacted target

When a message replies to an event that has since been
redacted, the reply block previewing the original switches
to the deleted-placeholder string. The reply block remains
tappable and continues to scroll the user to the original
event's position so they can confirm the bubble is gone in
context.

## Data flow

1. User taps **Delete** in the action menu.
2. UI shows the confirmation dialog.
3. On Confirm, the chat layer calls `ChatCubit.redactMessage(eventId)`.
4. The cubit calls `Room.redactEvent(eventId)` (Matrix SDK).
5. The SDK posts `m.room.redaction` to the homeserver. The
   server validates the redaction power and either accepts
   or rejects it (rejection surfaces as an exception).
6. On success, the timeline emits an updated event with
   `redactedBecause` populated. `ChatMessage.fromSdk` reads
   this and sets `isDeleted = true`.
7. The bubble re-renders as the placeholder.
8. The redaction federates over Matrix to all other
   homeservers and clients in the room.

### Offline behaviour

The Matrix SDK enqueues sends (including redactions) when
offline and retries on reconnect, identical to text sends.
No additional client logic is required.

If the redaction fails permanently (e.g. the user lost their
power level mid-flight), the SDK marks the redaction event
as errored. The original message remains visible. v1 does
not surface a retry UI for failed redactions; the user can
simply try again.

## Edge cases

- **Voice / image / video / file messages.** Same flow.
  Redaction strips the `content` of the original event so
  attachment metadata vanishes — the bubble collapses to
  the placeholder, regardless of the previous size.
- **Reply targets being redacted while you compose a
  reply.** The reply preview in the composer (`MatrixReplyPreview`)
  re-renders with the placeholder text. Sending the reply is
  still legal; the new message will reference a redacted
  parent, which is valid Matrix.
- **Reactions on a redacted message.** The Matrix SDK
  redacts the relations on the server side; the local
  timeline emits an update and the reactions disappear.
- **Push notification already delivered.** The original
  message text remains in the OS notification tray until
  the user dismisses it. This matches WhatsApp's behaviour
  and is an accepted v1 trade-off.
- **Deleting while the message is still sending
  (`status == sending`).** Out of scope for v1. The cubit
  only exposes `redactMessage` for messages whose
  `eventId` is server-confirmed; pending sends use the
  existing cancel / retry flow on the failed-status icon.
- **Deleting an already-deleted message.** Not possible —
  `canDelete` returns false when `isDeleted` is true. The
  menu entry is hidden.

## Localisation

New keys live under `chat.delete.*` in the slang JSON files
(`apps/tagea_frontend/lib/i18n/{de,en}.i18n.json`) and are
exposed to the package via additions to
`MatrixChatStrings` + `DefaultMatrixChatStrings` +
`SlangMatrixChatStrings`:

| Key on `MatrixChatStrings` | DE | EN |
| --- | --- | --- |
| `deleteAction` | Löschen | Delete |
| `deleteConfirmTitle` | Nachricht löschen? | Delete message? |
| `deleteConfirmBody` | Diese Nachricht wird für alle Teilnehmer entfernt. | This message will be removed for everyone in this chat. |
| `deleteConfirmAction` | Löschen | Delete |
| `deletedMessagePlaceholder` | Diese Nachricht wurde gelöscht | This message was deleted |
| `deletedMessageOwnPlaceholder` | Du hast diese Nachricht gelöscht | You deleted this message |
| `deletedMessageByModeratorPlaceholder` | Diese Nachricht wurde von einem Moderator gelöscht | This message was deleted by a moderator |

The existing generic `delete` ("Löschen" / "Delete") is left
alone — it is reused by other surfaces (room detail, devices)
and the new key set is scoped to chat deletion.

## Out of scope (v1)

- "Delete for me" — a client-only soft-hide that does not
  federate. Matrix has no native primitive for this; we
  would need a per-user blacklist event or a local Hive
  flag. Deferred.
- A dedicated retry UI for redactions whose send failed.
- Surfacing the deletion reason (`m.room.redaction.reason`)
  in the placeholder.
- Configurable WhatsApp-window length per organisation.
