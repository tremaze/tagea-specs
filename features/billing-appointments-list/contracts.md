# Contracts: Billing Appointments List

## Endpoints

### `GET /api/:tenant/institutions/:institutionId/billing/appointments`

**Query parameters:**

| Param | Type | Required | Default |
|---|---|---|---|
| `mode` | `'billable' \| 'to_review'` | yes | — |
| `start_date` | ISO datetime | no | — |
| `end_date` | ISO datetime | no | — |
| `page` | int | no | 1 |
| `limit` | int | no | 25 |

**Mode semantics:**

- `mode=billable` → `status='completed'` AND has `appointment_approval_links` AND not all links invoiced
- `mode=to_review` → `status='completed'` AND client+case participant AND no approval links AND `booking_category_id IS NULL` AND `billing_decision IS NULL`

**Response:**

```ts
interface BillingAppointmentsResponse {
  items: BillingAppointmentRow[];
  total: number;
  page: number;
  limit: number;
}

interface BillingAppointmentRow {
  id: string;
  start_datetime: string;          // ISO
  duration_minutes: number;
  status: 'completed';             // always — list is filtered
  title: string;
  participants: Array<{
    id: string;
    participant_type: 'client' | 'staff' | 'external';
    client?: { id: string; first_name: string; last_name: string };
    case?: { id: string; case_number: string };
  }>;
  appointmentApprovalLinks: Array<{
    id: string;
    is_invoiced: boolean;
    quantity_used: number;
    billing_unit_snapshot: string;
    price_per_unit_snapshot: number;
    approval?: {
      id: string;
      cost_carrier_id: string | null;
      costCarrier?: { id: string; name: string };
      service?: {
        id: string;
        serviceCode: string;
        name: string;
        versions?: Array<{
          id: string;
          costCarrierId?: string;
          costCarrier?: { id: string; name: string };
        }>;
      };
    };
  }>;
  billing_decision: 'skipped' | null;
}
```

**Error codes:** 400 (bad mode), 401, 403 (missing CASES_EDIT or feature flag off), 404

### `POST /api/:tenant/institutions/:institutionId/billing/appointments/:appointmentId/skip`

Marks the appointment as "not to be billed" (`billing_decision='skipped'`).

**Request body:** none

**Response:** `{ id: string; billing_decision: 'skipped' }`

**Error codes:** 400 (already skipped, or appointment has approval links — skip is only valid for to_review), 401, 403, 404

### `POST /api/:tenant/institutions/:institutionId/billing/appointments/:appointmentId/unskip`

Resets `billing_decision` to `NULL`.

**Request body:** none

**Response:** `{ id: string; billing_decision: null }`

**Error codes:** 400 (was not skipped), 401, 403, 404

## Removed Endpoints

- ❌ `GET /api/:tenant/institutions/:institutionId/appointments/billing` — replaced by the new endpoint above. Frontend `AppointmentsService.getBillingAppointments` is removed in the same PR.

## Data Model Changes

### `appointments` table

New nullable column:

```sql
ALTER TABLE appointments
  ADD COLUMN billing_decision VARCHAR(20) NULL,
  ADD CONSTRAINT chk_appointments_billing_decision
    CHECK (billing_decision IS NULL OR billing_decision IN ('skipped'));
```

**Why nullable + open-enum:** Adding values like `'flagged'` or `'manual_invoice'` later won't need a column type change, only a check-constraint update. `NULL` is the implicit "not yet decided / resolved by approval link" state — no value churn for existing rows.

## Auto-Reset Hook

When `AppointmentApprovalLinksService.create` inserts a link for an appointment with `billing_decision='skipped'`, the flag is reset to `NULL` in the same transaction. This prevents the contradictory state "appointment is skipped but also has approval links".
