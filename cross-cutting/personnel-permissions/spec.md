# Cross-Cutting: Personnel Module Permissions

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

The Personnel module (`/personal/*`) introduces eight new `tenant.*` permissions across three domains — **time-accounts**, **shifts**, **time-tracking**. This spec is the single source of truth for the permission keys, their default role assignments, and the migration sequence. Sister to [tenant-role-permissions](../tenant-role-permissions/spec.md), which freezes the four-persona matrix.

## Why a dedicated cross-cutting spec

Without this:

- The three feature specs ([personnel-zeitkonten](../../features/personnel-zeitkonten/spec.md), [personnel-schichten](../../features/personnel-schichten/spec.md), [personnel-zeiterfassung](../../features/personnel-zeiterfassung/spec.md)) each name permissions in isolation; drift between them is invisible.
- The default-role table lives in tenant migrations, not in any spec — when a migration is forgotten, frontend gates silently fail open (or closed) and only catch in QA.
- The `traeger_manager` bypass-vs-resolver split documented in [tenant-role-permissions](../tenant-role-permissions/spec.md) explicitly requires every new tenant.*-permission to be wired into the role mapping. This spec is where that wiring is justified.

## Permission Matrix

All keys live under the `tenant.` namespace, following the convention from [feedback_permission_scope_pattern](../../../memory/feedback_permission_scope_pattern.md): `tenant.*` = einrichtungsübergreifend, used from `/personal` (and `/administration`).

| Permission                                  | Domain         | Purpose                                                                            | Default Roles                                                |
| ------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `tenant.time_accounts.view`                 | Zeitkonten     | HR-Tabelle aller Mitarbeitenden-Zeitkonten + per-employee 12-Monats-History lesen  | personalverwalter, traeger_manager                           |
| `tenant.time_accounts.adjust`               | Zeitkonten     | Manuelle Saldo-Anpassungen (mit Audit-Log + Begründung) schreiben                  | personalverwalter, traeger_manager                           |
| `tenant.shifts.view`                        | Schichten      | Schichtplan-Roster aller Mitarbeitenden lesen (Planer-Sicht)                       | personalverwalter, traeger_manager                           |
| `tenant.shifts.plan`                        | Schichten      | Roster-Assignments erstellen, editieren, stornieren, publishen                     | personalverwalter, traeger_manager                           |
| `tenant.shifts.view_own`                    | Schichten      | Eigene published Schichten unter `/personal/meine-schichten` lesen                 | **alle Tenant-Rollen** inkl. mitarbeiter                     |
| `tenant.time_tracking.view`                 | Zeiterfassung  | Tenant-weite Tabelle aller `tracked_time`-Einträge + Sub-Entries lesen             | personalverwalter, traeger_manager                           |
| `tenant.time_tracking.approve`              | Zeiterfassung  | Korrekturanfragen aus der Queue genehmigen oder ablehnen                           | personalverwalter, traeger_manager                           |
| `tenant.time_tracking.request_correction`   | Zeiterfassung  | Eigene Korrekturanfrage für `tracked_time`-Einträge der letzten 14 Tage anlegen    | **alle Tenant-Rollen** inkl. mitarbeiter                     |

## Persona-Sicht (effektive Capabilities)

Abgleich gegen die Persona-Matrix aus [tenant-role-permissions](../tenant-role-permissions/spec.md):

| Persona              | time_accounts.view | time_accounts.adjust | shifts.view | shifts.plan | shifts.view_own | time_tracking.view | time_tracking.approve | time_tracking.request_correction |
| -------------------- | ------------------ | -------------------- | ----------- | ----------- | --------------- | ------------------ | --------------------- | -------------------------------- |
| Trägeradmin          | ✅ (bypass)        | ✅ (bypass)          | ✅ (bypass) | ✅ (bypass) | ✅ (bypass)     | ✅ (bypass)        | ✅ (bypass)           | ✅ (bypass)                      |
| Träger-Manager       | ✅                 | ✅                   | ✅          | ✅          | ✅              | ✅                 | ✅                    | ✅                               |
| Personalverwalter    | ✅                 | ✅                   | ✅          | ✅          | ✅              | ✅                 | ✅                    | ✅                               |
| Mitarbeiter          | ❌                 | ❌                   | ❌          | ❌          | ✅              | ❌                 | ❌                    | ✅                               |

**Begründung der Defaults:**

- **HR-volle Rechte für `personalverwalter`** — die Rolle existiert genau für Trägerverwaltung. Wenn jemand mit `personalverwalter` nicht plant/genehmigt/anpasst, fehlt der Rolle der Sinn. Wer das nicht will, gibt der Person die `mitarbeiter`-Rolle und gewährt nichts extra.
- **`shifts.view_own` + `time_tracking.request_correction` als Default für alle** — Selbstauskunft und Korrekturwunsch sind keine Privilegien, sie sind Grundnutzung des Personalbereichs für jeden Angestellten. Wer sie nicht haben soll, ist vermutlich nicht im Tenant.
- **Träger-Manager bekommt alles** — per Konvention der Resolver-Pfad-Persona aus [tenant-role-permissions](../tenant-role-permissions/spec.md); ohne explizites Aufnehmen würde Träger-Manager hinter Trägeradmin zurückfallen, was die Spec-Garantie der Persona-Symmetrie bricht.
- **Mitarbeiter bleibt am Floor** — die Persona ist explizit dafür da, das Minimum zu beweisen. Sie bekommt nur das, was jeder Angestellte haben muss.

## Migration

Eine einzige Migration unter `apps/tagea-backend/src/database/tenant-migrations/`. Template: [`20260427110600-AddTenantAppointmentTemplatesPermissions.ts`](../../../apps/tagea-backend/src/database/tenant-migrations/20260427110600-AddTenantAppointmentTemplatesPermissions.ts).

**Schritte:**

1. `INSERT` der 8 Permissions in `permissions` mit `ON CONFLICT (name) DO NOTHING` (idempotent).
2. `INSERT` in `role_permissions` für `traeger_manager` (alle 8 Perms).
3. `INSERT` in `role_permissions` für `personalverwalter` (alle 8 Perms).
4. `INSERT` in `role_permissions` für `mitarbeiter` (nur `shifts.view_own` + `time_tracking.request_correction`).
5. `down()` löscht in umgekehrter Reihenfolge: erst `role_permissions`, dann `permissions`.

**Naming:** `YYYYMMDDhhmmss-AddPersonnelModulePermissions.ts`.

**Baseline-Update:** Nach der Migration `npm run baseline:generate` ausführen (siehe [project_skb_seed_anatomy](../../../memory/project_skb_mass_rollout.md) für den Pre-Commit-Hook). Der Hook blockiert sonst den Commit.

## TypeScript-Konstanten

In `packages/permissions/src/lib/permissions.ts` werden die 8 Permissions zum `EMPLOYEE_PERMISSIONS`-Objekt ergänzt:

> Documentation-only shape — planned, not yet in source.

```ts
TENANT_TIME_ACCOUNTS_VIEW: 'tenant.time_accounts.view',
TENANT_TIME_ACCOUNTS_ADJUST: 'tenant.time_accounts.adjust',
TENANT_SHIFTS_VIEW: 'tenant.shifts.view',
TENANT_SHIFTS_PLAN: 'tenant.shifts.plan',
TENANT_SHIFTS_VIEW_OWN: 'tenant.shifts.view_own',
TENANT_TIME_TRACKING_VIEW: 'tenant.time_tracking.view',
TENANT_TIME_TRACKING_APPROVE: 'tenant.time_tracking.approve',
TENANT_TIME_TRACKING_REQUEST_CORRECTION: 'tenant.time_tracking.request_correction',
```

## Backend-Check-Pattern

Per [feedback_permission_check_via_resolver](../../../memory/feedback_permission_check_via_resolver.md): Service-Checks **immer** über `PermissionResolverService.hasPermission(ctx, perm, scope)`. Inline-`tenant.role.permissions.has(...)` matcht nicht.

Controller-Pattern (analog `tenant.employees.*`-Routen):

> Documentation-only shape — planned, not yet in source.

```ts
@Controller('tenant/:tenantId/personnel/time-accounts')
@UseGuards(FeatureGuard)
@RequireFeature('pep')
export class PersonnelTimeAccountController {
  @Get('overview')
  @Auth({ scope: 'tenant', permissions: [EMPLOYEE_PERMISSIONS.TENANT_TIME_ACCOUNTS_VIEW] })
  async getOverview(...) { ... }

  @Post(':employeeId/adjustments')
  @Auth({ scope: 'tenant', permissions: [EMPLOYEE_PERMISSIONS.TENANT_TIME_ACCOUNTS_ADJUST] })
  async addAdjustment(...) { ... }
}
```

## Frontend-Check-Pattern

Routen + Menüpunkte gaten über `tenantPermission: true`-Flag:

> Documentation-only shape — planned, not yet in source.

```ts
{
  path: 'zeitkonten',
  canActivate: [permissionGuard],
  data: {
    requiredPermission: EMPLOYEE_PERMISSIONS.TENANT_TIME_ACCOUNTS_VIEW,
    tenantPermission: true,
  },
  loadComponent: () => import('./pages/personnel-zeitkonten.component').then(m => m.PersonnelZeitkontenComponent),
}
```

Personnel-Menü-Items in `personnel-menu.config.ts` analog. KPIs in `personnel-dashboard-kpis.config.ts` ebenfalls auf die spezifischen Perms umstellen (heute teilen sich alle KPIs `TENANT_EMPLOYEES_LIST` als Phase-1-Surface — dieser Spec lifted das auf die jeweils echten Perms).

## Drift-Verhinderung

- **E2E:** Persona-Suite in `apps/tagea-frontend-e2e/src/personnel/permissions.spec.ts` läuft alle vier Personas durch `/personal/*` und prüft die Capability-Matrix dieser Spec. Bricht, sobald Default-Role und Spec auseinanderfallen.
- **Verify-Script:** `node specs/_scripts/verify-contracts.js personnel-zeitkonten personnel-schichten personnel-zeiterfassung` muss grün sein bevor diese Spec auf `✅ Specified` springt.
- **Migration-Baseline:** Pre-Commit-Hook (`tools/tenant-baseline/check-currentness.ts`) blockiert Migration-Commits ohne `baseline:generate`-Lauf.

## Non-Goals

- **Eigene `personnel.*`-Namespace-Permissions** — wir bleiben bei `tenant.*` weil das die etablierte Konvention für einrichtungsübergreifende Rechte ist. Ein neuer Namespace würde die Persona-Matrix doppeln, nicht ersetzen.
- **Per-Einrichtungs-Scoping innerhalb des Personalbereichs** — V1 ist tenant-wide. Wenn später eine Einrichtungs-HR-Rolle gebraucht wird, kommen `institution.time_accounts.*`-Permissions parallel dazu (analog `tenant.employees.*` ⊥ `institution.employees.*` heute).
- **Self-Service-Anpassung der eigenen Zeitkonten** — bewusst kein Default für Mitarbeitende. Wenn ein Mitarbeiter ein Problem mit seinem Saldo hat, läuft das über die Korrekturanfrage-Schleife der Zeiterfassung, nicht durch direktes Anpassen.

## References

- [tenant-role-permissions](../tenant-role-permissions/spec.md) — Persona-Matrix-Spec (Trägeradmin, Träger-Manager, Personalverwalter, Mitarbeiter)
- [personnel-zeitkonten](../../features/personnel-zeitkonten/spec.md), [personnel-schichten](../../features/personnel-schichten/spec.md), [personnel-zeiterfassung](../../features/personnel-zeiterfassung/spec.md) — Feature-Specs, die diese Permissions nutzen
- [feedback_permission_scope_pattern](../../../memory/feedback_permission_scope_pattern.md) — `tenant.*` vs `institution.*`-Konvention
- [feedback_permission_check_via_resolver](../../../memory/feedback_permission_check_via_resolver.md) — Service-Check-Regel
- Template-Migration: `apps/tagea-backend/src/database/tenant-migrations/20260427110600-AddTenantAppointmentTemplatesPermissions.ts`
- Roles-Tabelle + UUIDs: `apps/tagea-frontend-e2e/src/fixtures/personas.ts` (Quelle der ROLE_IDS-Konstanten)
