# Feature: Institution Features (Funktionen Tab)

> **Status:** ✅ Implemented
> **Owner:** ltoenjes
> **Last updated:** 2026-05-08

## Vision (Elevator Pitch)

Tenant administrators can enable or disable individual product features per institution from the "Funktionen" tab in the institution detail view. The DB is the single source of truth: a checkbox is checked **iff** the corresponding key is stored as `{ enabled: true }` in `institutions.features`.

## User Stories

- As a **tenant admin** I want to toggle features (Sachmittel, Fälle, Chat, …) per institution, so that each institution only exposes the features it has booked.
- As a **tenant admin** I want the form to reflect what is actually persisted, so that I can trust "unchecked = off" without surprises.
- As a **tenant admin** I want features that are disabled at the tenant level to appear locked in the institution UI, so that I cannot enable something the tenant has not booked.

## Acceptance Criteria

- [ ] **Given** an institution whose `features` column is `NULL` or `{}`, **When** the Funktionen tab loads, **Then** every checkbox renders **unchecked** (DB state is empty → UI is empty).
- [ ] **Given** an institution with `features = { chat: { enabled: true } }`, **When** the Funktionen tab loads, **Then** only the "Chat" checkbox is checked; all others are unchecked.
- [ ] **Given** a feature whose tenant-level entry is `{ enabled: false }`, **When** the Funktionen tab loads, **Then** that row is rendered as **locked** (disabled checkbox, lock icon, hint text), regardless of the institution-level value.
- [ ] **Given** the user toggles one or more checkboxes, **When** they press "Speichern", **Then** only changed (dirty, non-disabled) controls are sent in the `PATCH` payload.
- [ ] **Given** a successful save, **When** the response returns, **Then** the form re-fetches and rebuilds against the freshly persisted state and is marked pristine.
- [ ] **Given** a runtime feature gate (e.g. `isFeatureEnabled('chat')`) for an institution with no entry for `chat`, **When** evaluated, **Then** the result is `false` (consistent with the unchecked checkbox).

## UI States

| State             | When?                                                  | What does the user see?                                                                 | A11y notes                                                  |
| ----------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Initial / Loading | Tab mounted, `getFeatures()` in flight                 | Centered spinner                                                                        | Spinner has implicit "loading" semantics                    |
| Empty             | API returns `[]` (no feature catalog at all)           | Localized hint `administration.einrichtungenDetail.funktionen.notFound`                 | Plain `<p>` text                                            |
| Populated         | API returns ≥1 `FeatureWithLockStatus`                 | Fieldset with one checkbox row per feature, save bar appears once form is dirty         | Each row: checkbox + name + description; locked rows show a `lock` icon plus hint |
| Saving            | User pressed "Speichern", `PATCH` in flight            | Save button shows inline spinner, both buttons disabled                                 | Button stays focusable; live region announces success/error via snackbar |
| Save error        | `PATCH` rejects                                        | Snackbar with `…funktionen.saveError`, form stays dirty so the user can retry           | Error visible for 5s                                        |
| Locked feature    | `tenantEnabled === false` for a key                    | Row is dimmed (`opacity: 0.6`), checkbox is `disabled`, lock icon + hint shown          | Checkbox is keyboard-skipped because `disabled`             |

## Flows

```mermaid
sequenceDiagram
  participant U as Tenant admin
  participant FE as FunktionenTabComponent
  participant API as tenant-institutions controller
  participant SVC as InstitutionFeaturesService
  participant DB as institutions.features (JSONB)

  U->>FE: navigate to /administration/einrichtungen/:id/funktionen
  FE->>API: GET /api/tenant-institutions/:id/features
  API->>SVC: getFeaturesWithLockStatus(id)
  SVC->>DB: read institutions.features
  SVC-->>API: FeatureWithLockStatus[] (institutionEnabled mirrors DB exactly)
  API-->>FE: 200 OK
  FE->>FE: build FormRecord<FormControl<boolean>> (one per key)
  U->>FE: toggles checkboxes, presses "Speichern"
  FE->>API: PATCH /api/tenant-institutions/:id/features (only dirty keys)
  API->>SVC: updateInstitutionFeatures(id, dto)
  SVC->>DB: merge & save institutions.features
  SVC-->>API: Institution
  API-->>FE: 200 OK
  FE->>API: GET /api/tenant-institutions/:id/features (refetch)
  FE->>U: snackbar "Gespeichert", form pristine
```

## Non-Goals

- Tenant-level feature management (handled by tenant admin elsewhere).
- Per-user feature toggling.
- Bulk operations across multiple institutions.
- Migrating existing institutions whose `features` column is empty — see "Edge Cases".

## Edge Cases

- **`features` is `NULL` or `{}`**: every feature renders unchecked. Runtime gates also return `false`. This is intentional and was the fix for a regression where empty DB state showed every checkbox as checked.
- **Feature key absent from a non-empty `features` object**: same as above — the missing key is treated as `enabled: false`.
- **Tenant disables a feature after an institution had it enabled**: the row becomes locked; `effectiveEnabled` is `false` regardless of the persisted institution value. The persisted institution value is preserved (not overwritten) so re-enabling at tenant level restores the original institution state.
- **`clientSelfRegistration`**: tenant-side master switch is `clientRegistration` (not `clientSelfRegistration`). Lock status is derived from `clientRegistration.enabled`.
- **`institutions` feature ↔ legacy `allow_counseling_mode`**: when `features.institutions` is updated, the legacy `allow_counseling_mode` boolean is mirrored for backward compatibility.

## Permissions & Tenant/Institution

- **Required permission:**
  - View: `TENANT_INSTITUTIONS_VIEW`
  - Edit: `TENANT_INSTITUTIONS_EDIT`
- **Auth scope:** `tenant` (route guarded by `@Auth({ scope: 'tenant', ... })`).
- **Feature guard:** controller is gated by `@RequireFeature('institutions')` — the institution-management module itself must be enabled at tenant level.
- **Institution context:** URL param `:institutionId` (resolved from `route.parent`).

## Notifications (Push / In-App)

Not applicable — this is an admin-only configuration screen.

## i18n Keys

- `administration.einrichtungenDetail.funktionen.title`
- `administration.einrichtungenDetail.funktionen.subtitle`
- `administration.einrichtungenDetail.funktionen.tenantNotBookedHint`
- `administration.einrichtungenDetail.funktionen.notFound`
- `administration.einrichtungenDetail.funktionen.saved`
- `administration.einrichtungenDetail.funktionen.saveError`
- `teamspaceAdmin.institutionDialog.featureDescriptions.<featureKey>` (one per feature)
- `common.save`, `common.cancel`, `common.close`

Display names for the feature catalog itself live in the backend (`FEATURE_DISPLAY_NAMES` in `institution-features.service.ts`) and may be overridden per tenant via `tenantFeatures[key].displayName`.

## Offline Behavior

Flutter port not planned (admin tooling is Angular-only). N/A.

## References

- **Angular component:** [`apps/tagea-frontend/src/app/pages/administration/organisation/funktionen-tab.component.ts`](../../../apps/tagea-frontend/src/app/pages/administration/organisation/funktionen-tab.component.ts)
- **Frontend HTTP service:** [`apps/tagea-frontend/src/app/admin/services/institutions-http.service.ts`](../../../apps/tagea-frontend/src/app/admin/services/institutions-http.service.ts) (`getFeatures`, `updateFeatures`)
- **Backend controller:** [`apps/tagea-backend/src/institutions/tenant-institutions.controller.ts`](../../../apps/tagea-backend/src/institutions/tenant-institutions.controller.ts) (`GET/PATCH /:id/features`)
- **Backend service:** [`apps/tagea-backend/src/institutions/institution-features.service.ts`](../../../apps/tagea-backend/src/institutions/institution-features.service.ts)
- **Unit tests:** [`apps/tagea-backend/src/institutions/institution-features.service.spec.ts`](../../../apps/tagea-backend/src/institutions/institution-features.service.spec.ts)
- **Backend endpoints:** see [contracts.md](./contracts.md)
