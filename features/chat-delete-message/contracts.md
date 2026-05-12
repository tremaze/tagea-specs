# Chat — Delete Message — Contracts

## Matrix wire protocol

Deletion is a vanilla Matrix redaction. No new event types
or custom keys are introduced.

### Redaction event

```json
{
  "type": "m.room.redaction",
  "redacts": "$<original-event-id>",
  "content": {}
}
```

The Matrix SDK's `Room.redactEvent(eventId, {reason, txid})`
generates and sends this. v1 sends no `reason`.

After a successful redaction, the original event in the
timeline gains a populated `unsigned.redacted_because`. The
SDK exposes this via:

- `Event.redacted` (`bool`) — true iff `redactedBecause != null`.
- `Event.redactedBecause` (`Event?`) — the redaction event,
  whose `senderId` is the user who performed the redaction.

Server-side redaction also empties `Event.content`, so any
previous body / attachment metadata is gone.

## `ChatMessage` additions

`packages/matrix_chat/lib/src/models/chat_message.dart`
gains three fields:

```dart
/// Whether this event has been redacted.
final bool isDeleted;

/// Matrix user id that performed the redaction, if known.
/// Null when the message is not deleted.
final String? redactedByUserId;

/// True when [isDeleted] and [redactedByUserId] differs
/// from [senderId]. Lets the UI pick the
/// "deleted by moderator" placeholder string.
final bool redactedBySomeoneElse;
```

`ChatMessage.fromSdk(Event e)` populates these from
`e.redactedBecause`:

- If `e.redacted == false`: `isDeleted = false`,
  `redactedByUserId = null`,
  `redactedBySomeoneElse = false`.
- If `e.redacted == true`:
  - `isDeleted = true`.
  - `redactedByUserId = e.redactedBecause!.senderId`.
  - `redactedBySomeoneElse = redactedByUserId != e.senderId`.

`copyWith` and `props` are updated to include the three new
fields. Existing call sites that build `ChatMessage`
literals do **not** need to pass the new fields — they all
default sensibly.

## `ChatSendMixin` / `ChatCubit` additions

```dart
/// Redacts [eventId] in the current room. Throws if the
/// homeserver rejects the redaction (e.g. insufficient
/// power level). Caller is expected to confirm with the
/// user before invoking.
Future<void> redactMessage(String eventId);

/// Returns true iff the current user is allowed to delete
/// [message] from the current room. Combines the
/// 48-hour-own-message rule with the room-level redaction
/// power level.
bool canRedactMessage(ChatMessage message);
```

Implementation:

```dart
static const _whatsappDeleteWindow = Duration(hours: 48);

bool canRedactMessage(ChatMessage message) {
  if (message.isDeleted) return false;
  final room = sendClient.getRoomById(currentRoomId ?? '');
  if (room == null) return false;
  final isOwn = message.senderId == sendClient.userID;
  if (isOwn) {
    final age = DateTime.now().difference(message.timestamp);
    if (age <= _whatsappDeleteWindow) return true;
  }
  return room.canRedact;
}

Future<void> redactMessage(String eventId) async {
  if (currentRoomId == null) return;
  final room = sendClient.getRoomById(currentRoomId!);
  await room?.redactEvent(eventId);
}
```

Both methods live on `ChatSendMixin` so the cubit picks
them up alongside the existing send helpers.

## Widget API additions

### `MatrixSwipeToReply`

Adds an optional `onDelete` callback. Mirrors the existing
`onEdit` / `onDownload` pattern: `null` hides the menu
entry, non-null shows it.

```dart
const MatrixSwipeToReply({
  required VoidCallback onReply,
  required Widget child,
  bool isOwnMessage = false,
  VoidCallback? onEdit,
  void Function(Rect? sharePositionOrigin)? onDownload,
  VoidCallback? onDelete, // new
  Key? key,
});
```

The internal `_MenuAction` enum gains a `delete` entry, and
both the `_HoverMenu` and `_MessageActionSheet` render an
extra item when `onDelete != null`. The item uses
`Icons.delete_outline` and the localised
`strings.deleteAction` text in `theme.colorScheme.error`.

### `MatrixMessageList`

Wires `canRedactMessage` and the confirmation dialog into
the existing tile builder. Pseudo-code:

```dart
final canDelete = context
    .read<ChatCubit>()
    .canRedactMessage(msg);

MatrixSwipeToReply(
  ...,
  onDelete: canDelete
      ? () => _confirmAndRedact(msg.eventId)
      : null,
);
```

`_confirmAndRedact` shows the AlertDialog described in the
spec and calls `ChatCubit.redactMessage` on confirmation.

### `MatrixMessageBubble`

Short-circuits in `build` when `message.isDeleted`:
returns a single italic, low-emphasis `Text` inside the
existing bubble container, skipping the reply block,
event-content, edited indicator, status icon, and read
receipts. Sender name remains for non-own messages so the
timeline still shows who *had* sent the message.

### `MatrixInlineReply`

Receives a new optional `bool isDeleted` flag. When true,
`_displayBody` returns the deleted-placeholder string
instead of the body / type-specific label, and the icon
emoji prefix is dropped.
