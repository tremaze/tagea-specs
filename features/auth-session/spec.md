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

---

## 10. M2 — Tenant- & Institution-Switch + Last-Visited-Persistenz

> Status: **shipped**. Code in `apps/tagea-frontend/src/app/auth-session/session-switcher.service.ts`, `apps/tagea-backend/src/auth/session/session-preferences.controller.ts`, Migration `…AddLastVisitedInstitution.ts`.

### 10.1 Ziele

- Switch-Flows (Tenant & Institution) stehen **nicht** mehr in `UnifiedAuthService`. Stattdessen ein dedizierter, dünner Service `SessionSwitcher`.
- Multi-Institution-Mitarbeiter werden bei Cold-Boot wieder in die zuletzt benutzte Einrichtung gelandet, ohne dass die `LandingResolver`-Regel #4 raten muss.
- Tenant-Admin ohne explizite Einrichtungs-Zuweisung (Persona „tenant_admin_no_institution", Section 5) profitiert ebenfalls — Option B von Decision #2 wird durch denselben Backend-Speicher bedient.

### 10.2 Architektur

```
                              FRONTEND
   ┌───────────────────────────────────────────────────────┐
   │  Top-bar-Switcher / Programmatic                      │
   │     ↓                                                 │
   │  SessionSwitcher                                      │
   │   .setTenant(id)        ─► POST /auth/current-tenant  │  │ full reload
   │                              ↓                        │  │ via location='/'
   │                            cookie + tenant-cookie     │  ▼
   │   .setInstitution(id)   ─► POST /auth/current-institution
   │                              ↓                        │
   │                            ack + soft re-hydrate      │
   │   .refreshSession()     ─► (kein HTTP, nur hydrate)   │
   └───────────────────────────────────────────────────────┘
                                       │
                              Jede Navigation
                              auf /einrichtung/:institutionId/*
                                       │
                                       ▼
   ┌───────────────────────────────────────────────────────┐
   │  sessionInstitutionUrlGuard fired durch Router        │
   │     │                                                 │
   │     ├─ validate UUID + check session.permissions.…    │
   │     ├─ InstitutionContext.setInstitutionId(id)        │
   │     ├─ InstitutionFeaturesService.loadFeatures(id)    │
   │     └─ SessionPreferencesService.recordVisitedInstitution(id)
   │                                                   │   │
   │                                                   ▼   │
   │                       PUT /session/preferences/last-visited-institution
   │                                  (fire-and-forget)
   └───────────────────────────────────────────────────────┘
```

### 10.3 Verträge

#### `POST /auth/current-tenant`
- Request: `{ tenantId: string }`
- Response: ack (Body wird ignoriert) — Cookie/Header werden aktualisiert.
- Folge im FE: **Full Page Reload** auf `'/'`, damit Interceptor-Caches, Matrix-Client, Push-Subscription und Route-Tree sauber neu booten. `SessionBootstrap.hydrate()` läuft am neuen Tenant.

#### `POST /auth/current-institution`
- Request: `{ institutionId: string | null }`
- Response: `{ success: boolean; institutionId: string | null; institutionName: string | null }`
- Folge im FE (**soft switch** — kein Reload):
  - `InstitutionContext.setInstitutionId(id)` — Sticky-Signal-Update
  - `DashboardDataService.clear()` + `ClientsDataService.clear()` + `CalendarDataService.clear()` — Cache invalidation
  - `SessionBootstrap.hydrate()` — Permission-Slice + per-Institution-Features kommen frisch

#### `PUT /session/preferences/last-visited-institution`
- Request: `{ institutionId: string (UUID) }`
- Response: `204 No Content`
- Schreibt `auth_user_tenant.last_visited_institution_id` für `(authProviderUserId, tenantId)`.
- Aufrufer: `sessionInstitutionUrlGuard` (fire-and-forget, blockiert Navigation nicht).
- Backend-Service: `SessionPreferencesService.setLastVisitedInstitution(authUserId, tenantId, institutionId)`.

### 10.4 Acceptance Criteria

- [ ] **Given** eine eingeloggte Mitarbeiterin mit Zugriff auf Einrichtungen A + B, **When** sie zuletzt unter `/einrichtung/B/...` war und neu lädt, **Then** liefert `GET /session` `landing.scope = { kind: 'institution', id: 'B' }` und das FE landet auf `/einrichtung/B/dashboard`.
- [ ] **Given** ein Tenant-Admin ohne Institution-Assignments (Persona `tenant_admin_no_institution`), **When** er zuletzt unter `/einrichtung/C/...` war, **Then** landet er bei Re-Login wieder dort — auch wenn er keine `institution_employee_assignment` hat (Option B aus Decision #2).
- [ ] **Given** die Mitarbeiterin klickt im Top-Bar-Tenant-Switcher auf einen anderen Tenant, **When** `SessionSwitcher.setTenant()` läuft, **Then** wird `window.location.href = '/'` gesetzt und nach dem Reload startet `SessionBootstrap.hydrate()` am neuen Tenant — die alte Institution-ID landet **nicht** in einem URL beim neuen Tenant.
- [ ] **Given** die Mitarbeiterin wechselt via Soft-Switch in eine andere Einrichtung, **When** `SessionSwitcher.setInstitution()` läuft, **Then** wird kein `window.location.reload()` ausgelöst, sondern `SessionStore` enthält nach `hydrate()` den per-Institution-Permission-Slice der neuen Einrichtung.
- [ ] **Given** der Backend-Storage für `last_visited_institution_id` ist leer (Erstlogin), **When** `LandingResolver.pickPreferredInstitution()` läuft, **Then** wird das Fallback-Sortierkriterium `last_used_at` aus `institution_employee_assignments` genutzt; tie-break alphabetisch.

### 10.5 Edge Cases

- **Letzte Institution nicht mehr zugreifbar** (Assignment gelöscht, Einrichtung deaktiviert, Beratungsmodus aus): `pickPreferredInstitution` ignoriert den persistierten Wert und greift auf den Fallback zurück. Persistierter Wert bleibt zur nächsten gültigen Navigation in der DB.
- **Soft-Switch race**: `SessionBootstrap.hydrate()` swallowt Errors (siehe `SessionStore.bootstrapError` Signal). Tests in `session-switcher.service.spec.ts` decken success + failure-Path.
- **Tenant-Switch ist destructive**: Alle in-flight Requests werden vom Reload abgeschossen. Akzeptiert — Tenant-Wechsel ist ein seltener Operation-mode-Switch.

---

## 11. M3 — Factory-Guards + Legacy-Guard-Hard-Cut

> Status: **shipped**. Code in `apps/tagea-frontend/src/app/auth-session/authz-guards.ts` + `session-institution-url.guard.ts` + `session-landing-redirect.guard.ts`. 26 Legacy-Guards gelöscht in `0076461e5`.

### 11.1 Ziele

- Routing-Authz ist ein **Funktionsaufruf am Routendefinitionsort**, kein in einer separaten Datei versteckter `data: { requiredPermission: 'x.y' }`-Magic-String mehr.
- Permission-Strings stammen aus `@tagea/permissions` und sind am Aufrufort typgeprüft.
- Ein Failure-Pfad: jeder Guard, der scheitert, **delegiert** an `SessionRouter.resolveLandingCommands(session)` — kein lokales Redirect-Branching mehr.
- Eine einzige Stelle (`makeGuard(predicate, options?)`) für Boilerplate (snapshot-laden, retry-bootstrap, error-redirect).

### 11.2 Factory-API

```ts
// apps/tagea-frontend/src/app/auth-session/authz-guards.ts
requirePermission(permission)               // ANY scope
requireTenantPermission(permission)         // tenant-role only
requireInstitutionPermission(permission)    // checks :institutionId in URL
requireAnyPermission(permissions[])         // OR-of-list, ANY scope
requireFeature(featureName)                 // tenant feature gate
requireBillingProvider('tagea' | 'idea' ...)// billing.provider extra
requireInstitutionFeature(featureName)      // effective per-institution gate
requireSuperAdmin()
requireTenantAdmin()                        // super-admin passes too
requireClient()
requireEmployee()
```

Alle akzeptieren `AuthzGuardOptions { fallback?: unknown[] }`. Default-Fallback ist die Backend-Landing.

Typisches Stacking:

```ts
{
  path: 'einrichtung/:institutionId/cases',
  canActivate: [
    sessionInstitutionUrlGuard,                                  // validate URL → set scope
    requireFeature('cases'),                                     // tenant feature
    requireInstitutionPermission(EMPLOYEE_PERMISSIONS.CASES_VIEW), // per-inst perm
  ],
}
```

### 11.3 Spezial-Guards (kein Factory)

- **`sessionLandingRedirectGuard`** — ersetzt `defaultModeRedirectGuard` (140 LoC → 5 LoC). Catch-all `**` unter `secure-main`. Liest `SessionStore.snapshot()`, fragt `SessionRouter.resolveLandingCommands(session)`, navigiert. Empty-Store-Recovery: ein Retry via `SessionBootstrap.hydrate()`, dann `/auth-error?reason=session_unavailable`.
- **`sessionInstitutionUrlGuard`** — ersetzt `institutionUrlGuard`. Validiert UUID + `session.permissions.institutions[id]`, setzt `InstitutionContext`, lädt per-Institution-Features, schreibt `last-visited-institution` via `SessionPreferencesService.recordVisitedInstitution()`. Bei nicht-zugreifbarer ID: Delegation an `SessionRouter`.

### 11.4 Gelöschte Legacy-Guards (M3.3 phase 1)

Commit `0076461e5` (vollständige Liste im Diff):
- `permissionGuard`, `tenantPermissionGuard`
- `teamspaceAdminOnlyGuard`, `teamspaceAdminGuard`
- `chatFeatureGuard`, `aiChatFeatureGuard`, `fileStorageFeatureGuard`, `teamspaceFeatureGuard`, `schulungenFeatureGuard`, `billingFeatureGuard`
- `institutionUrlGuard`, `defaultModeRedirectGuard`
- `clientPortalGuard`, `einstellungenGuard`, mehrere `einstellungen-*-redirect-guard` Helfer
- 26 Guards insgesamt

### 11.5 Acceptance Criteria

- [ ] **Given** eine Route mit `canActivate: [requireFeature('chat'), requireInstitutionPermission(PERM)]`, **When** das Tenant-Feature aus ist, **Then** wird das zweite Predicate gar nicht ausgewertet — Router kurzschließt auf den Backend-Landing-URL-Tree.
- [ ] **Given** ein UrlTree-Return aus einem Guard, **When** der Default-Fallback aktiv ist, **Then** ist das Ziel `SessionRouter.resolveLandingCommands(session)` und niemals ein hardcoded `/dashboard`.
- [ ] **Given** `SessionStore.isLoaded()` ist `false` beim Guard-Run, **When** der Guard fired, **Then** ruft er `SessionBootstrap.hydrate()` einmal und versucht den Snapshot erneut zu lesen, bevor er auf `/auth-error` redirected.
- [ ] **Given** ein deep-link auf `/einrichtung/<unbekannte-id>/...`, **When** `sessionInstitutionUrlGuard` läuft, **Then** delegiert er an `SessionRouter.resolveLandingCommands(session)` (also typischerweise `/teamspace` für Teamspace-User oder `/einrichtung/<bevorzugte>/dashboard` für Multi-Inst-User).

---

## 12. M4 — Komponenten-Migration: SessionAuthz, SessionIdentity, NavigationMode, InstitutionContext, PostSessionHydration

> Status: **shipped**. Code unter `apps/tagea-frontend/src/app/auth-session/`. M4.1–M4.7 Commit-Range `cdb9bf5c9` … `fced0bc59`.

### 12.1 Service-Inventar (Public API der `auth-session/`-Welt)

| Service | Ersetzt | Verantwortung |
|---|---|---|
| `SessionStore` | `UnifiedAuthService` (state-Anteil), `AuthorizationStore` (state-Anteil) | Single source of truth für das `/session`-Snapshot. Pure state, keine HTTP. Writer: `SessionBootstrap`/`SessionSwitcher`. |
| `SessionAuthz` | `UserPermissionsService`, `AuthorizationStore.has*`, `UnifiedAuthService.has*Permission` | Permission- + Feature-Lookup. **Scope-explicit**: `can`/`canInTenant`/`canInInstitution`/`canInTeamspace`/`canAsClient`/`canInActiveInstitution`. Elevation-Reads: `isSuperAdmin`/`isTenantAdmin`/`isSchulungAdmin`/`isClient`/`isEmployee`. |
| `SessionIdentity` | `UnifiedAuthService.userName`/`userEmail`/`userRole`, `CurrentUserService` (display-Teil) | Display-Reads für Header, Sidebar, User-Menu, Profile-Karten. `identity()` + `displayName()` als signals. |
| `NavigationMode` | `NavigationModeService` + `localStorage['navigation-mode']` | Mode = `teamspace` ⊕ `einrichtung`. URL-derived, sticky auf ambiguous routes (`/chat`, `/einstellungen`, ...). Keine localStorage-Persistenz mehr. Setter weg — Mode folgt URL. |
| `InstitutionContext` | `InstitutionContextService` (relocated, nicht gelöscht — siehe M5) | URL-derived `:institutionId` Signal. Listener auf `NavigationEnd`, Override-API für Dialog-Flows. |
| `BootTracer` | console.log noise | Strukturierter Boot-Trace (Phases + persona + bootId). Eine Log-Zeile pro Boot. |
| `PostSessionHydrationService` | `secure-shell` constructor-effects, `loadAndApplyTenantTheme()` | Post-Snapshot-Side-Effects: Sentry-User-Context, Push-Init (mit pushBrandId), Matrix-Connect (gated by feature + perm), Preferences-Cache-Prime, Theme-Apply. Idempotent + re-runnable bei Tenant-Switch. |
| `SessionBootstrap` | `APP_INITIALIZER`-Anteil von `initializeApp` + `UnifiedAuthService.loadEmployeeProfile` | Cold-boot Pipeline: OIDC ensureAuthenticated → GET /session → SessionStore.set → PostHydration → Landing-Navigation. Außerdem effect() für OIDC auth-flip false→true (native WebAuthSession return). |
| `SessionRouter` | hardcoded `/dashboard` redirects, `getDefaultRouteForUser()` | Pure mapping `Landing.scope` → `Router commands[]`. |
| `SessionSwitcher` | `UnifiedAuthService.setCurrentTenant`/`setCurrentInstitution` | Switch-Flows + Cache-Invalidation. Siehe M2. |
| `SessionLogout` | `UnifiedAuthService.logout` | Logout-Pipeline: push.unsubscribe, theme.resetTheme, matrix.disconnect, OIDC logout, SessionStore.clear. |
| `SessionPreferencesService` | — neu — | FE-Pendant zum `SessionPreferencesController`. `recordVisitedInstitution(id)` fire-and-forget. |
| `OidcLifecycle` | `wait-for-auth-data.ts`, ad-hoc subscriptions in `UnifiedAuthService` | Bridge zwischen `@tagea/auth` events und `SessionStore` (token-refresh-error → SESSION_EXPIRED, etc.). |

### 12.2 NavigationMode — Bruchstellen zur alten Welt

Die alte `NavigationModeService` hatte vier Verantwortlichkeiten:
1. URL-Listener (`NavigationEnd` → mode)
2. localStorage-Read/Write
3. `setMode(value)` Setter
4. Default `teamspace` bei Cold-Boot

`NavigationMode` (neu) behält 1 + 4. 2 und 3 sind weg:
- **Kein localStorage** — Cold-Boot auf einer mode-ambiguen Route (z.B. `/chat`) defaultet auf `teamspace`. Toggle bleibt zugänglich für Multi-Inst-User.
- **Kein Setter** — Mode-Toggle navigiert den Router, der nächste `NavigationEnd` flippt das Signal automatisch.

Konsequenz für UI: Mode-Toggle (`shell/mode-toggle/`) muss nicht mehr `setMode()` rufen, sondern direkt `router.navigate(['/teamspace'])` oder `router.navigate(['/einrichtung', id, 'dashboard'])`.

### 12.3 Acceptance Criteria

- [ ] **Given** eine Komponente liest `sessionAuthz.canInActiveInstitution('cases.view')` auf einer `/einrichtung/X/cases`-Route, **When** der User in X die Permission hat, in Y nicht, **Then** liefert der Check `true` — auch wenn die URL gleichzeitig Y in einem Query-Param erwähnt.
- [ ] **Given** eine Komponente liest `sessionIdentity.displayName()` während OnPush-Change-Detection, **When** der Snapshot nicht wechselt, **Then** wird der computed Signal nicht neu evaluiert (keine String-Allokation pro CD-Zyklus).
- [ ] **Given** ein User wechselt Tenant via `SessionSwitcher.setTenant`, **When** der Browser nach dem Reload `SessionBootstrap.hydrate()` durchläuft, **Then** ruft `PostSessionHydrationService.run()` `pushNotifications.init` mit der neuen `pushBrandId` und `themeService.applyTheme` mit den neuen Brand-Farben — keine alten Werte überleben den Switch.
- [ ] **Given** der User loggt sich aus, **When** `SessionLogout.logout()` läuft, **Then** wird in dieser Reihenfolge gerufen: `push.unsubscribe(token)`, `chat.disconnect()`, `theme.resetTheme()`, `auth.logout()`, `sessionStore.clear()`.

---

## 13. M5 — Hard-Cut: Was tatsächlich gelöscht ist + die Eine Ausnahme

> Status: **shipped**. Commits `0076461e5` (26 Guards), `67de39101` (`AuthorizationStore`-Injects), `ee6b0ff49` (`UserPermissionsService`), `dac059448` (`AuthorizationStore`), `eb1378776` (schulung-admin / push-brand state), `5f7e48647` (`UnifiedAuthService` Sweep), `edd7a3112` (M5 atomic + InstitutionContext-Relocate).

### 13.1 Was tatsächlich gelöscht wurde

| Komponente | Status |
|---|---|
| `UnifiedAuthService` | **gelöscht** |
| `AuthorizationStore` | **gelöscht** |
| `UserPermissionsService` | **gelöscht** |
| `wait-for-auth-data.ts` | **gelöscht** |
| `CurrentUserService` (180 LoC) | **gelöscht** (Sweep 1+2, `b0453ec57`) |
| 26 Legacy-Guards | **gelöscht** (Section 11.4) |
| `defaultModeRedirectGuard` | **gelöscht** |
| `institutionUrlGuard` (alt) | **gelöscht** |
| `loadAndApplyTenantTheme()` + `GET /tenants/current/theme` | **gelöscht** (Cluster 3.5 cleanup, `2f30f3674`) |
| `GET /auth/me/institutions` | **gelöscht** (`95f990c67`) |
| diverse schulung-admin/push-brand Standalone-Services | **gelöscht** (in DTO konsolidiert, `eb1378776`) |

### 13.2 Beibehaltene Endpoints (mit dokumentierter Begründung)

- **`GET /auth/me/tenants`** — chat-frontend ruft das als Pre-Tenant-Context-Endpoint. Kann nur nach separater chat-frontend-Migration weg. Doc-Comment am Controller.
- **`POST /auth/current-tenant`** + **`POST /auth/current-institution`** — Action-Endpoints für den Switch. M2 nutzt sie.
- **`POST /auth/me/change-password`** — legitime Action-Route (Keycloak-bypass für In-App-Password-Change), nichts zu konsolidieren.

### 13.3 Die Eine Ausnahme — `InstitutionContextService` → `InstitutionContext`

Die Spec (Section 8) sagt: „`InstitutionContextService` gelöscht". Der Phase-D-Audit hat aber gezeigt, dass der Service **kein** HTTP-Wrapper ist (wie die anderen drei), sondern ein **URL-derived state holder** mit Sticky-Verhalten, das von 97 Konsumenten genutzt wird.

**Beschluss:** Option B aus `phase-d-institution-context-plan.md` — Service umgezogen, nicht gelöscht.

- Datei wandert: `services/institution-context.service.ts` → `auth-session/institution-context.service.ts`
- Klasse umbenannt: `InstitutionContextService` → `InstitutionContext`
- 97 Importe per `sed` umgestellt (Commit `edd7a3112`)
- Cluster 3.2 (vollständige Eliminierung via URL-only Helper) wurde nach Audit 2026-05-12 explizit **skipped** — Sticky-Verhalten ist load-bearing für ~30–50 Features (Teamspace-Filter, `secure-main`, `top-bar`, `tenantContextInterceptor` X-Institution-ID Header).

Vollständiger Audit unter `project_institution_context_audit.md` (Memory).

### 13.4 Acceptance Criteria

- [ ] **Given** ein `grep "UnifiedAuthService"` über `apps/tagea-frontend`, **Then** matcht **nichts** außer der eigenen DI-token-deprecation-doc-comment.
- [ ] **Given** ein `grep "AuthorizationStore"` über `apps/tagea-frontend`, **Then** matcht **nichts**.
- [ ] **Given** ein `grep "UserPermissionsService"` über `apps/tagea-frontend`, **Then** matcht **nichts**.
- [ ] **Given** ein `grep "InstitutionContextService"` über `apps/tagea-frontend`, **Then** matcht **nichts** (alle Importe nutzen `InstitutionContext`).
- [ ] **Given** ein Type-Check (`tsc --noEmit`), **When** auf den Branch checked, **Then** ist er grün (kein dead reference auf gelöschte Symbole).

---

## 14. Cluster 3 — Architektur-Vertiefung (M5+)

> Status: 3.1 / 3.4 / 3.5 / Theme-Cleanup **shipped**, 3.2 explizit **skipped** nach Audit, 3.3 **nicht empfohlen**. Wave-5-Commits `e8f9fcb3c`, `c250470b3`, `6a1d9ba2f`, `2f30f3674`, `745e59410`, `e5a289c03`.

### 14.1 — SessionAssembler raw-SQL → TypeORM ✅

**Was:** Zwei der drei raw-SQL-Statements in `SessionAssemblerService` durch `Repository.find()`-Calls ersetzt; die dritte (`loadTenantWideFirstInstitution`, JSONB-path) bleibt bewusst raw.

**Warum:** Beim Live-Smoke-Test 2026-05-11 hatte raw SQL zwei Production-Bugs (UUID-Cast `::uuid[]`, fehlender `meta.` Schema-Prefix), die in unit-tests mit gemockten DataSources nicht auftauchten. Strukturelle Lösung: TypeORM-Repos erzwingen schema-aware-types am Compiler.

**Konsequenz:** Bug-Klassen sind strukturell weg. `queries.spec.ts` (testcontainers-Integration für die raw-SQL) konnte gelöscht werden (-194 LoC, 6 Tests aus dem Lauf raus). Service-Specs nutzen `getRepository`-Mocks statt `query`-Mocks.

### 14.2 — InstitutionContext Option C ❌ skipped

Siehe Section 13.3. Audit-Ergebnis: Sticky-Verhalten load-bearing. Variante B (URL-only) bricht reproduzierbar 30–50 Features. Audit-Doc: `project_institution_context_audit.md`.

### 14.3 — CurrentEmployeeService eliminieren ❌ nicht empfohlen

Service ist heute schon dünn (146 LoC, kein HTTP, kein eigener State, snake_case-Bridge für Form-Bindings). Refactor-Aufwand 1–2 Tage für minimalen Architektur-Gewinn. Nicht im Cluster 3 Scope.

### 14.4 — `runPostHydration` ausbauen für Push + Matrix ✅

**Was:** Push-Init und Matrix-Connect waren bisher in `secure-shell.component.ts` als Constructor-`effect()`s implementiert. Migriert nach `PostSessionHydrationService.run()`.

**Warum:**
- Audit hat zwei Production-Bugs aufgedeckt:
  1. `chatInitialized` / `pushInitialized`-Flags in secure-shell waren **never reset on tenant switch** — Matrix-Client blieb mit alten Credentials hängen.
  2. `loginResponse$.subscribe()` ohne `takeUntil(destroy$)` → Subscription-Leak pro SecureShell-Mount.
- PostHydration ist der **eine** dokumentierte Lifecycle-Hook „nach Snapshot, vor Shell-Render". Side-Effects gehören dorthin, nicht in Constructor-Effects.

**Konsequenz:** Smoke 2026-05-12 verifizierte: Matrix-E2EE-Verify-Dialog erscheint korrekt erneut beim Tenant-Switch (default → caritas). Tests: +6 PostHydration in `post-session-hydration.service.spec.ts`.

### 14.5 — `preferences` + `tenant.theme` ins /session-DTO ✅

**Was neu auf dem Snapshot:**
- `Session.preferences: SessionEmployeePreferences | null` — Employee.preferences (jsonb), `null` für Clients
- `Session.tenant.theme: SessionTenantTheme` — `{ primaryColor, primaryColorDark, lightBackgroundColor }`, immer voll-populiert (Backend füllt Defaults aus `tenant.settings.theme`)
- `Session.tenant.pushBrandId: string | null` — schon in M4 ergänzt, hier verifiziert
- `Session.elevation.isSchulungAdmin: boolean` — schon in M4 ergänzt

**Folge:**
- 2 cold-boot HTTP-Calls weniger (`GET /employees/me/preferences`, `GET /tenants/current/theme`)
- `PostSessionHydrationService.run()` ruft:
  - `EmployeeSelfService.primePersonalPreferences(snapshot.preferences)` — idempotente Seed-Methode, füllt subject + signal
  - `ThemeService.applyTheme(snapshot.tenant.theme)` — appliziert CSS Custom Properties
- `loadAndApplyTenantTheme()` aufgeräumt + `GET /tenants/current/theme` Endpoint gelöscht (`2f30f3674`)

**Verträge:**
- `preferences` immer object (`{}` wenn nicht gesetzt) für Employees, `null` für Clients
- `tenant.theme` immer voll-populiert — Frontend ruft `applyTheme` ohne Null-Check

**Follow-ups (nicht-blocking):**
- `GET /employees/me/preferences` Frontend-Fallback in `getPersonalPreferences()` könnte langfristig weg (jetzt wo PostHydration immer primt). Heute defensiv beibehalten.

### 14.6 Acceptance Criteria (Cluster 3)

- [ ] **Given** ein Cold-Boot, **When** der Network-Tab inspiziert wird, **Then** sind weder `GET /tenants/current/theme` noch `GET /employees/me/preferences` zu sehen — beide ersetzt durch `/session`.
- [ ] **Given** ein Tenant-Switch (z.B. Default → Caritas), **When** `PostSessionHydrationService.run()` läuft, **Then** flippen die CSS Custom Properties `--mat-sys-primary` (sichtbar im Browser-Inspector) und der Matrix-Client re-konnektet mit dem neuen ID-Token.
- [ ] **Given** ein Mock-Test über `SessionAssemblerService`, **When** mit Repository-Mocks (nicht raw-query-Mocks) instantiiert, **Then** decken die Tests dieselbe Funktionalität ab wie die alte `queries.spec.ts`.

---

## 15. Refactor-Bilanz & Production-Verifikation

### 15.1 Test-Coverage (Stand 2026-05-12)

| Suite | Tests | Branch-Δ |
|---|---|---|
| `tagea-frontend` Vitest | **277 / 277** | +33 |
| `@tagea/auth` Vitest | **20 / 20** | +4 |
| `tagea-backend` Jest (full) | **1096 / 1096** | grün |
| `tagea-backend` session module | **49 / 49** | +27 |
| `tagea-backend` employees | **38 / 38** | unverändert |
| `tagea-frontend-e2e` auth-session | **6 specs** | +2 (personalverwalter, super-admin) |

### 15.2 Während des Refactors gefundene + behobene Production-Bugs

1. **CORS X-Boot-Id** — Cold-Boot komplett geblockt
2. **SessionAssembler UUID-Cast** — `operator does not exist: uuid = text`
3. **SessionAssembler Schema-Prefix** — `relation "auth_user_tenant" does not exist`
4. **scheduleTokenRefresh 5s-Loop** — pre-existing `@tagea/auth` Library-Bug, alle 5s POST /token an Keycloak
5. **/session Interceptor-Deadlock** — Splash 7.7s → 2.4s (-69%)
6. **NG0203 in secure-main** — `toObservable` außerhalb Injection-Context
7. **`/tenants/current/logo` Single-Flight** — 2-3× parallel statt 1× cached
8. **chatInitialized/pushInitialized Flags** — wurden nie reset, Tenant-Switch ließ Matrix hängen
9. **loginResponse$.subscribe() Leak** — Subscription ohne `takeUntil(destroy$)`

### 15.3 Smoke-Verifikation 2026-05-12 (Chrome MCP gegen dev backend)

Verifiziert:
- Cold-Boot: 1× `/session` statt 4–5 separate Calls
- DTO enthält pushBrandId, theme (caritas-rot), preferences, isSchulungAdmin
- Theme via CSS Custom Properties applied
- Push-Permission-Prompt erscheint (PostHydration triggered)
- Matrix-E2EE-Verify-Dialog erscheint (PostHydration triggered)
- Tenant-Switch (Default → Caritas): theme wechselt `#cc0000` → `#e3051b`, Matrix re-initialized
- 0 refactor-related Console-Errors

### 15.4 PR-Status

- Branch: `claude/refactor-auth-hydration-AtRNs`
- PR: [#78 → develop](https://github.com/tremaze/tagea-next/pull/78), offen, ~83 Commits ahead, **CONFLICTING** mit develop (Team-Job vor merge)
- Working tree: clean, gepushed bis `e5a289c039`

### 15.5 Nicht-im-Scope dieser Spec (eigene Initiativen)

- **Cluster 4.1** `secure-main` Split (1478 LoC) — braucht vorher `secure-main.component.spec.ts` (existiert nicht). Eigener PR.
- **Cluster 4.2** `appointment-dialog-v2` Split (>3000 LoC) — braucht vorher dedizierte E2E-Coverage. Sehr hohes Risiko.
- **`GET /auth/me/tenants` final delete** — sobald chat-frontend von dem Endpoint losgekoppelt ist.
