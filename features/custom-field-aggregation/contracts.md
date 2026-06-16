# Contracts: Custom Field Aggregation (Positionslisten, Stufe 1)

> API endpoints, DTOs, storage shapes, events. Stufe 1 introduces **no new endpoints** — it extends existing group-config DTOs, the materialization trigger output, and the repeating-rows read shape. New shapes are marked `documentation-only` (they do not exist in the Angular source yet).

## Storage — group aggregation config

A new group-scoped JSONB column on `custom_field_groups`, alongside the existing `csv_export_config` / `visibility_condition` JSONB columns.

```ts
// documentation-only
// Proposed shape, not yet in code.
// Persisted at: custom_field_groups.aggregation_config (jsonb, nullable)
interface AggregationConfig {
  kind: 'sum'; // Stufe 1: only 'sum'. Reserved for avg/min/max/count later.
  source_field_key: string; // field_key of a number-type field in THIS group
}
```

- Authored only when `is_repeating = true` and `key` is set.
- `null` (or absent) ⇒ no aggregate is materialized for the group.

## Storage — materialized aggregate (trigger output)

The `update_entity_custom_fields_cache()` trigger emits the aggregate as a **top-level scalar key** in the host's `custom_fields_summary` (and, unavoidably, `custom_fields_full`) JSONB, in a reserved double-underscore namespace (decision D-A).

```ts
// documentation-only — JSONB shape inside <host_table>.custom_fields_summary
// Existing repeating wrapper (unchanged):
//   "<group_key>": { "rows": [ { "row_id": "...", "<field_key>": <value>, ... } ], "row_count": <int> }
// NEW top-level scalar sibling:
//   "<group_key>__<source_field_key>__sum": <numeric>   // NUMERIC(20,6), rounded to the format's decimals
```

- Computed as `SUM(value_number)` in SQL over the configured column (exact NUMERIC); never in JS.
- Absent/blank cells skipped (D-B); zero contributing rows ⇒ `0`.

## Admin DTOs — group create/update (extension)

The existing create/update section-or-group DTOs gain an optional `aggregation_config`. Mirrors how `visibility_condition` was added for sections (additive; `@Allow()`/validated nested object so `forbidNonWhitelisted` does not reject it with 400).

```ts
// documentation-only
// Proposed additive field on the existing group DTOs.
// Backend: Create/Update group|section DTO (custom-fields + submission-templates controllers)
// Frontend: the group patch/write model
interface GroupWriteWithAggregation {
  // ...existing fields (name, is_repeating, max_rows, row_label_template, key, visibility_condition)...
  aggregation_config?: AggregationConfig | null;
}
```

## Read — repeating rows response (extension)

Both read paths must surface the materialized aggregate without recomputing it (decision: one source of truth; live path reads the trigger value through — R4).

- **Path A (submissions / summary-backed):** the repeating wrapper mapper additionally extracts the aggregate scalar.
- **Path B (live EAV, `getRepeatingGroupRows`, 11 hosts):** the response DTO carries the aggregate read from the host's `custom_fields_summary` (not recomputed).

```ts
// documentation-only
// Proposed additive field on the repeating-rows response.
interface RepeatingGroupRowsResponseWithAggregate {
  group_id: string;
  group_key: string;
  rows: Array<{ row_id: string; fields: Record<string, unknown> }>;
  // NEW: present only when the group has aggregation_config
  aggregate?: { source_field_key: string; kind: 'sum'; value: number } | null;
}
```

## Frontend models (existing, referenced)

These existing Angular shapes are the integration points the new fields attach to.

```ts
// Source: apps/tagea-frontend/src/app/components/custom-fields/field-group/field-group.component.ts
interface FieldGroup {
  groupName: string;
  fields: CustomFieldDefinition[];
  order: number;
  groupId?: string;
  isRepeating?: boolean;
  visibilityCondition?: VisibilityCondition | null;
  // Stufe 1 adds (documentation-only): aggregationConfig?: AggregationConfig | null;
}
```

```ts
// Source: apps/tagea-frontend/src/app/models/custom-fields.model.ts
interface UiConfig {
  number_format?: NumberFormat; // currency formatting reused for the total display
  visibility_condition?: VisibilityCondition;
  // ...
}
```

## Events

None. Stufe 1 introduces no WebSocket/push events.

## Error codes

No new endpoints; existing group-config write endpoints keep their codes (401, 403, 404, 400 on invalid `aggregation_config`).

> **Flutter port note:** Stufe 1 is a backend + Angular feature; the Flutter client only needs to **render** the server-delivered aggregate (display-only) and respect the same JSONB key contract (`<group_key>__<source_field_key>__sum`). No client-side summing is required for parity.
