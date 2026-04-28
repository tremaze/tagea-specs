# Parity: Chat E2EE Media

## Angular (web client)

- **Status:** 🚧 In progress (this commit fixes the upload side)
- **Read path:** ✅ — [packages/chat/src/lib/services/media/media-decryption.service.ts](../../../packages/chat/src/lib/services/media/media-decryption.service.ts), wired into image/video/audio/file/voice components and the media viewer (commits `8ab912e5c`, `023b3c3b6`)
- **Write path:** 🚧 — [packages/chat/src/lib/services/media/media-upload.service.ts](../../../packages/chat/src/lib/services/media/media-upload.service.ts) and [packages/chat/src/lib/services/conversation/message-sender.service.ts](../../../packages/chat/src/lib/services/conversation/message-sender.service.ts) being updated in this change
- **E2E:** No dedicated test yet. Adding one would require an E2EE-enabled room in the e2e seed data plus a real Matrix homeserver — currently the e2e setup uses a single test homeserver. Tracked as follow-up.

## Flutter

- **Status:** ✅ — Flutter app already encrypts media correctly when sending into E2EE rooms. This is what surfaced the web-client bug.
- **Path:** `lib/features/chat/...` _(in tagea-flutter repo)_

## Known Divergences

- **Avatar upload encryption.** Both platforms upload room avatars in plaintext (Matrix protocol does not encrypt state events). Documented as a non-goal in [spec.md](./spec.md).
- **Encrypting indicator.** Web shows no separate UI for the encryption pass; if Flutter chooses to surface a brief "encrypting…" microstate, that's a platform-level UX choice and not a spec divergence.

## Resolved (operational, outside code scope)

- **Historic plaintext media in E2EE rooms.** ✅ Decided 2026-04-28: leave as-is. The blobs already on the Synapse media store stay where they are — re-uploading or admin-side deletion would create more operational risk than benefit, and the affected media is bounded (only what the web client uploaded before the fix). New uploads are correctly encrypted from this commit forward.
- **Disclosure scope.** ✅ Decided 2026-04-28: internal only. No tenant-facing changelog entry; the fix lands silently and the security note stays in this spec / parity log.

## Port Log

| Date       | Who      | What                                                                  |
| ---------- | -------- | --------------------------------------------------------------------- |
| 2026-04-28 | ltoenjes | Spec created; web write-path fix in progress; Flutter already correct |
