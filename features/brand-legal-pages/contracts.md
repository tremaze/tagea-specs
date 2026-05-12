# Contracts: Brand Legal Pages

> Public + admin endpoints for per-brand Datenschutz / Impressum.

## Endpoints

### `PATCH /brands/:id` (existing — extended)

**Request body** (relevant fields, all optional):

> Documentation-only shape. Source: `apps/brand-manager/src/app/brands/dto/create-brand.dto.ts` (NestJS backend, not tagea-frontend).

```ts
interface UpdateBrandDto {
  privacyHtml?: string;
  imprintHtml?: string;
  accountDeletionEmail?: string;
  accountDeletionContactName?: string;
  accountDeletionAddress?: string;
  // ...other existing fields
}
```

`privacyHtml` and `imprintHtml` are sanitized server-side before persistence.

**Response:** updated `Brand` JSON.

**Error codes:** 400 (validation), 401, 403, 404.

### `GET /public/brands/:id/privacy`

**Auth:** none (`@Public()`).

**Response:** `text/html; charset=utf-8` with the brand's Datenschutz page (logo, display name, sanitized HTML body, last-updated footer).

**Error codes:** 404 (brand not found).

### `GET /public/brands/:id/imprint`

Same shape as `/privacy`, returns the brand's Impressum.

### `GET /public/brands/:id/request-account-deletion`

**Auth:** none (`@Public()`).

**Response:** `text/html; charset=utf-8` with the fixed DSGVO Art. 17 page. Brand-specific data points interpolated from the brand record:

- `accountDeletionEmail` — recipient of the prefilled `mailto:` link. If null, page renders an empty-state notice instead of the request flow.
- `accountDeletionContactName` — falls back to `displayName` when null.
- `accountDeletionAddress` — multi-line postal address. Hidden when null.

**Error codes:** 404 (brand not found).

## Data Models

> Documentation-only shape. Source: `apps/brand-manager/src/app/database/entities/brand.entity.ts` (NestJS backend, not tagea-frontend).

```ts
interface Brand {
  id: string;
  displayName: string;
  privacyHtml: string | null;
  imprintHtml: string | null;
  accountDeletionEmail: string | null;
  accountDeletionContactName: string | null;
  accountDeletionAddress: string | null;
  // ...other existing fields
}
```

## Sanitization rules

Allowed tags: `p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `a`, `strong`, `em`, `u`, `br`, `hr`, `blockquote`.

Allowed attributes: `a[href|title|target|rel]`. URL schemes: `http`, `https`, `mailto`, `tel`.

Stripped: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `on*` event handlers, `javascript:` URLs.

> **Flutter port note:** Mobile apps consume the public URLs via WebView / external browser. No JSON contract is shared with Flutter for the rendered pages.
