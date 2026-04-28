# Feature: Chat E2EE Media

> **Status:** 🚧 Spec drafted — implementation in progress
> **Owner:** ltoenjes
> **Last updated:** 2026-04-28

## Vision (Elevator Pitch)

Media attachments (images, videos, voice messages, generic files, video thumbnails) sent into a Matrix end-to-end-encrypted chat room must be encrypted client-side before upload, so that the homeserver only ever stores ciphertext. The web client previously uploaded plaintext bytes even into E2EE rooms — this spec defines the corrected behavior and is the contract that all clients (web + Flutter) must obey.

## User Stories

- As a **user in an E2EE chat room** I want my image / video / voice / file attachments to be unreadable to the homeserver operator, so that the room's "encrypted" state holds for media as well as text.
- As a **user receiving an attachment from any client** I want it to render the same regardless of which client sent it, so that cross-platform conversations are seamless.

## Acceptance Criteria

- [ ] **Given** the active room has an `m.room.encryption` state event, **When** the user sends an attachment via any send path (`sendFileMessage`, `sendFileReply`, `sendVoiceMessage`, `sendMultipleFiles`), **Then** the file bytes are encrypted with **AES-CTR 256-bit** *before* the HTTP POST to `/_matrix/media/v3/upload`, and the homeserver receives ciphertext only.
- [ ] **Given** the active room is encrypted, **When** the message event is sent, **Then** the event content carries `content.file: EncryptedFile` (with `url`, `key` JWK, `iv`, `hashes.sha256`, `v: "v2"`) and **does NOT** carry `content.url`.
- [ ] **Given** the active room is encrypted *and* the attachment has a generated thumbnail (video case), **When** the message is sent, **Then** the thumbnail bytes are also encrypted with a **fresh** AES-CTR key/IV pair and the event surfaces `content.info.thumbnail_file: EncryptedFile` (and **does NOT** carry `content.info.thumbnail_url`).
- [ ] **Given** the active room is *not* encrypted, **When** the user sends an attachment, **Then** behavior is unchanged from the pre-fix baseline: plaintext upload, `content.url`, optional `content.info.thumbnail_url`.
- [ ] **Given** any combination of receiver and sender on (web, Flutter), **When** an encrypted media message is delivered, **Then** the receiver decrypts and renders it correctly. The web read path uses `MediaDecryptionService` ([packages/chat/src/lib/services/media/media-decryption.service.ts](../../../packages/chat/src/lib/services/media/media-decryption.service.ts)).
- [ ] **Given** image normalization or video compression runs, **When** the attachment is sent, **Then** all transformation steps complete *before* encryption — the bytes that get encrypted are the bytes the user intended to send, not pre-compression originals.
- [ ] **Given** an upload progress callback is wired (`onProgress`), **When** the file is sent in an E2EE room, **Then** the progress percentage reflects the upload of the **ciphertext** (not the plaintext), since that is the only transfer that occurs over the network. The user-visible progress remains "approximately the upload" — the encryption pass is fast (Web Crypto, single-pass AES-CTR) and not separately reported.
- [ ] **Given** an upload fails after encryption, **When** the user retries, **Then** a fresh AES key+IV are generated for the retry — keys/IVs are never reused across attempts (AES-CTR security requirement).

## UI States

| State           | When?                                                       | What does the user see?                                              | A11y notes                                                  |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Encrypting      | Brief moment between "send pressed" and upload start (E2EE) | Existing upload-in-progress UI; no separate encrypting indicator     | Same `aria-busy` / `aria-live` as today's upload state      |
| Uploading       | Network upload in progress                                  | Progress bar / percentage on the optimistic message bubble           | Existing                                                    |
| Sent (E2EE)     | Server accepted the encrypted attachment                    | Attachment renders normally (decrypted via `MediaDecryptionService`) | No visual difference vs. plaintext attachments              |
| Send failed     | Network or encryption error                                 | Existing failure UI on the bubble; retry available                   | Existing                                                    |
| Plaintext (E2E) | Room not encrypted                                          | Identical to the pre-fix baseline                                    | n/a                                                         |

> Encryption is intentionally invisible. The user does not see "encrypting…" as a distinct state; the room badge / lock icon is what communicates that E2EE is in effect.

## Flows

```
user picks file
       │
       ▼
normalize image orientation / compress video      (existing, unchanged)
       │
       ▼
       ├── room is E2EE? ──── no ──▶ POST plaintext to /upload ──▶ event { url }
       │
       yes
       │
       ▼
generate fresh AES-256-CTR key (JWK) + 128-bit IV
       │
       ▼
encrypt bytes with Web Crypto (crypto.subtle.encrypt)
       │
       ▼
SHA-256 hash of ciphertext  (matches read-side `verifyHash`)
       │
       ▼
POST ciphertext to /_matrix/media/v3/upload
       │
       ▼
event { msgtype, body, file: { url, key, iv, hashes: { sha256 }, v: "v2" }, info: { mimetype, size, ... } }
       │
       ▼ (video only)
repeat the same encryption pass for the thumbnail with NEW key+IV
       │
       ▼
event.info.thumbnail_file = { url, key, iv, hashes, v: "v2" }
event.info.thumbnail_info = { mimetype, w, h, size }    (no thumbnail_url)
```

## Non-Goals

- **Room avatar uploads** (`m.room.avatar` state events). Matrix does not encrypt room state events even in E2EE rooms — encrypting only the avatar payload would be inconsistent with the protocol and would break federation. Avatars remain plaintext for now and are tracked separately if needed.
- **Reactions, redactions, edits.** These are content-only events with no media payload.
- **Mid-upload re-encryption / resumable uploads.** Matrix media uploads are single-shot; a retry produces a fresh key+IV (see acceptance criteria).
- **Backfill / migration of historic plaintext media.** Media already uploaded in plaintext to E2EE rooms remains in the homeserver's media store — by decision (see [parity.md](./parity.md)). New uploads are correctly encrypted from the moment this fix ships.
- **Verifying encryption-helper symmetry between sender and receiver clients.** The Matrix MSC2089 spec is the contract; cross-client interop is verified by Flutter ↔ web round-trip, not by code-level coupling.

## Edge Cases

- **Room encryption state arrives late.** `client.isRoomEncrypted(roomId)` reads the locally-known room state. If the user sends an attachment in the brief window before the encryption state event syncs, the attachment could fall through to the plaintext path. Mitigation: rely on the matrix-js-sdk's event-send pipeline already gating on the room's encryption state — but the upload pre-step must read the same flag at the same point. If `isRoomEncrypted` returns `false` and the SDK later refuses to send the event because the room is encrypted, the upload was unnecessarily plaintext. We accept this as extremely unlikely (the room-list view that exposes the send button has already loaded the room state) and document it as a known edge.
- **Upload of a 0-byte file.** AES-CTR on empty input produces empty ciphertext. The event still carries `content.file` with the key/IV/hash of the empty stream. The server stores 0 bytes. Read side handles empty Blobs without special-casing.
- **MIME type missing on the original `File`.** The encrypted-file metadata stores `mimetype` on `content.info`, not on `content.file` (per MSC2089). If `file.type` is empty, default to `application/octet-stream` — matches the read-side default in [media-decryption.service.ts:95](../../../packages/chat/src/lib/services/media/media-decryption.service.ts:95).
- **Voice message Blob without filename.** Voice messages create the upload `File` from a Blob with a synthetic name (`voice_<timestamp>.<ext>`). The same name is used for `content.body`; encryption applies to the Blob bytes regardless.
- **Native (Capacitor) upload progress path.** `uploadWithNativeProgress` uses raw XHR to bypass CapacitorHttp. Encryption happens in the same JS context before the XHR — the XHR sends the ciphertext bytes. No special handling beyond passing the encrypted Blob/ArrayBuffer.
- **Image compression / orientation normalization.** These already run before upload ([message-sender.service.ts:347](../../../packages/chat/src/lib/services/conversation/message-sender.service.ts:347)). Encryption must run *after* them, so the encrypted bytes match what the receiver will display.

## Permissions & Tenant/Institution

- **No new permissions.** Encryption is a property of the room, decided by `m.room.encryption` state — not by tenant or institution.
- **Tenant flag:** The `chat` feature flag continues to gate the entire chat module; nothing here changes it.
- **Backend access checks:** Synapse handles media upload authorization via the access token. No tenant/institution check in this layer.

## Notifications (Push / In-App)

Out of scope. Push notifications for chat are wired separately and reference message events by ID, not media payload.

## i18n Keys

No new strings. Encryption is invisible to the user.

## Offline Behavior

**Flutter-specific.** Same model as plaintext attachments today: queue the send, encrypt-and-upload when network returns. Generated AES key+IV must be persisted alongside the queued send so that a retry decrypts to the same ciphertext when the server already accepted a partial upload (or, simpler: re-encrypt with fresh key+IV on retry — matches the AES-CTR-no-reuse rule).

## Security Notes

- **AES-CTR + integrity via SHA-256.** Matrix mandates AES-CTR (not GCM) and a separate `hashes.sha256` of the ciphertext, transported inside the (Megolm-encrypted) event content. The homeserver cannot tamper with the ciphertext without the receiver detecting it. This is the same construction the read side already verifies in [media-decryption.service.ts:99](../../../packages/chat/src/lib/services/media/media-decryption.service.ts:99).
- **Key reuse is forbidden.** Every upload generates a fresh 256-bit AES key (`crypto.subtle.generateKey({ name: 'AES-CTR', length: 256 })`, exported as JWK) and a fresh 128-bit IV (`crypto.getRandomValues(new Uint8Array(16))`). Reusing key+IV across files would catastrophically break AES-CTR confidentiality.
- **Plaintext metadata.** The Matrix spec leaves `mimetype` and `size` on `content.info` in plaintext (within the Megolm-encrypted event, so still hidden from the server). Filename goes on `content.body` (Megolm-encrypted). The homeserver sees: ciphertext length, upload time, and the requesting access token's owner. This is a known protocol limitation, not a bug to fix here.
- **Existing plaintext media.** Attachments uploaded by the web client to E2EE rooms before this fix are stored in plaintext on the homeserver and will remain so by decision (see [parity.md](./parity.md)). The encrypted-file metadata cannot be retro-fitted without re-uploading. Disclosure is internal only; no tenant-facing changelog.

## References

- **Angular implementation:** [packages/chat/src/lib/services/media/](../../../packages/chat/src/lib/services/media/), [packages/chat/src/lib/services/conversation/message-sender.service.ts](../../../packages/chat/src/lib/services/conversation/message-sender.service.ts)
- **Read-side counterpart (already merged):** [packages/chat/src/lib/services/media/media-decryption.service.ts](../../../packages/chat/src/lib/services/media/media-decryption.service.ts), [packages/chat/src/lib/services/conversation/message-parser.service.ts](../../../packages/chat/src/lib/services/conversation/message-parser.service.ts)
- **Matrix spec:** [Sending encrypted attachments (MSC2089 / Client-Server API §13.10.1.4)](https://spec.matrix.org/v1.11/client-server-api/#sending-encrypted-attachments)
- **EncryptedFile shape:** [contracts.md](./contracts.md)
- **Backend endpoints:** Synapse `/_matrix/media/v3/upload` — unchanged; receives ciphertext instead of plaintext when the sender's room is encrypted.
