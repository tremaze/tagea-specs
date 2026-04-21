# Contracts: Client Dokumente

## Endpoints Consumed

All accessed via `ClientDocumentService`. Base URLs:

- Documents: `${apiUrl}/client-portal/documents`
- Tasks: `${apiUrl}/client-portal/tasks`
- Context: `${apiUrl}/client-portal/context`

| Action                           | Service method                    | HTTP                                                | Notes                                                                                          |
| -------------------------------- | --------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Get client context               | `getContext()`                    | `GET /client-portal/context`                        | Returns `ClientContext` (institutions + cases) used by the upload dialog                       |
| List documents (paginated)       | `getDocuments(filters?)`          | `GET /client-portal/documents`                      | Returns `PaginatedDocuments`; list page calls with `{ limit: 100 }`                            |
| Get single document              | `getDocument(id)`                 | `GET /client-portal/documents/:id`                  | Returns `ClientDocument`                                                                       |
| List pending-signature documents | `getPendingSignatureTasks()`      | `GET /client-portal/tasks/signatures`               | Returns `ClientDocument[]` filtered server-side                                                |
| Pending-signature count          | `getPendingSignatureCount()`      | `GET /client-portal/tasks/signatures/count`         | Returns `{ count }`                                                                            |
| Download a document              | `downloadDocument(id)`            | `GET /client-portal/documents/:id/download`         | Returns `Blob`; Angular uses `NativeFileDownloadService` to trigger the platform save          |
| Get signed URL (preview)         | `getSignedUrl(id, expiresIn?)`    | `GET /client-portal/documents/:id/signed-url`       | Returns `{ url, expiresIn }`; used for inline preview (PDF iframe / image src)                 |
| Upload documents (multi-file)    | `uploadDocuments(files, options)` | `POST /client-portal/documents/upload`              | `multipart/form-data`; `institution_id` is required; returns the created `ClientDocument[]`    |
| Delete a document                | `deleteDocument(id)`              | `DELETE /client-portal/documents/:id`               | UI only offers when `uploaded_by === 'client'`; backend additionally enforces                  |
| List signature fields            | `getSignatureFields(id)`          | `GET /client-portal/documents/:id/signature-fields` | Returns `{ hasSignatureFields, fields: SignatureField[] }`                                     |
| Sign a document                  | `signDocument(id, request)`       | `POST /client-portal/documents/:id/sign`            | Body is `{ fieldName, signature }`; `signature` is a base64-encoded PNG of the drawn signature |

> Thumbnails are not fetched via a dedicated method. Image previews use `getSignedUrl()` to obtain a short-lived URL that the browser loads directly.

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/services/client-document.service.ts
// Backend DTO: apps/tagea-backend/src/client-portal/dto/client-document.dto.ts
//   (ClientDocumentResponseDto)
interface ClientDocument {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  category: DocumentCategory;
  description?: string;
  appointment_id?: string;
  uploaded_by: 'client' | 'staff'; // controls whether delete affordance is shown
  is_signed: boolean;
  signed_at?: Date;
  requires_signature: boolean;
  signature_requested_at?: Date;
  signature_pending: boolean; // requires_signature=true AND not yet signed
  created_at: Date;
  updated_at: Date;
}

enum DocumentCategory {
  ANTRAG = 'antrag',
  BESCHEID = 'bescheid',
  NACHWEIS = 'nachweis',
  SONSTIGES = 'sonstiges',
}

interface ClientDocumentFilter {
  page?: number;
  limit?: number;
  category?: DocumentCategory;
  search?: string;
}

interface PaginatedDocuments {
  items: ClientDocument[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}
```

## Context Shape

```ts
interface ClientContextCase {
  id: string;
  case_number: string;
  display_name: string;
  status: string;
}

interface ClientContextInstitution {
  id: string;
  name: string;
  short_name?: string;
  cases: ClientContextCase[];
}

interface ClientContext {
  institutions: ClientContextInstitution[];
  default_institution_id?: string;
}
```

## Upload Flow

```ts
// Multipart fields sent by the upload dialog
interface UploadDocumentRequest {
  institution_id: string; // required — resolved via getContext()
  case_id?: string;
  category?: DocumentCategory;
  description?: string;
  appointment_id?: string;
}

// Service signature
// uploadDocuments(files: File[], options: UploadDocumentRequest): Observable<ClientDocument[]>
// FormData appends: 'files' (repeated), 'institution_id', plus any optional fields present.
```

> **Flutter port note:** Use `dio` with `FormData` for multipart upload. Progress can be surfaced in the dialog via `onSendProgress`. File picker: `file_picker` for all platforms.

## Signature Flow

The signature is a drawn image captured in the preview dialog. Angular uses an HTML canvas and submits the PNG as a base64 data string. The server accepts it via the `signature` field.

```ts
interface SignatureField {
  name: string;
  type: string;
  isSigned: boolean;
}

interface SignatureFieldsResponse {
  hasSignatureFields: boolean;
  fields: SignatureField[];
}

interface SignDocumentRequest {
  fieldName: string; // name of the target signature field on the PDF
  signature: string; // base64-encoded PNG of the drawn signature
}

interface SignDocumentResponse {
  success: boolean;
  message: string;
}
```

> **Flutter port note:** Use the `signature` package (or a custom `CustomPaint`) to capture the drawing; export as PNG bytes then base64-encode before submission.
