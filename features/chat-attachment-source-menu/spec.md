# Feature: Chat Attachment Source Menu

> **Status:** 🚧 Spec drafted — implementation in progress
> **Owner:** ltoenjes
> **Last updated:** 2026-04-28

> **Flutter port note:** This is a Flutter-only enhancement to the
> chat composer. The Angular reference frontend has no equivalent —
> chat is owned by the Flutter port (matrix_chat package).

## Vision (Elevator Pitch)

When attaching content to a chat message, the user picks the
**source** — Camera, Gallery, or Files — instead of jumping straight
into a generic file picker. Photos and videos become first-class
content, not buried two levels deep behind the system file dialog.

## User Stories

- As a **chat user on a phone** I want to take a photo and send it
  in one flow, so I don't have to leave the app to use the camera.
- As a **chat user on a phone** I want to pick a photo *or* a video
  from my gallery via the system photo picker, so I get the
  familiar OS-level picker for media.
- As a **chat user** I want the existing "any file" option to stay
  available, so I can still send PDFs, voice notes, etc.

## Acceptance Criteria

- [ ] **Given** the user is in a room and the composer is visible,
  **When** the user taps the paperclip / attach button on a mobile
  platform, **Then** a modal bottom sheet appears with three
  options: **Camera**, **Gallery**, **Files**.
- [ ] **Given** the source sheet is open, **When** the user picks
  **Camera**, **Then** the device camera opens for a photo and the
  resulting image is staged in the composer's attachment preview.
- [ ] **Given** the source sheet is open, **When** the user picks
  **Gallery**, **Then** the system photo picker opens allowing
  selection of an image *or* a video, and the chosen item is staged.
- [ ] **Given** the source sheet is open, **When** the user picks
  **Files**, **Then** the platform file picker opens (existing
  behavior — any file type) and the chosen file is staged.
- [ ] **Given** the source sheet is open, **When** the user
  dismisses it (drag down, tap outside), **Then** no picker opens
  and no file is staged.
- [ ] **Given** any picker is open, **When** the user cancels
  inside the picker, **Then** the composer returns to its prior
  state without a staged file.
- [ ] **Given** the platform is **Web**, **When** the user taps the
  attach button, **Then** the system file picker opens directly
  (no source sheet) — Web has no native camera or gallery surface
  the picker would integrate with.
- [ ] **Given** the user denies camera permission on iOS/Android,
  **When** the user picks Camera, **Then** the platform shows its
  permission prompt; on denial the composer returns to its prior
  state without a staged file (no crash).
- [ ] **Given** the user picks a **video** from the gallery on any
  supported platform (iOS, Android, Web), **When** the file is
  staged, **Then** the staging tile shows a thumbnail extracted
  from the video's first frame with a play-circle overlay — not a
  generic file icon. If thumbnail extraction fails, the tile falls
  back to the generic file icon (no crash) and the file can still
  be sent.

## UI States

| State                    | When?                                                                | What does the user see?                                                                                                  | A11y notes                                                       |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Sheet closed (idle)      | Initial composer state                                                | Paperclip icon next to the text field                                                                                    | Icon button has accessible label "Attach file"                   |
| Sheet open               | After tap on paperclip (mobile only)                                  | Modal bottom sheet with drag handle and three list tiles: Camera, Gallery, Files (each with a leading icon)              | Each tile is focusable; tap target ≥ 48dp; semantic label is the option name |
| Picker open              | After picking a source                                                 | OS-level picker (camera / photo picker / file picker)                                                                    | OS-owned                                                         |
| Staged (image)           | After successful image pick                                            | Image bytes rendered as a thumbnail in the composer's staging strip; remove (×) overlay                                  | Existing staging UI (no change)                                  |
| Staged (video)           | After successful video pick                                            | Extracted first-frame thumbnail with a play-circle overlay; remove (×) overlay. Falls back to generic file icon if extraction fails | Existing staging UI (no change)                                  |
| Staged (other file)      | After successful file pick (PDF, etc.)                                 | Generic file icon + truncated filename; remove (×) overlay                                                                | Existing staging UI (no change)                                  |
| Cancelled                | After user dismiss / picker cancel                                     | Composer unchanged                                                                                                       | —                                                                |
| Web fallback             | Any tap on attach button on Web                                        | OS file picker only (no sheet)                                                                                           | —                                                                |

## Flows

```text
                      ┌─────────────────┐
                      │ Tap paperclip   │
                      └────────┬────────┘
                               │
                       ┌───────┴────────┐
                       │ Platform == Web│
                       └───┬────────┬───┘
                       yes │        │ no
                           ▼        ▼
                   ┌─────────────┐  ┌────────────────────┐
                   │ FilePicker  │  │ Source bottom sheet│
                   │ (any file)  │  │ Camera / Gallery / │
                   │             │  │       Files        │
                   └──────┬──────┘  └──┬───┬─────────────┘
                          │            │   │
                          │     Camera │   │ Gallery
                          │            ▼   ▼
                          │    ┌──────────┐ ┌────────────┐
                          │    │ Camera   │ │ Photo      │
                          │    │ (image   │ │ picker     │
                          │    │  capture)│ │ (image OR  │
                          │    │          │ │  video)    │
                          │    └────┬─────┘ └────┬───────┘
                          │         │            │
                          │         │   Files    │
                          │         │     │      │
                          │         │     ▼      │
                          │         │  ┌──────┐  │
                          │         │  │ File │  │
                          │         │  │picker│  │
                          │         │  └───┬──┘  │
                          │         │      │     │
                          ▼         ▼      ▼     ▼
                     ┌────────────────────────────────┐
                     │  PickedFile staged in composer │
                     │  (existing staging behavior)   │
                     └────────────────────────────────┘
```

## Non-Goals

- **Recording video via the in-app camera entry.** The Camera menu
  item captures a still image only. Video recording can be reached
  via the OS gallery's built-in camera shortcut, or — if demanded
  later — by adding a fourth menu entry.
- **Multi-select.** The flow stages one file per menu invocation
  (matches current behavior). The user can re-tap the paperclip
  to stage another file before sending.
- **Editing / cropping** picked images before staging. Out of scope.
- **Image compression / quality settings.** Inherits whatever the
  composer's existing send pipeline does (`ChatCubit.sendFileMessage`
  with optional `mediaCompressor`).
- **Web camera capture via `<input capture>`.** Web stays on the
  generic file picker; we explicitly do not attempt to surface
  Camera/Gallery on the web because the experience would be
  inconsistent and confusing.

## Edge Cases

- **Permission denied (iOS/Android):** The OS prompt is shown by
  the underlying picker plugin. On denial, the picker resolves
  with `null` and no file is staged. No custom error message is
  rendered (consistent with the existing Files flow).
- **User cancels inside the OS picker:** Same — `null` result, no
  staging. Sheet does not reopen; user can re-tap paperclip.
- **Picked file too large:** No size check at the source-menu
  layer. Existing send pipeline handles upload errors.
- **Sheet open + back-gesture (Android) / drag-down (iOS):** Sheet
  dismisses, returns `null`, composer state unchanged.
- **Hot-reload / state restoration:** Sheet is ephemeral
  (`showModalBottomSheet`); no persistence required.
- **Editing an existing message:** Composer hides the paperclip in
  edit mode (existing behavior, unchanged) — sheet cannot be
  reached from edit.

## Permissions & Tenant/Institution

- **Required roles:** Same as parent chat feature — none beyond
  authenticated tenant access. No new permission gates.
- **Platform permissions:**
  - **iOS** `Info.plist`:
    - `NSCameraUsageDescription` — required for Camera entry.
    - `NSPhotoLibraryUsageDescription` — required for Gallery on
      older OS versions; modern photo picker on iOS 14+ does not
      strictly require it but the plugin still reads it as a
      fallback.
    - `NSMicrophoneUsageDescription` — required only if Gallery
      returns videos with audio that the underlying plugin
      probes; harmless to declare.
  - **Android:** `image_picker` ≥ 1.x uses the Android Photo Picker
    where available, which does not require runtime permissions.
    No manifest changes needed beyond what `image_picker` ships.

## Notifications (Push / In-App)

- **Triggers:** None. This feature is pure composer UX.

## i18n Keys

User-facing strings (German is the base locale):

| Key                                  | German    | English   |
| ------------------------------------ | --------- | --------- |
| `chat.attachmentSource.camera`       | Kamera    | Camera    |
| `chat.attachmentSource.gallery`      | Galerie   | Gallery   |
| `chat.attachmentSource.files`        | Dateien   | Files     |

Lives in `apps/tagea_frontend/lib/i18n/de.i18n.json` and
`en.i18n.json`. The bottom-sheet widget itself takes labels as
parameters and stays i18n-agnostic in `packages/ui`.

## Offline Behavior

- The source sheet itself is fully offline (pure UI).
- Picked files are staged locally; send attempts follow the
  existing chat send pipeline (which handles offline / retry).

## References

- **Composer entry point:**
  `packages/matrix_chat/lib/src/widgets/chat/matrix_message_input.dart`
  (`_handleAttach`, line 259).
- **Existing file picker:**
  `packages/ui/lib/src/media/tagea_file_picker.dart`.
- **App-side wiring:**
  `apps/tagea_frontend/lib/home/tabs/chat_tab.dart` (line 64).
- **Underlying plugins:**
  - [`image_picker`](https://pub.dev/packages/image_picker) — gallery / camera on iOS/Android.
  - [`fc_native_video_thumbnail`](https://pub.dev/packages/fc_native_video_thumbnail) — first-frame extraction on iOS/Android (verified publisher `flutter-cavalry.com`).
  - On Web, the first-frame extraction uses a `<video>` element seeked to `0.1s` and `<canvas>.toDataURL('image/jpeg')` — no plugin.
- **Shared thumbnail helper:**
  `packages/ui/lib/src/media/video_thumbnail.dart` (conditional
  `_io` / `_web` implementations). Used by `TageaImagePicker` for
  mobile picks and by the example app's web file picker.
