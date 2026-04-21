# Contracts: Gehaltsnachweise

## Service: `ProofOfSalaryService`

From [`proof-of-salary.service.ts`](../../../apps/tagea-frontend/src/app/services/proof-of-salary.service.ts):

| Method / signal                          | Purpose                                               |
| ---------------------------------------- | ----------------------------------------------------- |
| `loadDocuments()`                        | Fetch payslip documents for the current employee      |
| `loading()`                              | Loading signal                                        |
| `error()`                                | Error signal (nullable)                               |
| `hasDocuments()`                         | Computed boolean — whether any documents loaded       |
| `documentCount()`                        | Computed number — count of loaded documents           |
| `documents()`                            | Readonly `Signal<ProofOfSalaryDocument[]>`            |
| `downloadDocumentBlob(documentId)`       | Returns `Observable<Blob>` — auth-scoped PDF fetch    |
| `downloadDocument(documentId, fileName)` | Triggers browser save via `NativeFileDownloadService` |
| `formatDocumentDate(date)`               | Formats `YYYY-MM` → localized month/year (de-DE)      |
| `clear()`                                | Resets documents, loading, and error signals          |

## Data Models

```ts
// apps/tagea-frontend/src/app/services/proof-of-salary.service.ts
interface ProofOfSalaryDocument {
  id: string;
  fileName: string; // camelCase — matches backend response
  date: string; // YYYY-MM format (period month)
}

interface ProofOfSalaryListResponse {
  content: ProofOfSalaryDocument[];
  totalElements: number;
  totalPages: number;
}

interface ProofOfSalaryQuery {
  from?: string; // YYYY-MM
  until?: string; // YYYY-MM
}
```

```ts
// Component-local helper
interface MonthGroup {
  label: string; // Display label (e.g. "März 2026")
  sortKey: string; // Stable key for sort order (e.g. "2026-03")
  documents: ProofOfSalaryDocument[];
}
```

## Preview

Consumes the shared `DocumentPreviewDialogComponent` (same dialog as [client-dokumente](../client-dokumente/spec.md)).

The component opens the dialog with this `data` payload:

```ts
{
  document: Document,        // shape adapted from ProofOfSalaryDocument -> document.service Document
  preSignedUrl: string,      // object URL created from the downloaded Blob
  downloadFn: () => Observable<Blob>, // re-invokes ProofOfSalaryService.downloadDocumentBlob(doc.id)
}
```

> **Flutter port note:** use the shared preview widget and `syncfusion_flutter_pdfviewer` (or `flutter_pdfview`) with an auth-header-aware loader — payslips are authenticated resources.

## Backend API

Controller: `apps/tagea-backend/src/proof-of-salary/proof-of-salary.controller.ts`

- `@Auth({ scope: 'authenticated', allowedUserTypes: [UserType.EMPLOYEE] })` — employee-only.
- Base path: `/proof-of-salary`.

| Method | Path                     | Request                 | Response                       |
| ------ | ------------------------ | ----------------------- | ------------------------------ |
| GET    | `documents`              | `ProofOfSalaryQueryDto` | `ProofOfSalaryListResponseDto` |
| GET    | `documents/:id/download` | path param `id`         | `application/pdf` stream       |

Backend access chain (enforced in both endpoints, in order):

1. Tenant feature flag `proofOfSalary.enabled` must be true (else `403`).
2. Employee row resolved from JWT `authUserId` (else `403 "Employee record not found"`).
3. Employee column `access_proof_of_salary` must be true (else `403`).
4. Employee column `personnel_number` must be set (else `403`).
5. DMS fetch via `DvelopDmsService.getDocuments(personnelNumber, from?, until?)` / `downloadDocument(personnelNumber, documentId)`.

Download response sets:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="Gehaltsnachweis-<id>.pdf"`

Backend DTOs are at `apps/tagea-backend/src/proof-of-salary/dto/proof-of-salary.dto.ts`. The frontend mirrors them exactly (same field names / casing — `content` / `totalElements` / `totalPages` on the list; `id` / `fileName` / `date` on the item).
