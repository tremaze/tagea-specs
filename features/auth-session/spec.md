# Auth Session Refactor — Spec

> Status: **Draft** (2026-05-10)
> Branch: `claude/refactor-auth-hydration-AtRNs`

---

## 1. Ziel & Scope

Aktuell ist die Auth-Hydration auf 18 Stellen verteilt (siehe `docs/auth-flow-analysis.md` im Hauptrepo). Routing-Entscheidungen werden mehrfach gerechnet, Permissions liegen in drei Spiegeln, Mode wird per `localStorage` ohne Permission-Validierung geraten.

Der Refactor ersetzt das durch:

- **ein** Backend-Endpoint `GET /session` mit einem konsolidierten DTO
- **eine** Frontend-Quelle `SessionStore` (signal-state)
- **einen** Routing-Resolver `SessionRouter`, der `landing` aus dem Backend übernimmt
- **einen** Permission-Lookup `SessionAuthz`

### Scope dieses ersten PR (M1)

In Scope:

- Backend `GET /session` liefert vollständigen Session-Snapshot inkl. **per-Institution Permissions** mit jeweils der dort zugewiesenen Rolle
- Frontend `SessionBootstrap` lädt den Snapshot, navigiert zu `landing`
- Drei Landing-Pfade funktionieren sauber:
  - **Teamspace-only Mitarbeiter** → `/teamspace`
  - **Einrichtung-only Mitarbeiter** (eine oder mehrere Institutions, kein Teamspace-Feature aktiv ODER keine Teamspace-Mitgliedschaften) → `/einrichtung/:id/dashboard`
  - **Klientenportal-User** → `/client-portal`
- Strukturierte, persona-getaggte Logs auf FE und BE, korreliert via `bootId`

**Nicht** in Scope dieses PRs (kommt in M2+):

- Tenant-Switch / Institution-Switch über `/session` (alter Flow bleibt vorerst)
- Mode-Toggle, Mode-Preferences
- Löschung von `UnifiedAuthService`, `AuthorizationStore`, `UserPermissionsService` etc.
- Full Permission-Guard-Migration
- Multi-Institution-User mit aktiver Mode-Wahl (das ist Persona-Variante 4, kommt M2)

---

## 2. Architektur (M1-Stand)

```
                  ┌────────────────────────────────────────┐
                  │                BROWSER                 │
                  │                                        │
                  │  ┌─────────────────────────────────┐   │
                  │  │  APP_INITIALIZER                │   │
                  │  │   1. TenantResolution (bestand) │   │
                  │  │   2. OIDC ensureAuthenticated   │   │
                  │  │   3. SessionBootstrap.hydrate() │◄──┼─── X-Boot-Id, X-Preferred-Mode
                  │  │      ↓                          │   │
                  │  │   GET /session  ────────────────┼───┼──→ Backend
                  │  │      ↓                          │   │     │
                  │  │   SessionStore.set(snapshot)    │   │     │
                  │  │   SessionRouter.navigateLanding │   │     │
                  │  └──────────────┬──────────────────┘   │     │
                  │                 │                       │     │
                  │  Components ────┴──→ SessionAuthz       │     │
                  │                       SessionStore      │     │
                  └────────────────────────────────────────┘     │
                                                                 │
                  ┌──────────────────────────────────────────────┘
                  │
                  ▼
                  ┌────────────────────────────────────────┐
                  │                BACKEND                 │
                  │                                        │
                  │  SessionController.getSession()        │
                  │       │                                │
                  │       ├──► PrincipalLoader (bestand)   │
                  │       ├──► AuthorizationContextBuilder │
                  │       │    (bestand, leicht angepasst) │
                  │       ├──► TenantFeaturesService       │
                  │       ├──► PersonaClassifier   ◄── shared package @tagea/session
                  │       └──► LandingResolver     ◄── neu, im Backend
                  │              │                         │
                  │              ▼                         │
                  │         Session DTO     ◄── shared @tagea/session
                  └────────────────────────────────────────┘
```

---

## 3. Das Session-DTO (geteilt FE/BE via `@tagea/session`)

```ts
export type PrincipalType = 'employee' | 'client';
export type LandingMode =
  | 'teamspace'
  | 'einrichtung'
  | 'client_portal'
  | 'admin_picker' // Tenant-Admin ohne Inst-Zuweisung; Frontend zeigt Inst-Liste
  | 'blocked'; // Keine valide Landing — siehe blockedReason

export type LandingScope = { kind: 'teamspace' } | { kind: 'institution'; id: string } | { kind: 'client_portal' } | { kind: 'none' };

export type Landing = {
  mode: LandingMode;
  scope: LandingScope;
  rationale: string[]; // Backend-Begründung, im Log mit ausgegeben
  blockedReason?: 'no_tenant' | 'no_assignments' | 'pending_approval' | 'email_not_verified' | 'admin_needs_explicit_scope';
};

export type InstitutionMembership = {
  institutionId: string;
  name: string;
  role: { id: string; name: string };
  counselingEnabled: boolean;
  lastUsedAt: string | null;
  permissions: string[]; // EFFEKTIV: tenant-role + inst-role + overrides bereits gemerged
};

export type TeamspaceMembership = {
  teamspaceId: string;
  name: string;
  role: { id: string; name: string };
  scopedInstitutionIds: string[];
  permissions: string[];
};

export type SessionTenantTheme = {
  primaryColor: string;
  primaryColorDark: string;
  lightBackgroundColor: string;
};

export type SessionEmployeePreferences = Record<string, unknown>;

export type Session = {
  bootId: string; // Echo des Frontend-Boot-Headers
  identity: {
    authUserId: string;
    principalId: string;
    type: PrincipalType;
    email: string;
    firstName: string;
    lastName: string;
    status: 'active' | 'pending_approval' | 'suspended' | 'deleted';
  };
  tenant: {
    id: string;
    name: string;
    available: { id: string; name: string }[];
    pushBrandId: string | null; // Push-Notification-Brand, null wenn nicht konfiguriert
    theme: SessionTenantTheme; // Brand-Theme, Backend füllt Defaults wenn settings.theme leer
  };
  elevation: {
    isSuperAdmin: boolean;
    isTenantAdmin: boolean;
    isSchulungAdmin: boolean; // Schulungs-Verwalter (LMS)
  };
  features: TenantFeatures; // bestehender Typ
  permissions: {
    tenant: string[]; // Tenant-Rolle, flach
    institutions: Record<string, InstitutionMembership>; // <-- der wichtige Punkt
    teamspaces: Record<string, TeamspaceMembership>;
    client: string[] | null; // null für Mitarbeiter
  };
  landing: Landing;
  personaLabel: PersonaLabel; // siehe persona-classifier.draft.ts
  /**
   * Employee-Preferences (jsonb auf Employee.preferences) für Mitarbeiter,
   * `null` für Clients. Frontend nutzt das Feld in PostHydration als
   * Seed für `EmployeeSelfService.personalPreferences{$,()}` —
   * spart einen `GET /employees/me/preferences` pro Cold-Boot.
   */
  preferences: SessionEmployeePreferences | null;
};
```

### Multi-Institution-Garantie (Kerntestfall)

Wenn ein Mitarbeiter:

- Tenant-Rolle „Standard-Mitarbeiter" (Permissions A, B, C)
- in Institution X die Rolle „Berater" (Permissions C, D, E)
- in Institution Y die Rolle „Einrichtungsleitung" (Permissions C, D, E, F, G)

dann muss `session.permissions.institutions` zwei Einträge haben:

```jsonc
{
  "X": { "role": { "name": "Berater" }, "permissions": ["A", "B", "C", "D", "E"] },
  "Y": { "role": { "name": "Einrichtungsleitung" }, "permissions": ["A", "B", "C", "D", "E", "F", "G"] },
}
```

Heute liefert `/auth/context` das auch schon (siehe `authorization-context-builder.service.ts:62-66`), aber unter etwas anderem Shape. Die neue Implementierung wiederverwendet den bestehenden `AuthorizationContextBuilderService` als Datenquelle und projiziert nur das Ergebnis in das `Session`-DTO.

### Snapshot-als-Cache: `preferences`, `tenant.theme`, `tenant.pushBrandId`

Drei Felder leben auf dem Snapshot rein als Cold-Boot-Optimierung — sie ersetzen separate `GET`-Calls, die das Frontend früher direkt nach `/auth/context` machte:

| Feld                      | Vorher                                                   | Heute                                                                                                    |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `tenant.pushBrandId`      | `GET /tenants/current/push-brand`                        | direkt vom Snapshot, `PostSessionHydrationService` ruft `pushNotifications.init(token, brandId)`         |
| `tenant.theme`            | `GET /tenants/current/theme` (ehemals dead code)         | direkt vom Snapshot, `PostSessionHydrationService` ruft `themeService.applyTheme(theme)`                 |
| `preferences` (employees) | `GET /employees/me/preferences` (lazy on first consumer) | direkt vom Snapshot, `PostSessionHydrationService` primt `EmployeeSelfService.personalPreferences{$,()}` |

**Update-Pfad bleibt unverändert** — `PUT /employees/me/preferences` und die SuperAdmin-Theme-Endpoints sind weiterhin die Schreib-Operationen. Der Snapshot ist ein Read-Cache, der bei jedem `/session`-Resolve (Cold-Boot ODER Tenant-Switch) frisch befüllt wird. Damit ist `runPostHydration` der explizite Lifecycle-Hook für „nach Snapshot, vor Shell-Render".

**Vertrag für `preferences`:**

- Mitarbeiter: `Record<string, unknown>` (immer object, leeres `{}` wenn `Employee.preferences` null/leer)
- Clients: `null` (Clients haben heute keine Preferences-Spalte)

**Vertrag für `tenant.theme`:**

- Immer voll-populiert. Backend füllt Defaults (`primaryColor: '#3f287c'`, etc.) wenn `tenant.settings.theme` leer ist.
- Frontend ruft `themeService.applyTheme(snapshot.tenant.theme)` ohne Null-Check.

---

## 4. Landing-Resolver (Backend) — finalisiert

Der `LandingResolver` ist eine reine Funktion über dem geladenen `Session`-DTO. Er liefert `landing.mode` + `landing.scope` + ein `rationale: string[]`, das im Log mitgeschrieben wird.

### Eingangs-Daten — was zählt als „Einrichtungs-Zuweisung"?

Eine Einrichtung kommt nur dann in `session.permissions.institutions[]` vor, wenn ALLE drei Bedingungen erfüllt sind:

1. User hat eine `institution_employee_assignment` mit `deleted_at IS NULL`
2. Institution selbst ist aktiv (`is_active = true`)
3. Institution hat den Beratungs-/Einrichtungsmodus an (`features.institutions.enabled = true`, mirrored auf `allow_counseling_mode`)

Reine **Organisations-Zuweisungen** ohne Beratungsmodus werden **nicht** in den Session-Snapshot aufgenommen — sie zählen nicht für Routing oder Permission-Checks. Verwaltungs-UIs für solche Mitgliedschaften nutzen weiterhin die Listen-Endpoints (`/institutions`, `/employees/{id}/institutions`).

### Regeln (M1) — Reihenfolge: erste Match gewinnt

| #   | Bedingung                                                                                                                                 | Ergebnis                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `identity.status === 'pending_approval'`                                                                                                  | `mode='blocked', blockedReason='pending_approval'`                         |
| 2   | `identity.type === 'client'` UND `features.clientPortal.enabled`                                                                          | `mode='client_portal', scope.kind='client_portal'`                         |
| 3   | `identity.type === 'employee'` UND `features.teamspace.enabled === true`                                                                  | `mode='teamspace', scope.kind='teamspace'`                                 |
| 4   | `identity.type === 'employee'` UND `features.teamspace.enabled === false` UND `permissions.institutions` mind. 1 Eintrag                  | `mode='einrichtung', scope.id = pickPreferredInstitution()`                |
| 5   | `identity.type === 'employee'` UND `features.teamspace.enabled === false` UND keine Inst-Zuweisung UND `elevation.isTenantAdmin === true` | `mode='einrichtung', scope.id = pickFirstTenantInstitution()` _(Option B)_ |
| 6   | sonst                                                                                                                                     | `mode='blocked', blockedReason='no_assignments'`                           |

**Schlüssel-Eigenschaft:** Wenn der Tenant Teamspace aktiviert hat, landet **jeder Mitarbeiter** dort — unabhängig davon, ob er Teamspace-Mitglied ist oder nur konsumiert. Teamspace ist die Default-Mitarbeiter-App. Einrichtung als Landing existiert nur, wenn Teamspace im Tenant aus ist.

### `pickPreferredInstitution()` — Last-Used-Kette

Reine Funktion, die die "richtige" Einrichtung als Landing-Scope für einen Mitarbeiter findet. Reihenfolge:

1. Falls User-Preference `last_visited_institution_id` gesetzt UND diese Institution noch in `permissions.institutions` enthalten → diese.
2. Sonst: Mitgliedschaft mit dem höchsten `last_used_at` (aus `institution_employee_assignments`).
3. Sonst: erste Institution alphabetisch nach `name` (deterministisch für Tests).

### `pickFirstTenantInstitution()` — Tenant-Admin ohne Inst-Zuweisung

Für Option B (siehe Open Decision #2 → entschieden: B). Reihenfolge:

1. Falls User-Preference `last_visited_institution_id` gesetzt UND diese Institution existiert im aktuellen Tenant UND ist aktiv UND hat Beratungsmodus an → diese.
2. Sonst: erste Institution des Tenants alphabetisch (mit `is_active=true` und `features.institutions.enabled=true`).
3. Sonst (es gibt im Tenant keine einzige aktive Institution mit Beratungsmodus an) → `mode='blocked', blockedReason='no_assignments'`.

**Backend-Erweiterung dafür:** ein neues Feld `last_visited_institution_id` auf der User-Preferences-Tabelle (oder `auth_user_tenant`). Wird bei jedem Wechsel in eine Einrichtungs-Seite aktualisiert (für Mitarbeiter UND Admins, nicht nur bei expliziten Switch-Calls).

### Beispiel `rationale`

```
[
  "principalType=employee",
  "status=active",
  "features.teamspace.enabled=true",
  "→ landing.mode=teamspace"
]
```

oder (Tenant ohne Teamspace, Multi-Inst-Mitarbeiter):

```
[
  "principalType=employee",
  "status=active",
  "features.teamspace.enabled=false",
  "permissions.institutions size=2",
  "pickPreferredInstitution: last_visited_institution_id=abc-123 → match",
  "→ landing.mode=einrichtung, scope.id=abc-123"
]
```

---

## 5. Persona-Klassifizierer — finalisiert

Lebt in `@tagea/session` (geteilt). Wird sowohl im Backend (für strukturierte Logs) als auch im Frontend (für Boot-Trace und E2E-Filter) eingesetzt.

```ts
export type PersonaLabel =
  | 'blocked' // landing.mode === 'blocked'
  | 'pending_approval' // status overrides everything
  | 'client_portal_user' // type=client immer
  | 'super_admin' // elevation, eigene Bühne
  | 'tenant_admin_no_institution' // tenant admin + 0 institutions im Snapshot
  | 'multi_institution_employee' // ≥2 institutions im Snapshot (auch wenn admin)
  | 'single_institution_employee' // genau 1 institution im Snapshot
  | 'teamspace_only_employee'; // 0 institutions, tenant hat teamspace an
```

**Reihenfolge (erste Match gewinnt):**

1. `landing.mode === 'blocked'` → `blocked`
2. `identity.status === 'pending_approval'` → `pending_approval`
3. `identity.type === 'client'` → `client_portal_user`
4. `elevation.isSuperAdmin` → `super_admin`
5. `elevation.isTenantAdmin && |institutions| === 0` → `tenant_admin_no_institution`
6. `|institutions| ≥ 2` → `multi_institution_employee`
7. `|institutions| === 1` → `single_institution_employee`
8. sonst → `teamspace_only_employee`

**Wichtig**: `|institutions|` zählt die Beratungsmodus-aktiven Mitgliedschaften (siehe Sektion 4). Rein organisatorische Mitgliedschaften beeinflussen den Stempel nicht.

Code: siehe `packages/session/src/lib/persona-classifier.ts` im Hauptrepo. Tests in `persona-classifier.spec.ts` decken jede Regel und die Vorrang-Reihenfolge ab.

---

## 6. Logging-Schema

### Frontend BootTracer

Sammelt alle Phasen, dump als **eine** Log-Zeile pro Boot:

```
[boot 4f3a7e] phase=tenant_resolution     durMs=12   ok=true
[boot 4f3a7e] phase=oidc_init             durMs=43   ok=true   tokenAvailable=true
[boot 4f3a7e] phase=session_fetch         durMs=187  ok=true   personaLabel=teamspace_only_employee
[boot 4f3a7e] phase=landing_apply         durMs=1    landing.mode=teamspace scope.kind=teamspace
[boot 4f3a7e] phase=router_navigate       durMs=8    to=/teamspace
[boot 4f3a7e] phase=shell_render          durMs=22   shell=teamspace
[boot 4f3a7e] DONE total=273ms phases=6 personaLabel=teamspace_only_employee
```

JSON-Variante als zusätzliches Log-Event für Tools (Sentry, Datadog).

### Backend `GET /session` Log

Eine Zeile pro Call:

```jsonc
{
  "level": "info",
  "endpoint": "GET /session",
  "bootId": "4f3a7e",
  "userId": "...",
  "tenantId": "...",
  "personaLabel": "teamspace_only_employee",
  "landing": {
    "mode": "teamspace",
    "scope": { "kind": "teamspace" },
    "rationale": ["principalType=employee", "features.institutions.enabled=true", "permissions.institutions size = 0", "features.teamspace.enabled=true", "→ landing.mode = teamspace"],
  },
  "perms": { "tenantCount": 12, "instCount": 0, "tsCount": 3 },
  "durMs": 142,
}
```

---

## 7. Decisions (alle entschieden)

### #1 — Persona-Klassifizierungs-Regeln ✅

Strenge Reihenfolge, ein Label pro User. Regeln in Sektion 5 dokumentiert, Code in `packages/session/src/lib/persona-classifier.ts` im Hauptrepo.

### #2 — Tenant-Admin ohne Institutions-Zuweisung ✅

**Entscheidung: Option B** — Admin landet automatisch in einer Einrichtung. Auswahl-Reihenfolge: zuletzt besuchte Einrichtung (User-Preference `last_visited_institution_id`) → erste aktive Einrichtung des Tenants alphabetisch → wenn keine vorhanden, dann `blocked`.

Konsequenz: Backend-Erweiterung `last_visited_institution_id` in den User-Preferences. Wird bei jeder Einrichtungs-Navigation aktualisiert, auch ohne expliziten Switch.

### #3 — Boot-Trace-Felder ✅

**Standard-Set pro Login:**

- alle Tenant-Features mit `enabled` + Begründung wenn aus
- alle relevanten Permissions (jene, die in der UI für die User-Persona getestet werden) mit `granted: true|false`
- alle verfügbaren Einrichtungen mit User-Rolle pro Stück (`name`, `role`, `counselingModeEnabled`, `lastUsedAt`)

Konkrete Log-Felder werden in der Implementierung als `BootTraceLogPayload` getypt — siehe Logging-Sektion 6.

---

## 8. Milestones

| #                   | Inhalt                                                                                                                                                                                                    | Reviewable als      | Status                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **M1**              | Spec, `@tagea/session` Paket mit DTO + Klassifizierer, Backend `/session` + LandingResolver, Frontend SessionBootstrap/Store/Router (minimal), 3 Persona-Landing-Pfade, Logging FE+BE, E2E für 3 Personas | 1 PR                | ✅                                                                                                                               |
| M2                  | Multi-Inst-Mitarbeiter mit Mode-Switch, Landing-Algo erweitert, Tenant-Switch über `/session`                                                                                                             | 1 PR                | ✅                                                                                                                               |
| M3                  | Permission-Guards umgestellt (`requirePermission`, `requireScope`, `requireFeature`), alte Guards gelöscht                                                                                                | 1 PR                | ✅                                                                                                                               |
| M4                  | Komponenten-Migration auf `SessionAuthz`, Mode-Toggle umgebaut                                                                                                                                            | 1 PR                | ✅                                                                                                                               |
| M5                  | `UnifiedAuthService`, `AuthorizationStore`, `UserPermissionsService`, `InstitutionContextService`, `NavigationModeService`, `wait-for-auth-data.ts` und alte Endpoints gelöscht                           | 1 PR (der Hard-Cut) | ✅ Intent erfüllt — `InstitutionContext` relocated statt gelöscht (siehe `InstitutionContextService` Audit, Sticky load-bearing) |
| **M5+ (Cluster 3)** | Architektur-Vertiefung: SessionAssembler raw-SQL → TypeORM (3.1), PostHydration ausbauen für Push + Matrix (3.4), `preferences` + `tenant.theme` ins DTO + dead-theme-cleanup (3.5)                       | 1 PR                | ✅                                                                                                                               |

---

## 9. Risiken (M1)

- **Latenz `/session`**: aggregiert heutige `/auth/current` + `/auth/context` + `/tenants/current/features` in einem Call. Wenn unter ~200 ms im p95, OK; sonst Caching auf Backend-Seite (ETag) oder Stale-While-Revalidate auf Frontend.
- **Bestand bleibt parallel funktional**: M1 ersetzt **noch nicht** den alten Flow. `UnifiedAuthService.loadEmployeeProfile()` und `defaultModeRedirectGuard` bleiben in Funktion, weil die Komponenten sie noch lesen. Erst M3+ migriert sie. Damit bleibt M1 risikoarm — der neue Code wird in der `APP_INITIALIZER`-Phase mitgeladen, aber das Routing für die 3 Personas geht durch `SessionRouter`. Konflikte zwischen alt und neu werden durch ein Flag im `SessionBootstrap` ausgesteuert (siehe Implementierung).
