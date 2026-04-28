# Contracts: Chat E2EE Media

> Wire shapes that flow between the web/Flutter client, the Matrix homeserver, and other clients.

## HTTP Endpoints (Synapse)

### `POST /_matrix/media/v3/upload`

Unchanged from plaintext uploads. The change is what the body contains.

**Request body (E2EE rooms):** AES-CTR ciphertext bytes (raw, not multipart).
**Request `Content-Type`:** `application/octet-stream` is acceptable — the original file's MIME type is *not* sent at the HTTP layer for encrypted uploads, since the homeserver must not learn it. (A practical compromise some clients use: send `application/octet-stream` to avoid leaking it via HTTP. Web client passes `application/octet-stream`.)
**Response:**

> Documentation-only shape.

```ts
// documentation-only
interface UploadResponse {
  content_uri: string; // mxc://... — opaque identifier for the ciphertext blob
}
```

**Error codes:** 401 (no/invalid access token), 403 (forbidden), 413 (too large), 429 (rate limit).

## Matrix Events

### Encrypted media event content (room is E2EE)

The event itself is wrapped in `m.room.encrypted` (Megolm) before transmission. The content shown below is what's *inside* the Megolm payload — visible only to room members with the room key.

> Documentation-only shape — the wire contract per Matrix spec. Our code mirrors it as `EncryptedFileInfo` in [packages/ui/src/lib/models/media.model.ts](../../../packages/ui/src/lib/models/media.model.ts).

```ts
// documentation-only
// Source: matrix-js-sdk/lib/@types/media.d.ts (EncryptedFile, MediaEventContent)

interface EncryptedFile {
  url: string;                                 // mxc://... ciphertext blob
  key: {                                       // AES-256-CTR key as JWK
    kty: 'oct';
    alg: 'A256CTR';
    k: string;                                 // base64url, unpadded
    ext: true;
    key_ops: ['encrypt', 'decrypt'];
  };
  iv: string;                                  // 16-byte (128-bit) IV, unpadded base64
  hashes: { sha256: string };                  // SHA-256 of the ciphertext, unpadded base64
  v: 'v2';                                     // protocol version — must be "v2"
}

interface EncryptedMediaContent {
  msgtype: 'm.image' | 'm.video' | 'm.audio' | 'm.file';
  body: string;                                // filename or human caption (Megolm-encrypted)
  file: EncryptedFile;                         // required — replaces `url` in encrypted rooms
  info?: {
    mimetype?: string;                         // plaintext-in-Megolm — server can't see it
    size?: number;                             // plaintext bytes (≈ ciphertext bytes — AES-CTR doesn't expand)
    w?: number;                                // images/videos
    h?: number;
    duration?: number;                         // audio/video, milliseconds
    thumbnail_file?: EncryptedFile;            // present iff a thumbnail was generated AND room is E2EE
    thumbnail_info?: {
      mimetype?: string;
      w?: number;
      h?: number;
      size?: number;
    };
  };
}
```

> **Important:** When the room is encrypted, the event MUST NOT carry a top-level `url` and MUST NOT carry `info.thumbnail_url`. Those fields belong to plaintext-room events only. Sending both is a spec violation (and several clients will reject it).

### Plaintext media event content (room is NOT E2EE)

Unchanged from current behavior.

> Documentation-only shape.

```ts
// documentation-only
interface PlaintextMediaContent {
  msgtype: 'm.image' | 'm.video' | 'm.audio' | 'm.file';
  body: string;
  url: string;                                 // mxc://... plaintext blob
  info?: {
    mimetype?: string;
    size?: number;
    w?: number;
    h?: number;
    duration?: number;
    thumbnail_url?: string;                    // mxc://... plaintext thumbnail blob
    thumbnail_info?: { mimetype?: string; w?: number; h?: number; size?: number };
  };
}
```

## Internal interfaces

### `MediaUploadService.uploadFile` / `uploadFileWithProgress` return shape

> Documentation-only shape — the actual return type is the union below, declared inline at the call site in [media-upload.service.ts](../../../packages/chat/src/lib/services/media/media-upload.service.ts).

```ts
// documentation-only
// packages/chat/src/lib/services/media/media-upload.service.ts
type UploadResult =
  | { url: string; encrypted: false }                                  // plaintext path
  | { url: string; encrypted: true; encryptedFile: EncryptedFileInfo }; // E2EE path
```

The `encryptedFile` field is populated when the upload was encrypted — it carries the full `EncryptedFile` shape that callers must thread into `content.file` of the message event. `url` mirrors `encryptedFile.url` for symmetry but should not be used directly by callers in the encrypted case.

### Detecting room encryption

> Documentation-only shape — comes from matrix-js-sdk.

```ts
// documentation-only
// matrix-js-sdk/lib/client.d.ts
interface MatrixClient {
  isRoomEncrypted(roomId: string): boolean;
}
```

`MediaUploadService` and `MessageSenderService` both call `client.isRoomEncrypted(roomId)` at the moment of upload / send. The caller (`MessageSenderService`) passes `roomId` down to the upload service so the upload service can branch on encryption without reaching back into the sender's room context.

## Cross-Client Compatibility

| Sender → Receiver | Plaintext room                          | E2EE room                                                       |
| ----------------- | --------------------------------------- | --------------------------------------------------------------- |
| Web → Web         | works (existing)                        | works post-fix (this spec)                                      |
| Web → Flutter     | works (existing)                        | works post-fix — Flutter already implements the read side       |
| Flutter → Web     | works (existing)                        | works as of [023b3c3b6](../../../packages/chat/src/lib/services/media/media-decryption.service.ts) (read side) |
| Flutter → Flutter | works (existing)                        | works (existing)                                                |

> Flutter port note: the Dart port reads this spec and matrix-js-sdk's spec — it does not need to mirror the TypeScript interfaces verbatim. The wire contract is the JSON shape above.
