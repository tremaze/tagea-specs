# Contracts: Custom Field Number Formats

> API endpoints, DTOs, data models — what flows between frontend and backend when admins configure or consume number-format metadata.

## Data Models

### `NumberFormat` — discriminated union

```ts
// Source: apps/tagea-backend/src/custom-fields/types/custom-fields.types.ts
// Mirrored in: apps/tagea-frontend/src/app/models/custom-fields.model.ts
export type NumberFormat =
  | { kind: 'integer' }
  | { kind: 'decimal'; decimals: number; unit?: NumberFormatUnit }
  | { kind: 'currency' }
  | { kind: 'percentage'; decimals: number };
```

**Validation rules:**

- `kind` is required and must be one of the four literals above.
- `decimals` is required for `kind = decimal` and `kind = percentage`, absent for `integer` and `currency`. Range: `0..4` (integer).
- `unit` is optional for `kind = decimal`, absent for every other kind. When present, its value must be one of the codes in the unit catalog below.
- `currency` has no further properties in this iteration. The absence of a `currency` property is deliberate — EUR is implicit and the shape is additively extensible (e.g. `currency?: 'EUR' | 'USD' | 'CHF'`) without breaking existing documents.

**Persistence:** `NumberFormat` lives on `CustomFieldDefinition.ui_config.number_format`. The column is already JSONB with a `{}` default; no DDL migration is introduced. Definitions that do not carry the property continue to load and save unchanged.

### `NumberFormatUnit` — curated catalog

```ts
// Source: apps/tagea-backend/src/custom-fields/types/custom-fields.types.ts
export type NumberFormatUnit =
  // Zeit
  | 'Std.' | 'Min.' | 'Tage' | 'Wochen' | 'Monate' | 'Jahre'
  // Menge / Anzahl
  | 'Einheiten' | 'Stück' | 'Personen' | 'Sitzungen' | 'Kontakte' | 'Termine'
  // Maß
  | 'kg' | 'g' | 'cm' | 'm' | 'km'
  // Dosis
  | 'mg' | 'ml' | 'l'
  // Punkte / Score
  | 'Punkte' | 'Pkt.';
```

The catalog is code-owned — adding a unit is a code change, not a tenant-configurable input.

### `UiConfig` — extension

```ts
// Source: apps/tagea-backend/src/custom-fields/types/custom-fields.types.ts
export interface UiConfig {
  // ... existing properties
  number_format?: NumberFormat;
}
```

### `ValidationRules` — unchanged

`min`, `max`, and `required` remain orthogonal. Format-implied precision (`decimals`) and kind-implied rules (integers reject decimal separators, percentage stores `50`, not `0.5`) are enforced via the format itself, not via `validation_rules`.

## Endpoints

### `POST /admin/custom-field-definitions`

**Request additive change:** the `ui_config` payload may include `number_format` as described above. For non-`number` field types the property is ignored by the server.

```ts
// Payload excerpt
{
  "field_type": "number",
  "ui_config": {
    "number_format": { "kind": "decimal", "decimals": 2, "unit": "Std." }
  }
}
```

**Error codes:**
- `400` — `number_format.kind` missing or not one of the four literals.
- `400` — `decimals` out of `0..4` range.
- `400` — `decimals` present for `kind = integer` or `kind = currency`.
- `400` — `unit` present for any kind other than `decimal`, or not in the catalog.
- `400` — `number_format` present for a field whose `field_type !== 'number'`.

### `PATCH /admin/custom-field-definitions/:id`

Same shape and validation as `POST`. Clearing the format (`number_format: null`) is allowed and causes display/input to fall back to the default `{ kind: 'decimal', decimals: 2 }`.

### `GET /admin/custom-field-definitions/:id` and list endpoints

`ui_config.number_format` is returned when set. Legacy definitions return `ui_config` without the property.

### CSV export configuration

```ts
// Source: apps/tagea-backend/src/submissions/dto/csv-export-config.dto.ts
export class CsvColumnConfigDto {
  // ... existing properties
  include_unit?: boolean; // default false
}
```

When `include_unit === true` for a column whose source is a number custom field, the exported cell includes the formatted unit / currency symbol / percent symbol. When absent or `false`, the exported cell is the raw numeric value with `.` as decimal separator — matching the pre-feature contract.

## Events (WebSocket / Push)

Not applicable.

## Display & Formatter Contracts

### Frontend

A single utility formats custom-field display values across the app:

```ts
// Source: apps/tagea-frontend/src/app/utils/custom-field-display.utils.ts
export function formatCustomFieldForDisplay(
  value: unknown,
  definition: Pick<CustomFieldDefinition, 'field_type' | 'ui_config'>,
  locale: string,
): string;
```

For `field_type === 'number'`:
- Reads `definition.ui_config.number_format` (falls back to `{ kind: 'decimal', decimals: 2 }` when absent).
- Uses `Intl.NumberFormat(locale, …)` with style `'decimal'` (integer/decimal), `'currency'` with `currency: 'EUR'` (currency), or `'percent'` when `kind = percentage` — note: percent style in Intl expects the value in the `0..1` range, so the formatter multiplies by `0.01` at render time and never touches the stored value.
- Appends the `unit` string as a trailing suffix separated by a non-breaking space for `kind = decimal` with a unit set.

### Backend

A parallel utility is provided for PDF fill and other server-side rendering:

```ts
// Source: apps/tagea-backend/src/custom-fields/utils/number-formatter.util.ts
export function formatNumberForDisplay(
  value: number | string | null,
  format: NumberFormat | undefined,
  locale: string,
): string; // includes unit / currency / percent symbol

export function formatNumberForPdf(
  value: number | string | null,
  format: NumberFormat | undefined,
  locale: string,
): string; // locale separator but no suffix (PDF templates carry their own labels)

export function parseLocalizedNumber(
  input: string,
  locale: string,
): number | null; // accepts ',' and '.' as decimal separators; returns canonical number or null for invalid inputs
```

Both utilities accept `number` and `string` inputs — PostgreSQL's `numeric(20,6)` column returns `string` through TypeORM to preserve precision.

## Flutter Port Notes

- The Dart type mirrors the discriminated union via `sealed class NumberFormat` with subclasses `NumberFormatInteger`, `NumberFormatDecimal`, `NumberFormatCurrency`, `NumberFormatPercentage`.
- `intl` package (`NumberFormat` class) covers the Intl-equivalent formatting including Arabic / Persian digit scripts.
- The unit catalog is ported verbatim as a Dart `enum`.
