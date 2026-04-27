# Parity: Chat Attachment Source Menu

## Angular

- **Status:** N/A — Flutter-only enhancement. No Angular equivalent.
- **Path:** —
- **E2E:** —

## Flutter

- **Status:** 🚧 In progress
- **Path:** `apps/tagea_frontend/lib/home/tabs/chat_tab.dart`,
  `packages/ui/lib/src/media/`,
  `packages/ui/lib/src/widgets/sheets/`
- **Integration tests:** —

## Known Divergences

- **Web vs. mobile:** On Web the source sheet is skipped — the
  paperclip opens the system file picker directly (no native
  camera/gallery integration on Web).
- **Camera entry captures still images only.** Video via camera
  is not yet supported (use Gallery to pick a previously
  recorded video).

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-04-27 | ltoenjes | Spec created |
