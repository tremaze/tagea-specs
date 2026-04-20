# Contracts: Client Dokumente

## Endpoints Consumed

All accessed via `ClientDocumentService`. Exact paths are inside the service; Flutter port should read there for final wiring.

| Action                           | Service method                            | Notes                                                                                      |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| List documents                   | `getMyDocuments()` / `getDocuments()`     | Returns `ClientDocument[]`                                                                 |
| List pending-signature documents | `getPendingSignatureTasks()`              | Filtered server-side                                                                       |
| Download a document              | `downloadDocument(id)`                    | Returns binary blob; Angular uses `NativeFileDownloadService` to trigger the platform save |
| Upload a document                | `uploadDocument({ file, category, ... })` | `multipart/form-data`; returns the created `ClientDocument`                                |
| Delete a document                | `deleteDocument(id)`                      | Only allowed when `uploaded_by === 'client'`; backend enforces additionally                |
| Sign a document                  | `signDocument(id, signatureData)`         | Body carries the signature image (base64 or binary)                                        |
| Get thumbnail                    | `getThumbnail(id)` / URL-based            | Lazy-loaded per card for image-type docs                                                   |

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/services/client-document.service.ts
interface ClientDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  size: number;
  category: DocumentCategory;
  created_at: string; // ISO
  uploaded_by: 'client' | 'staff'; // controls whether delete affordance is shown
  is_signed?: boolean;
  signed_at?: string; // ISO
  // + other metadata
}

enum DocumentCategory {
  ANTRAG = 'antrag',
  BESCHEID = 'bescheid',
  NACHWEIS = 'nachweis',
  SONSTIGES = 'sonstiges',
}
```

## Upload Flow

```ts
interface DocumentUploadDialogResult {
  file: File;
  category: DocumentCategory;
  // + optional metadata
}
```

> **Flutter port note:** Use `dio` with `FormData` for multipart upload. Progress can be surfaced in the dialog via `onSendProgress`. File picker: `file_picker` for all platforms.

## Signature Flow

The signature is a drawn image captured from the preview dialog. The Angular implementation uses an HTML canvas; Flutter should use a `Signature` widget (from `signature` package) or a custom `CustomPaint`.

Server expects the signature as a base64-encoded PNG (verify exact contract against the service).
