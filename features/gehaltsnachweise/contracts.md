# Contracts: Gehaltsnachweise

## Service: `ProofOfSalaryService`

From [`proof-of-salary.service.ts`](../../../apps/tagea-frontend/src/app/services/proof-of-salary.service.ts):

| Method / signal   | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `loadDocuments()` | Fetch payslip documents for the current employee           |
| `loading()`       | Loading signal                                             |
| `error()`         | Error signal (nullable)                                    |
| `hasDocuments()`  | Computed boolean — whether any documents loaded            |
| `documents()`     | Raw `ProofOfSalaryDocument[]` signal (or similar — verify) |

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

> **Flutter port note:** use the shared preview widget and `syncfusion_flutter_pdfviewer` (or `flutter_pdfview`) with an auth-header-aware loader — payslips are authenticated resources.
