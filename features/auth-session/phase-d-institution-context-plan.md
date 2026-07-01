# Phase D — `InstitutionContextService` Migration Plan

> Status: **Strategie-Entscheidung offen** (2026-05-11)
> Vorbedingung: Phase A/B/C abgeschlossen, Branch `claude/refactor-auth-hydration-AtRNs` aktuell.

## Was die Spec sagt

`./spec.md` §8, Milestone M5:

> `UnifiedAuthService`, `AuthorizationStore`, `UserPermissionsService`, **`InstitutionContextService`**, `NavigationModeService`, `wait-for-auth-data.ts` und alte Endpoints gelöscht.

Bei UnifiedAuth/AuthorizationStore/UserPermissions war "löschen" eindeutig — sie waren HTTP-Wrapper, die durch das `/session`-DTO ersetzt wurden. Bei `InstitutionContextService` ist die Lage anders.

## Was der Service heute ist

`apps/tagea-frontend/src/app/services/institution-context.service.ts` — 68 LoC. KEIN HTTP-Wrapper, sondern ein **URL-derived state holder**:

1. Reads `:institutionId`-URL-Param via `RouterStateSnapshot` bei jedem `NavigationEnd`-Event → `_institutionId.set()` Signal
2. Exposes `institutionId(): string | null` (readonly signal)
3. Erlaubt manuelles `setInstitutionId(id | null)` als Override für Dialog-Flows

Der State ist **NICHT** im `/session`-DTO enthalten. `session.permissions.institutions` ist die **Liste der zugreifbaren Institutions**, nicht die "currently active". Die "active" ergibt sich aus der URL.

## Konsumenten-Inventur (gemessen)

| Statistik                                    | Anzahl  |
| -------------------------------------------- | ------- |
| Files mit `import InstitutionContextService` | **97**  |
| `.institutionId()` reads                     | **143** |
| `.setInstitutionId()` writes                 | **5**   |

Verteilung der Files:

- `services/` — 43 (HTTP-Services für URL-Composition)
- `pages/` — 26
- `components/` — 11
- `admin/` — 6
- `auth-session/` — 5 (Teil der neuen Welt: guard, switcher, logout, interceptor)
- `reports/` — 4
- `layouts/` — 1 (secure-main)
- `interceptors/` — 1 (tenant-context.interceptor)

Die 5 Writes:

- `auth-session/session-institution-url.guard.ts:84` — beim URL-Match
- `auth-session/session-switcher.service.ts:65` — beim Institution-Switch
- `auth-session/session-logout.service.ts:55` — Clear beim Logout
- `components/client-dialog/client-dialog.component.ts:235+248` — Dialog-Override + Restore

3 von 5 Writes sind im neuen `auth-session/`-Modul.

## Drei Strategie-Optionen

### Option A — Service lebt, nur dokumentiert

**Idee:** Service ist legitim als URL-derived state holder. Spec interpretieren als „die HTTP-Wrapper sind weg, der URL-State darf bleiben".

**Aufwand:** ~30 min (Doc-Comment im Service, Memory-Update, Spec-Annotation)

**Aufkleber:**

- ✅ kein API-Break, keine Konsumenten-Migration
- ✅ Service-Verantwortung ist klar und passt zur Codebase
- ❌ widerspricht der wörtlichen Spec-Aufforderung
- ❌ "InstitutionContextService gelöscht" steht weiter offen

### Option B — Service umziehen nach `auth-session/`

**Idee:** Der Service IST Teil der neuen Auth-/Session-Welt. Verschieben nach `apps/tagea-frontend/src/app/auth-session/institution-context.service.ts`. Funktionalität identisch.

**Aufwand:** ~1-2h

- 1× Datei verschieben + Pfad-Update
- 97 Imports per find/replace anpassen
- Spec-Compliance per "Datei am alten Ort weg" erfüllt

**Aufkleber:**

- ✅ Spec wörtlich erfüllt (alte Datei weg)
- ✅ semantisch sauber (gehört zu auth-session-Welt)
- ✅ minimal-invasiv für Konsumenten
- ❌ niedrige inhaltliche Tiefe

### Option C — Service komplett entfernen

**Idee:** URL ist die Quelle. Alle 143 Reads durch direkte URL-Reads ersetzen, z.B. via einem neuen `routeParam('institutionId')`-Helper basierend auf `inject(ActivatedRoute)` oder einem dedizierten `ROUTE_INSTITUTION_ID = computed(() => …)` injection token.

Die Dialog-Overrides (2 in `client-dialog`) werden zu Component-Inputs oder nutzen das bereits existierende `INSTITUTION_ID_OVERRIDE`-InjectionToken in `interceptors/institution-context.token.ts` als Pattern.

**Aufwand:** ~1-2 Tage

- Neuer Helper/Token bauen
- 97 Files reviewen und umstellen
- 5 Writes neu modellieren
- Tests anpassen
- E2E + manueller Klickdurchlauf aller institution-scoped Routes

**Aufkleber:**

- ✅ strikte Spec-Lesart erfüllt
- ✅ reduziert ein weiteres "Singleton-Service mit Side-State"
- ❌ hohes Touch-Volumen, viele potenzielle Regressionen
- ❌ Test-Coverage für die 97 Konsumenten ist heterogen

## Risiko/Wert-Matrix

| Option | Risiko       | Wert (M5-Closure)                | Wert (Code-Qualität)           | Empfehlung                              |
| ------ | ------------ | -------------------------------- | ------------------------------ | --------------------------------------- |
| A      | sehr niedrig | gering (Spec-Brief offen)        | neutral                        | als Sicherheitsnetz, wenn B/C ausfallen |
| B      | niedrig      | **hoch** (Spec wörtlich erfüllt) | mittel (klare Modul-Zuordnung) | **pragmatisch sinnvoll**                |
| C      | mittel-hoch  | hoch                             | hoch (sauberste Architektur)   | wenn Zeitbudget + Test-Schirm           |

## Meine Empfehlung

**Option B** — der Service ist semantisch Teil der Auth-/Session-Welt, die Verschiebung nach `auth-session/` erfüllt die Spec wörtlich, das Risiko ist niedrig. C ist "schöner" aber bringt für den Refactor-Erfolg nichts Substantielles dazu — der Service tut, was er tun soll. Den 1-2-tägigen C-Refactor würde ich erst angehen, wenn andere Refactor-Threads (mxid-Mini, secure-main split) auch durch sind und der Branch sonst nichts mehr im Backlog hat.

## Offene Fragen für die Strategie-Entscheidung

1. **A vs B vs C?**
2. Bei B: soll der Service umbenannt werden (z.B. `InstitutionContext` statt `InstitutionContextService` analog zu `SessionStore`, `OidcLifecycle`, `BootTracer` im selben Modul)?
3. Bei C: gibt es Anti-Patterns in den 97 Konsumenten, die wir gleich mit-fixen wollen (z.B. URL-Param-Lookups die in Effects/Constructors hängen)?

## Ausführungs-Plan (sobald Strategie steht)

### Bei A — Doc-Only

1. Doc-Comment im Service erweitern
2. Memory `project_auth_refactor_audit_and_roadmap.md` aktualisieren (M5 = 'fertig im Sinne der Intention')
3. Commit `docs(session): document InstitutionContextService kept-alive rationale`

### Bei B — Service umziehen

1. Datei nach `apps/tagea-frontend/src/app/auth-session/institution-context.service.ts` verschieben
2. Klasse ggf. umbenennen zu `InstitutionContext`
3. `auth-session/index.ts` Export hinzufügen
4. 97 Imports per `sed` oder MultiEdit umstellen
5. `tsc --noEmit` grün
6. `nx test tagea-frontend` grün
7. Browser-Smoke: Institution-Switch, einige institution-scoped Routes klicken
8. Commit `refactor(session): move InstitutionContext into auth-session module`

### Bei C — Service entfernen

1. **Pre-Flight:** Audit aller 143 reads — welche brauchen wirklich den State, welche könnten direkt aus URL lesen?
2. Neuen Helper bauen: `routeInstitutionId()` als computed-signal in einem Token oder direkter Service
3. Schichtweise Migration: erst `auth-session/`-Konsumenten, dann services/, pages/, components/, admin/, layouts/, interceptors/, reports/
4. 5 Writes neu modellieren (alle in `auth-session/` außer Dialog-Override → Token)
5. Service-Datei löschen
6. Volle Test-Suite + Browser-Smoke
7. Commit-Batch (1 pro Konsumenten-Cluster, 1 für Final-Delete)
