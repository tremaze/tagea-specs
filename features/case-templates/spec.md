# Feature: Case Templates (Fallvorlagen)

> **Status:** 🚧 Spec drafted — awaiting implementation
> **Owner:** baumgart
> **Last updated:** 2026-05-02

## Vision (Elevator Pitch)

Case templates (Fallvorlagen) are **shared configuration** that drives case creation: case-number ranges, allowed appointment templates, custom-field groups, default service-record definitions. Two scopes manage them:

- **Tenant-Admin** (Träger-Manager) defines templates centrally and assigns them to multiple institutions at once
- **Institution-Admin** (Einrichtungs-Admin) manages templates that apply to her institution — but can only fully edit/delete templates that **belong exclusively to her institution**; shared templates can only be **decoupled** ("aus Einrichtung entfernen") so other institutions are not affected

This separation prevents accidental cross-institution mutations: an Inst-Admin tweaking a shared template would otherwise change behavior for every institution that template is assigned to.

## User Stories

- As a **Tenant-Admin** I want to create a case template and assign it to several institutions at once, so that all chosen institutions use the same case-creation defaults.
- As a **Tenant-Admin** I want to edit and delete templates I own, so that I can curate the central catalog.
- As an **Institution-Admin** I want to create a template just for my institution, so that my staff has a tailored case-creation flow.
- As an **Institution-Admin** I want to edit/delete the templates that exist only in my institution, so that I can manage my own catalog.
- As an **Institution-Admin** I want to **decouple** a shared template from my institution, so that my staff stops seeing it without removing it from other institutions.
- As a **Counselor** (Berater) I want to pick from active templates when creating a case, so that case creation is fast — but I must **not** be able to create or edit templates myself.

## Acceptance Criteria

### Institution-Admin owner model

- [ ] **Given** Inst-Admin opens `/einstellungen/einrichtung/:id/fallverwaltung`, **When** the template list loads, **Then** each card shows an owner indicator: "Nur dieser Einrichtung zugewiesen" (junction-count=1) or "Auch in N anderen Einrichtungen" (junction-count>1).
- [ ] **Given** a template that exists only in this institution, **When** Inst-Admin clicks Edit, **Then** the form opens and `PATCH` succeeds (200).
- [ ] **Given** a shared template, **When** Inst-Admin clicks Edit, **Then** the Edit button is disabled in the UI **and** the backend returns 403 if a direct API call is attempted (defense-in-depth).
- [ ] **Given** a template that exists only in this institution, **When** Inst-Admin confirms Delete, **Then** the template row is hard-deleted (junction CASCADE).
- [ ] **Given** a shared template, **When** Inst-Admin opens the row's menu, **Then** the destructive action label changes to "Aus Einrichtung entfernen" — confirming triggers `DELETE /institutions/:id/case-templates/:id/decouple`, which removes the junction row only; the template stays alive for the other institutions.
- [ ] **Given** Inst-Admin creates a new template, **When** the request succeeds, **Then** the backend auto-creates the junction row for the current institution; only this institution sees it initially.

### Tenant-Admin multi-institution assignment

- [ ] **Given** Tenant-Admin opens `/administration/planung/fallvorlagen`, **When** the list loads, **Then** all templates across the tenant are shown, with a chip per template summarizing its institution-assignments ("3 Einrichtungen" etc.).
- [ ] **Given** Tenant-Admin clicks "Neue Vorlage", **When** the form opens, **Then** a multi-select for institution-assignment is present (defaulting to no institutions); the form requires ≥1 institution at submit.
- [ ] **Given** Tenant-Admin saves a new template with N selected institutions, **When** the POST succeeds, **Then** the backend creates the template + N junction rows in one transaction.
- [ ] **Given** Tenant-Admin edits a template, **When** the institution multi-select is changed, **Then** PATCH applies the diff (add/remove junction rows) — institutions removed from the assignment lose the template immediately on next list load.

### Counselor (Berater) tripwire

- [ ] **Given** Berater is logged in, **When** Berater attempts `POST /institutions/:id/case-templates`, **Then** the backend returns **403** (Berater has `CASE_TEMPLATES_LIST` only — no `CASE_TEMPLATES_CREATE`).
- [ ] **Given** Berater opens the case-create dialog, **When** the template picker loads, **Then** all institution-active templates are visible (Berater retains `CASE_TEMPLATES_LIST` for picker use).

### Permission scoping

- [ ] **Given** Inst-Admin has `institution.case_templates.edit`, **When** Resolver checks the permission for institution X, **Then** Inst-Admin's institution-role-permission OR a non-denied tenant-role-permission grants access (Resolver merges scopes).
- [ ] **Given** the user is `is_tenant_admin=true`, **When** any case-template permission is checked, **Then** Resolver returns true regardless of scope.

## UI States

### Institution-Admin (Fallverwaltung tab "Fallvorlagen")

| State | When? | What does the user see? |
|---|---|---|
| Loading | Initial fetch | Spinner |
| Empty | No templates assigned to this institution | Empty state + "Erste Vorlage anlegen" CTA |
| Populated | Templates exist | Cards with name/icon/color + owner indicator + Edit/Delete-or-Decouple actions |
| Edit-blocked | Card represents a shared template | Edit button disabled with tooltip "Diese Vorlage gehört auch anderen Einrichtungen — Bearbeitung erfolgt zentral durch den Träger" |

### Tenant-Admin (Administration → Planung → Fallvorlagen)

| State | When? | What does the user see? |
|---|---|---|
| Loading | Initial fetch | Spinner |
| Empty | No templates in tenant | Empty state + "Erste Vorlage anlegen" CTA |
| Populated | Templates exist | List with name + icon/color + institution-assignment-count chip + Edit/Delete |
| Form | Create / Edit | Standard fields + institution multi-select (≥1 required) |

## Non-Goals

- **Soft-delete history of templates** — templates are hard-deleted (junction CASCADE handles cleanup). Cases that reference a deleted template keep their `case_template_id` pointer but the lookup returns null; UI falls back to default icon/color.
- **Per-institution overrides of a shared template** — if you need a tweaked variant, copy the template instead. We do not maintain per-institution template-field overrides.
- **Counselor template-management** — Counselors are picker-only consumers, not editors.

## Edge Cases

- **Last-institution decouple:** if Inst-Admin tries to decouple a template that has only her institution assigned (count=1), backend returns 400 with hint "Letzte Zuweisung — bitte stattdessen löschen". Avoids creating orphan templates.
- **Tenant-Admin removes all institution-assignments via Edit:** rejected with 400 (≥1 institution required). Same orphan prevention.
- **Migration of existing NULL-institution templates:** Aggressive backfill — every existing `case_templates.institution_id IS NULL` row is fanned out into junction rows for **every active institution of the tenant**. Result: no NULL ambiguity post-migration.
- **Empty `is_active` toggle on shared template:** Same restriction as Edit — toggling active/archive on a shared template requires `tenant.case_templates.edit` (i.e., happens via Tenant-Admin only).

## Permissions & Tenant/Institution

- **Institution scope** (`@Auth({ scope: 'institution', permissions: [...] })` on `INSTITUTION_ROUTE_PREFIX/case-templates`):
  - LIST/active → `institution.case_templates.list`
  - VIEW/detail → `institution.case_templates.view`
  - CREATE → `institution.case_templates.create`
  - EDIT/archive/toggle-active → `institution.case_templates.edit`
  - DELETE/decouple → `institution.case_templates.delete`
- **Tenant scope** (`@Auth({ scope: 'tenant', permissions: [...] })` on `/admin/case-templates`):
  - VIEW → `tenant.case_templates.view`
  - CREATE → `tenant.case_templates.create`
  - EDIT → `tenant.case_templates.edit`
  - DELETE → `tenant.case_templates.delete`
- **Default role assignments** (mirrors the existing appointment-templates pattern for consistency):
  - `COUNSELOR` → `institution.case_templates.list` only (picker)
  - `SUPERVISOR` → `institution.case_templates.list` only (picker — supervisor doesn't admin templates)
  - `MANAGER` → full `institution.case_templates.{list,view,create,edit,delete}`
  - `ADMIN` → full `institution.case_templates.{list,view,create,edit,delete}`
  - `traegeradmin` (is_tenant_admin) → bypass via Resolver, sees everything
  - `traeger-manager` (Tenant-Role) → all `tenant.case_templates.*` (tenant-scope full)

## Notifications (Push / In-App)

- Not a notification target. Template state is read on-demand.

## i18n Keys

> User-facing strings remain in German.

## Offline Behavior

**Flutter port:** P3 / Documentation only. The mobile client is a picker consumer only; template-management UIs are web-only.

## References

- **Angular implementation:**
  - Inst-Admin: [`apps/tagea-frontend/src/app/pages/case-management-admin/case-management-admin.component.ts`](../../../apps/tagea-frontend/src/app/pages/case-management-admin/case-management-admin.component.ts)
  - Tenant-Admin: `apps/tagea-frontend/src/app/pages/admin-case-templates/` (to be created — analogous to `admin-appointment-templates/`)
- **Backend:** see [contracts.md](./contracts.md)
- **E2E tests:** `apps/tagea-frontend-e2e/src/tests/cases/templates-*.spec.ts`
