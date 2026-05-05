# Contracts: Case Prompt After Quick-Client

> No new endpoints, no new DTOs. This feature reuses two existing endpoints in sequence and orchestrates a UI flow on top.

## Endpoints

### `POST /institutions/{institutionId}/clients` — existing

The QuickCreateClient panel posts here to create the client. Already covered by the existing client-CRUD spec; reproduced here only for the call sequence.

**Request body:** `CreateClientDto`

```ts
// Source: apps/tagea-frontend/src/app/models/client.model.ts
interface CreateClientDto {
  first_name: string;
  last_name: string;
  category: 'client' | 'related_person' | 'contact';
  email?: string;
  phone?: string;
}
```

**Response (201):** `Client` entity (relevant fields below)

```ts
interface Client {
  id: string;
  first_name: string;
  last_name: string;
  category: 'client' | 'related_person' | 'contact';
  // ... other fields not consumed by this feature
}
```

**Error codes:** 400 (validation), 401, 403 (no `tenant.clients.create`), 409 (duplicate detection — out of scope here).

---

### `POST /institutions/{institutionId}/cases` — existing

The QuickCreateCase panel posts here when the user confirms the prompt. Already covered by the cases spec; reproduced here only for the call sequence.

**Request body:** `CreateCaseDto`

```ts
// Source: apps/tagea-frontend/src/app/models/case.model.ts
interface CreateCaseDto {
  client_id: string;             // populated from the freshly created Client.id
  case_template_id?: string;     // user picks in QuickCreateCase, optional
  department_id?: string | null; // not exposed in QuickCreateCase — sent as null
  assigned_employee_ids: string[]; // defaulted to [currentUser.id], user can edit
  registration_date: string;     // sent as today's date in ISO format
  start_date: string;            // defaulted to appointment start date in ISO format
  end_date?: string | null;      // not exposed in QuickCreateCase
  general_info?: string;         // not exposed in QuickCreateCase
  status?: CaseStatus;           // not sent — backend defaults to 'active'
}
```

**Response (201):** `Case` entity. Only `id` and `case_number` (for the snackbar) are consumed by the feature.

**Error codes:** 400 (validation — e.g. missing `assigned_employee_ids`), 401, 403 (no `tenant.cases.create`), 409 (case-number collision).

## Frontend orchestration shape

> Documentation-only shape. The new `QuickCreateCaseComponent` opens via Angular `MatDialog` and emits the saved case (or `undefined` on cancel) via `dialogRef.afterClosed()` — analogous to `QuickCreateClientComponent`.

```ts
// New component — apps/tagea-frontend/src/app/components/quick-create-case/quick-create-case.component.ts
interface QuickCreateCaseDialogData {
  clientId: string;
  clientDisplayName: string;
  defaultStartDate: string;       // ISO — appointment start_date
  defaultAssignedEmployeeIds: string[]; // [currentUser.id]
}

// afterClosed() emits:
type QuickCreateCaseResult =
  | { case: Case }   // user saved successfully
  | undefined;       // user cancelled or closed
```

The wiring in `appointment-dialog-v2.component.ts` (existing component, modified):

> Documentation-only shape. The methods below (`shouldPromptForCase`, `askCreateCaseConfirm`, `openQuickCreateCase`, `attachCaseToParticipant`) will be added during implementation; named here so the spec describes the intended call shape.

```ts
// documentation-only
// inside openQuickCreateClient() — after the existing afterClosed
dialogRef.afterClosed().subscribe(async (newClient) => {
  if (!newClient) return;
  // existing — add to participants
  this.selectedClients.update(...);
  this.syncFirstClientToForm();

  // NEW — case prompt guard + flow
  if (this.shouldPromptForCase(newClient)) {
    const wantsCase = await this.askCreateCaseConfirm(newClient);
    if (wantsCase) {
      const created = await this.openQuickCreateCase(newClient);
      if (created) {
        this.attachCaseToParticipant(newClient.id, created.case);
      }
    }
  }
});
```

`shouldPromptForCase` checks: `caseFeatureEnabled && hasPermission('tenant.cases.create') && newClient.category === 'client'`.

## Events (WebSocket / Push)

None new. Existing case-creation events (if any are configured per tenant) fire as they would for any case.

## Data Models

No new persistent data shapes. Both client and case rows follow the existing schemas.

> **Flutter port note:** Flutter does not need a port until the Flutter QuickCreateClient flow is implemented. The case-prompt is a follow-up that mirrors whatever the Flutter dialog architecture chooses; the backend contract (two sequential POSTs) is platform-agnostic.
