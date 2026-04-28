# Contracts: Chat Attachment Source Menu

> No backend contracts. This feature is pure composer UX —
> attachment uploads continue to flow through the existing
> Matrix `room.sendFileEvent` pipeline (see chat-room contracts).

## Endpoints

None.

## Events (WebSocket / Push)

None.

## Data Models

> Documentation-only shape. No new wire contract — these are
> internal Dart types in `packages/ui`.

```dart
// Source: packages/ui/lib/src/widgets/sheets/tagea_attachment_source_sheet.dart
enum AttachmentSource { camera, gallery, files }
```
