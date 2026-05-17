# Feature: Personnel — Schichtverwaltung (Roster)

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

Schichtplan-Roster unter `/personal/schichten`: HR-/Trägerverwaltung weist Mitarbeitende konkreten Schichten (aus existierenden Templates) an konkreten Datumsangaben zu. Kalender-View (Wochen-Default), Konflikterkennung (Doppelbesetzung, Vertragsverletzung), Status `draft → published → cancelled` mit Audit-Trail. V1 ohne Self-Service-Tausch oder Mitarbeiter-Wunschpläne.

## User Stories

- Als **HR-Trägerverwalter** möchte ich aus existierenden Schicht-Templates Mitarbeitende einem konkreten Tag und einer konkreten Einrichtung zuweisen, damit ein Wochenplan entsteht.
- Als **HR-Trägerverwalter** möchte ich einen Wochen-Kalender sehen, in dem Zeilen Mitarbeitende und Spalten die Wochentage sind, damit ich Lücken und Überbesetzungen sofort erkenne.
- Als **HR-Trägerverwalter** möchte ich Schicht-Zuweisungen per Drag & Drop verschieben oder löschen können, damit Korrekturen schnell gehen.
- Als **HR-Trägerverwalter** möchte ich Pläne erst als `draft` halten und dann gebündelt `published` setzen, damit Mitarbeitende nicht jeden Zwischenstand sehen.
- Als **HR-Trägerverwalter** möchte ich gewarnt werden, wenn eine Zuweisung mit einer existierenden Schicht überlappt oder die Vertragsarbeitszeit verletzt, damit ich nicht versehentlich Doppelbelegungen oder Stundenüberschreitungen plane.
- Als **Mitarbeitende** möchte ich meine geplanten Schichten der nächsten 14 Tage sehen, **sobald** sie `published` sind, damit ich meine Woche planen kann.

## Acceptance Criteria

- [ ] **Given** ich öffne `/personal/schichten`, **When** die Seite lädt, **Then** sehe ich einen Wochen-Kalender mit aktueller Woche, Mitarbeitende auf der Y-Achse, Wochentage auf der X-Achse.
- [ ] **Given** der Wochenplan ist sichtbar, **When** ich auf eine leere Zelle klicke, **Then** öffnet ein Inline-Dialog mit Template-Picker (Liste aller aktiven `shift_template` der Einrichtung).
- [ ] **Given** ich wähle ein Template, **When** ich "Speichern" klicke, **Then** entsteht ein `shift_assignment` mit Status `draft` und die Zelle wird visuell gefüllt.
- [ ] **Given** eine `draft`-Zuweisung ist sichtbar, **When** ich auf "Veröffentlichen" für die gesamte Woche klicke, **Then** wechseln alle `draft`-Einträge dieser Woche auf `published` und werden für Mitarbeitende sichtbar.
- [ ] **Given** ich versuche eine Zuweisung anzulegen, deren Zeitraum mit einer existierenden überlappt, **When** der Server validiert, **Then** kommt 409 `CONFLICT_OVERLAP` zurück und das Frontend zeigt einen Warn-Banner mit Option "Trotzdem speichern".
- [ ] **Given** die Wochenzeit der Zuweisung würde die im Vertrag festgelegte Wochen-Soll-Zeit überschreiten, **When** ich speichere, **Then** wird die Zuweisung gespeichert, aber ein Hinweis-Icon (orange) erscheint in der Zelle.
- [ ] **Given** ich rechtsklicke / ⋮-klicke eine Zuweisung, **When** ich "Stornieren" wähle, **Then** wechselt der Status auf `cancelled`, der Eintrag wird grau dargestellt, aber bleibt im Audit-Log.
- [ ] **Given** ich bin Mitarbeitende, **When** ich `/personal/meine-schichten` öffne, **Then** sehe ich nur meine `published`-Zuweisungen der nächsten 14 Tage in einer Listenansicht.
- [ ] **Given** der Tenant hat das Feature `pep` nicht aktiviert, **When** ich `/personal/schichten` öffne, **Then** redirected die Route auf das Personal-Dashboard.

## UI States

| State              | When?                                | Rendering                                                            | A11y                                 |
| ------------------ | ------------------------------------ | -------------------------------------------------------------------- | ------------------------------------ |
| Loading            | Wochen-Fetch in-flight               | Skeleton-Grid mit Spinner-Overlay                                    | `aria-busy="true"` am Grid          |
| Populated (planer) | Mind. ein Mitarbeitende sichtbar     | CSS-Grid Wochenraster, Zellen klickbar, Drag-Handle                  | Keyboard-Nav: arrows zwischen Zellen |
| Populated (employee) | Mitarbeiter-Ansicht                | Vertikale Liste je Tag (Datum, Schichtname, Start-Ende, Einrichtung) | `<ul role="list">`                  |
| Empty              | Keine Mitarbeitenden / keine Schichten | Icon `calendar_today` + CTA "Schicht-Template anlegen"             | —                                    |
| Conflict-Warning   | 409 vom Server                       | MatBanner über Grid, "Trotzdem speichern" + "Abbrechen"              | `role="alertdialog"`                |
| Error              | Fetch / Save fehlgeschlagen          | Snackbar mit Retry                                                   | `role="alert"`                       |

## Flows

```
[Planer öffnet /personal/schichten]
        │
        ▼
[Woche lädt → Grid rendert]
        │
        ├── [click leere Zelle] ──► [Template-Picker] ──► [Speichern]
        │                                                       │
        │                                ┌──────────────────────┤
        │                                │                      │
        │                          [HTTP 200]              [HTTP 409 CONFLICT_OVERLAP]
        │                                │                      │
        │                          [Zelle gefüllt,         [Banner "Trotzdem?"]
        │                           Status=draft]                │
        │                                                   [retry mit force=true]
        │
        ├── [drag Zuweisung auf andere Zelle] ──► [PATCH date+employee]
        │
        └── [click "Veröffentlichen"] ──► [bulk PATCH alle draft→published]
                                                  │
                                                  ▼
                                          [Push-Notification an betroffene MA]
```

## Non-Goals

- **Tauschbörse / Self-Service** — Mitarbeitende können in V1 keine Tauschanfragen stellen
- **Krankheits-Vertretung-Workflow** — manuelle Stornierung + Neuzuweisung in V1
- **Mitarbeiter-Wunschpläne** — keine Erfassung von Wunschtagen/-zeiten in V1
- **Automatische Schichtgenerierung** — kein Algorithmus, alles manuell
- **Schicht-Übergabe-Notizen** — kein Notiz-Feld pro Zuweisung (nur `notes` als Free-Text-Feld am Assignment)
- **Lohn-relevante Zuschläge** (Nacht/Sonntag/Feiertag) — gehört in eine spätere Payroll-Integration
- **Mobile Planungs-UI** — nur Read-only-Mitarbeiter-View auf Mobil; Planung Desktop-only

## Edge Cases

- **Mitarbeitende ohne Vertrag** — werden im Planer angezeigt, aber Wochen-Soll-Warning-Icon erscheint sofort
- **Schicht-Template wird gelöscht** — bestehende `shift_assignment`s bleiben (FK `ON DELETE RESTRICT`), Template-Name wird via JOIN gelesen
- **Mitarbeitende wird suspendiert** — alle zukünftigen `published` Assignments wechseln auf `cancelled` (Trigger), Audit-Log notiert `cancellation_reason='employee_suspended'`
- **Drag über Wochengrenze** — Drag-Source und Drop-Target müssen in derselben Woche sein; Cross-Wochen-Drag öffnet stattdessen ein Confirm-Dialog
- **Tageswechsel über Mitternacht** — `shift_template.end_time < start_time` ⇒ Assignment endet logisch am Folgetag, zählt aber für das `date`-Feld des Start-Tages
- **Konflikt mit Termin (Appointment)** — V1 ignoriert Termine; nur Schicht-Schicht-Overlap wird geprüft

## Permissions & Tenant/Institution

- **Route guards:** `permissionGuard` + Feature-Gate `pep`
- **Required permissions (neu):**
  - `tenant.shifts.view` — Roster lesen (alle Mitarbeitenden, alle Einrichtungen)
  - `tenant.shifts.plan` — Erstellen/Editieren/Stornieren/Publishen
  - `tenant.shifts.view_own` — Mitarbeiter-Eigensicht `/personal/meine-schichten` (default für alle Employees)
- **Backend:** Neuer Endpoint-Stack unter `apps/tagea-backend/src/workforce-planning/shift-planning/` (Controller, Service, Entity, Migration). Existierende `shift_template` + `working-hours` werden weiter genutzt.
- **Audit:** Jede Statusänderung (`draft→published`, `*→cancelled`) schreibt in `entity_changelog` mit `change_source=user`.

## Notifications

- **Trigger:** `draft → published` für betroffene Mitarbeitende
- **Notification type:** `SHIFT_ASSIGNMENT_PUBLISHED` (neu)
- **Deep link:** `/personal/meine-schichten`
- **Dismiss:** Auto-dismiss nach Tap, keine Reminder

## i18n Keys

Alle unter `personnel.schichten.*`:

- `personnel.schichten.{title,subtitle,empty}`
- `personnel.schichten.weekNav.{prev,next,today}`
- `personnel.schichten.cell.{add,template,save,cancel}`
- `personnel.schichten.status.{draft,published,cancelled}`
- `personnel.schichten.action.{publish,publishAll,cancel,reassign}`
- `personnel.schichten.conflict.{overlap,contractExceeded,saveAnyway}`
- `personnel.schichten.employee.{title,nextShifts,noShifts}`
- `personnel.schichten.template.{title,manageButton}`

## Offline Behavior

- ❌ P2 non-goal

## References

- **Existing backend (reuse):**
  - `apps/tagea-backend/src/working-hours/working-hours.service.ts` (shift template CRUD)
  - Entity: `apps/tagea-backend/src/working-hours/entities/shift-template.entity.ts`
- **New backend artifacts:** see [contracts.md](./contracts.md)
- **Frontend route (to be added):** `apps/tagea-frontend/src/app/pages/personnel/personnel.routes.ts` → child `schichten` + `meine-schichten`
- **Related spec:** [personnel-zeitkonten/](../personnel-zeitkonten/spec.md), [personnel-zeiterfassung/](../personnel-zeiterfassung/spec.md)
