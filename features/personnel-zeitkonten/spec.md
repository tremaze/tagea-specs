# Feature: Personnel — Zeitkonten (tenant-wide)

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

Tenant-weite HR-Sicht aller Arbeitszeitkonten unter `/personal/zeitkonten`. Aggregiert die existierenden einrichtungs-scoped Time-Account-Daten zu einer Trägeransicht, mit Drill-down pro Mitarbeitende und manueller Saldo-Anpassung. Komplement zur bestehenden einrichtungs-Sicht in `/einrichtung/:id/pep` (Tab "Zeitkonten") — gleiche Datengrundlage, anderer Schnitt.

## User Stories

- Als **HR-Trägerverwalter** möchte ich alle Zeitkonten meines Trägers über alle Einrichtungen hinweg sortier- und filterbar sehen, damit ich Plus-/Minus-Häufungen frühzeitig erkenne.
- Als **HR-Trägerverwalter** möchte ich aus der Liste in eine Verlaufsansicht pro Mitarbeitende springen, um zu sehen, wie sich Saldo, Soll und Ist über Monate entwickelt haben.
- Als **HR-Trägerverwalter** möchte ich manuelle Saldo-Korrekturen mit Begründung erfassen, damit Sondereffekte (Übernahme aus Altsystem, vergessene Krankmeldung) dokumentiert sind.
- Als **HR-Trägerverwalter** möchte ich eine KPI-Kachel mit Mitarbeitenden im Plus, im Minus und mit kritisch hohem Saldo, um Handlungsbedarf zu priorisieren.

## Acceptance Criteria

- [ ] **Given** ich öffne `/personal/zeitkonten`, **When** die Seite lädt, **Then** sehe ich eine Tabelle aller Mitarbeitenden des Trägers mit Spalten: Name, Personalnummer, primäre Einrichtung, Soll (Monat), Ist (Monat), Differenz (Monat), Saldo (kumuliert), Status (verriegelt/offen).
- [ ] **Given** die Liste ist sichtbar, **When** ich auf "Saldo" sortiere, **Then** wird absteigend sortiert (größtes Plus oben, größtes Minus unten).
- [ ] **Given** die Liste ist sichtbar, **When** ich nach Einrichtung filtere, **Then** sehe ich nur Mitarbeitende mit aktivem Assignment in dieser Einrichtung.
- [ ] **Given** ich klicke eine Zeile, **When** der Detailbereich öffnet, **Then** sehe ich die letzten 12 Monate als Tabelle (Soll/Abwesenheit/Ist/Differenz/Vorsaldo/Saldo/Status) und einen Button "Manuelle Anpassung".
- [ ] **Given** ich klicke "Manuelle Anpassung", **When** das Dialog öffnet, **Then** kann ich Monat, Minuten (positiv/negativ) und Begründung erfassen.
- [ ] **Given** ich speichere eine Anpassung, **When** der Backend-Call erfolgreich ist, **Then** wird der Saldo des betroffenen Monats neu berechnet und ein Audit-Eintrag (`entity_changelog`) geschrieben.
- [ ] **Given** der Tenant hat das Feature `pep` nicht aktiviert, **When** ich `/personal/zeitkonten` öffne, **Then** redirected die Route auf das Dashboard.

## UI States

| State              | When?                                | Rendering                                                            | A11y                          |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------- | ----------------------------- |
| Loading            | Overview-Fetch in-flight             | Skeleton-Rows (8 Stück) in der Tabelle                               | `aria-busy="true"` auf Table |
| Populated          | Mindestens ein Eintrag               | `MatTable` + KPI-Karten oben                                         | Standard Mat-Table-A11y       |
| Empty              | Keine Mitarbeitenden im Tenant       | Icon `badge_off` + Text `personnel.zeitkonten.empty`                | —                             |
| Error              | Fetch-Fehler                         | Inline-Banner mit Retry-Button                                       | `role="alert"`                |
| No-Permission      | Permission `tenant.time_accounts.view` fehlt | Permission-Block-Screen (analog Administration)            | —                             |

## Flows

```
[User opens /personal/zeitkonten]
        │
        ▼
[List loads → KPIs + Table]
        │
        ├── [click row] ──► [Detail panel: 12-month history]
        │                        │
        │                        ▼
        │                  [click "Manuelle Anpassung"]
        │                        │
        │                        ▼
        │                  [Dialog: month + minutes + reason]
        │                        │
        │                        ▼
        │                  [POST adjustment → recalc → audit log]
        │
        └── [filter by Einrichtung] ──► [list re-fetches with institution_id param]
```

## Non-Goals

- **Schichtplanung** — siehe [personnel-schichten/](../personnel-schichten/spec.md)
- **Zeiterfassung / Clock-in/out** — siehe [personnel-zeiterfassung/](../personnel-zeiterfassung/spec.md)
- **Lohnabrechnung / Gehaltsnachweis** — eigene Domäne, nicht Teil dieses Specs
- **Verriegelung von Monaten** — Status wird angezeigt, Lock-Toggle bleibt im einrichtungs-scoped PEP
- **Automatische Anomalie-Erkennung** — nur Plus-/Minus-KPI in V1, keine Predictive-Alerts

## Edge Cases

- **Mitarbeitende ohne Vertrag** — werden ausgeblendet (kein Soll → kein sinnvoller Saldo)
- **Mitarbeitende mit mehreren Einrichtungs-Assignments** — primäre Einrichtung = oberste aktive Assignment-Zeile; bei Filter wird in *jeder* zugewiesenen Einrichtung sichtbar
- **Suspendierte Mitarbeitende** — standardmäßig ausgeblendet, Toggle "Inaktive einblenden"
- **Negative Saldos > 40h** — werden in der Tabelle rot eingefärbt + zählen in die KPI-Kachel "kritisch negativ"
- **Manuelle Anpassung in verriegeltem Monat** — Backend lehnt mit 409 ab, Frontend zeigt Hinweis "Monat ist verriegelt"

## Permissions & Tenant/Institution

- **Route guards:** `permissionGuard` + Feature-Gate `pep`
- **Required permissions (neu):**
  - `tenant.time_accounts.view` — Liste + Detail lesen
  - `tenant.time_accounts.adjust` — Manuelle Anpassung schreiben
- **Backend:** Wiederverwendung von `TimeAccountController` aus `apps/tagea-backend/src/workforce-planning/`. Neuer Endpoint für tenant-aggregierte Sicht (siehe contracts.md).
- **Tenant context:** Nimmt aktiven Tenant aus `UnifiedAuthService.activeTenantId()`. Kein institution_id-Param nötig — Filter via Query-String optional.
- **Audit:** Manuelle Anpassungen schreiben in `entity_changelog` mit `change_source=user`.

## Notifications

- Nicht push-relevant in V1.

## i18n Keys

Alle unter `personnel.zeitkonten.*`:

- `personnel.zeitkonten.title` — "Zeitkonten"
- `personnel.zeitkonten.subtitle`
- `personnel.zeitkonten.empty`
- `personnel.zeitkonten.column.{name,personnelNumber,institution,target,actual,difference,balance,status}`
- `personnel.zeitkonten.status.{locked,open}`
- `personnel.zeitkonten.kpi.{surplus,deficit,critical}`
- `personnel.zeitkonten.adjustment.{title,month,minutes,reason,save,cancel}`
- `personnel.zeitkonten.adjustment.error.locked`
- `personnel.zeitkonten.filter.{institution,includeInactive}`

## Offline Behavior

- ❌ P2 non-goal (Tagea-Flutter portiert keine HR-Surfaces)

## References

- **Existing backend (reuse):**
  - `apps/tagea-backend/src/workforce-planning/services/time-account.service.ts`
  - `apps/tagea-backend/src/workforce-planning/controllers/time-account.controller.ts`
  - Entity: `apps/tagea-backend/src/workforce-planning/entities/time-account-entry.entity.ts`
- **New backend artifacts:** see [contracts.md](./contracts.md)
- **Frontend route (to be added):** `apps/tagea-frontend/src/app/pages/personnel/personnel.routes.ts` → child `zeitkonten`
- **Related spec:** [pep/](../pep/spec.md) — einrichtungs-scoped Zeitkonten-View, gleiche Datengrundlage
