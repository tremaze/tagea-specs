# Feature: Personnel — Zeiterfassung (tenant-wide + Korrektur-Workflow)

> **Status:** ⏳ Planned
> **Owner:** baumgart
> **Last updated:** 2026-05-16

## Vision (Elevator Pitch)

Tenant-weite HR-Sicht aller Zeiterfassungs-Einträge unter `/personal/zeiterfassung` + Korrektur-Genehmigungsschleife. Aggregiert die existierenden `tracked_time` + `time_tracking_entry` Daten zu einer Trägerübersicht, mit Drill-down pro Mitarbeitende und Tag, plus einer Approval-Queue für Mitarbeitende-Korrekturanfragen (heute hat das Modul nur per-employee endpoints, keine Korrektur-Schleife).

## User Stories

- Als **HR-Trägerverwalter** möchte ich alle Zeiterfassungs-Einträge meines Trägers in einer filterbaren Tabelle sehen (Tag/Woche/Monat, pro Einrichtung, pro Mitarbeitende), damit ich Unstimmigkeiten erkenne.
- Als **HR-Trägerverwalter** möchte ich Vivendi-Sync-Status pro Eintrag sehen, damit ich weiß, ob die Synchronisierung erfolgreich war.
- Als **Mitarbeitende** möchte ich für einen vergangenen `tracked_time`-Eintrag eine Korrektur anfragen (Kommen/Gehen/Pause/Notiz), damit Vergessenes nachgereicht wird.
- Als **HR-Trägerverwalter** möchte ich offene Korrekturanfragen in einer Queue sehen, jeweils mit Original- und Vorschlagswerten + Begründung, damit ich entscheiden kann.
- Als **HR-Trägerverwalter** möchte ich eine Anfrage genehmigen oder ablehnen mit eigener Begründung, damit der Mitarbeitende den Ausgang nachvollziehen kann.

## Acceptance Criteria

- [ ] **Given** ich öffne `/personal/zeiterfassung`, **When** die Seite lädt, **Then** sehe ich eine Tabelle aller `tracked_time`-Einträge des aktuellen Tages mit Spalten: Mitarbeitende, Einrichtung, Kommen, Gehen, Pause (min), Gesamt (h), Vivendi-Status.
- [ ] **Given** die Tabelle ist sichtbar, **When** ich den Zeitraum auf "Diese Woche" oder "Monat" wechsle, **Then** wird mit dem neuen `from`/`to`-Range neu geladen.
- [ ] **Given** ich klicke eine Zeile, **When** der Detailbereich öffnet, **Then** sehe ich alle `time_tracking_entry`-Sub-Einträge (Kommen/Gehen-Paare) chronologisch sortiert, plus Notizen-Feld.
- [ ] **Given** ich bin Mitarbeitende und sehe einen Eintrag der letzten 14 Tage, **When** ich "Korrektur anfragen" klicke, **Then** öffnet ein Dialog mit den Original-Werten als Defaults und ich kann sie ändern + Begründung erfassen.
- [ ] **Given** ich speichere die Anfrage, **When** der Server validiert (Anfrage < 14 Tage alt, Eintrag nicht verriegelt), **Then** wird ein `time_correction_request` mit Status `pending` angelegt.
- [ ] **Given** ich bin HR und öffne `/personal/zeiterfassung/genehmigungen`, **When** die Queue lädt, **Then** sehe ich alle `pending` Korrekturanfragen, sortiert nach Eingangsdatum (ältest zuerst).
- [ ] **Given** ich genehmige eine Anfrage, **When** ich speichere, **Then** wird der `tracked_time`-Eintrag mit den Vorschlagswerten überschrieben (Audit-Log), die Anfrage wechselt auf `approved`, und der Mitarbeitende bekommt eine Push-Benachrichtigung.
- [ ] **Given** ich lehne eine Anfrage ab, **When** ich eine Begründung erfasse und speichere, **Then** wechselt sie auf `rejected`, der Original-Eintrag bleibt unverändert, Push-Benachrichtigung mit Begründung geht raus.
- [ ] **Given** der Tenant hat das Feature `pep` nicht aktiviert, **When** ich `/personal/zeiterfassung` öffne, **Then** redirected die Route auf das Personal-Dashboard.

## UI States

| State                | When?                                | Rendering                                                                            | A11y                          |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------- |
| Loading              | Range-Fetch in-flight                | Skeleton-Rows                                                                        | `aria-busy="true"`           |
| Populated            | Einträge vorhanden                   | MatTable + Top-Filter-Bar (Datum-Range, Einrichtung, Mitarbeitende-Suche, Status)    | Standard                      |
| Empty                | Keine Einträge im Range              | Icon `event_busy` + Text `personnel.zeiterfassung.empty`                            | —                             |
| Korrekturanfrage     | Mitarbeitende-Self-Service-Dialog    | Form: Original-Spalte (read-only) + Vorschlag-Spalte (editierbar) + Begründung      | `<fieldset><legend>`         |
| Queue (HR)           | `/zeiterfassung/genehmigungen`       | Karten-Liste, jede Karte: Mitarbeitende, Datum, Diff-Tabelle, Begründung, Buttons    | `<ul role="list">`           |
| Vivendi-Sync-Fehler  | `vivendi_status='error'`             | Rote Badge in der Zelle + Tooltip mit Fehlertext                                     | `aria-label` mit Fehlertext  |
| Error                | Fetch / Save fehlgeschlagen          | Snackbar mit Retry                                                                   | `role="alert"`               |

## Flows

```
[HR opens /personal/zeiterfassung]
        │
        ▼
[Range default: today; table loads]
        │
        ├── [row click] ──► [Detail: sub-entries + notes]
        │
        └── [filter switch] ──► [re-fetch with new range/scope]

[Mitarbeitende opens /personal/meine-zeiten]   ← separate route, employee view
        │
        ▼
[Letzte 14 Tage Liste]
        │
        └── [click "Korrektur anfragen"]
                │
                ▼
        [Dialog: Original vs. Vorschlag + Begründung]
                │
                ▼
        [POST correction_request, status='pending']

[HR opens /personal/zeiterfassung/genehmigungen]
        │
        ▼
[Pending-Queue (älteste oben)]
        │
        ├── [approve] ──► [PATCH tracked_time + status='approved' + notify]
        │
        └── [reject  ] ──► [status='rejected' + reason + notify]
```

## Non-Goals

- **Native Clock-in/out-UI in V1** — Mitarbeitende stempeln weiterhin über die existierende (Vivendi-)Schnittstelle oder via Mobile-App. `/personal/zeiterfassung` ist HR-Read-Surface + Korrektur-Approval, kein Self-Service-Stempel
- **Automatische Anomalie-Erkennung** — keine Alerts für ungewöhnlich lange/kurze Tage in V1
- **Excel-Export der Tabelle** — separat, nicht Teil dieses Specs
- **Bulk-Approval** der Queue — Approval/Reject ist immer per Anfrage einzeln
- **Korrektur älter als 14 Tage** — wird vom Backend hart abgelehnt
- **Korrektur durch HR direkt** (ohne Mitarbeiter-Anfrage) — V1 läuft alles über die Queue; direkter HR-Override wäre V2

## Edge Cases

- **Eintrag in verriegeltem Monat** — Korrekturanfrage wird mit 409 `MONTH_LOCKED` abgelehnt
- **Mehrere offene Korrekturanfragen für denselben Eintrag** — erlaubt; jede gilt separat, älteste zuerst in Queue
- **Vivendi-Sync läuft parallel zur Genehmigung** — Korrektur-PATCH schreibt `vivendi_adopted=false` zurück, Sync übernimmt die Korrektur beim nächsten Lauf
- **Mitarbeitende ohne `tenant.time_tracking.request_correction`-Permission** — sieht `/personal/meine-zeiten` als reine Read-only-Liste, ohne "Korrektur anfragen"-Button
- **Approver = Antragsteller** — Backend blockt mit 403 `SELF_APPROVAL_FORBIDDEN`

## Permissions & Tenant/Institution

- **Route guards:** `permissionGuard` + Feature-Gate `pep` *(Vorschlag: heute ist Zeiterfassung unflagged, mit diesem Spec ziehen wir es unter pep)*
- **Required permissions (neu):**
  - `tenant.time_tracking.view` — Tenant-weite Tabelle lesen
  - `tenant.time_tracking.approve` — Korrekturanfragen genehmigen/ablehnen
  - `tenant.time_tracking.request_correction` — eigene Korrektur anfragen (default: alle Employees)
- **Backend:** Wiederverwendung von `TimeTrackingService` + neue `TimeCorrectionRequestService` und Tabelle. Existierende `tracked_time`/`time_tracking_entry` bleiben unverändert.
- **Audit:** `PATCH /tracked_time` durch Approval schreibt in `entity_changelog` mit `change_source=user` und `metadata` = Korrekturanfrage-ID. Approval/Reject selbst landet ebenfalls im Changelog.

## Notifications

- **`TIME_CORRECTION_APPROVED`** — Push + In-App an Antragsteller; Deep-Link auf `/personal/meine-zeiten`
- **`TIME_CORRECTION_REJECTED`** — Push + In-App an Antragsteller mit Begründungstext; Deep-Link gleicher
- **`TIME_CORRECTION_REQUESTED`** — In-App an alle User mit `tenant.time_tracking.approve`-Permission im selben Tenant (kein Push, um Noise zu vermeiden)

## i18n Keys

Alle unter `personnel.zeiterfassung.*`:

- `personnel.zeiterfassung.{title,subtitle,empty}`
- `personnel.zeiterfassung.column.{employee,institution,kommen,gehen,break,total,vivendi}`
- `personnel.zeiterfassung.filter.{range,institution,employee,status}`
- `personnel.zeiterfassung.range.{today,week,month,custom}`
- `personnel.zeiterfassung.vivendi.{synced,pending,error}`
- `personnel.zeiterfassung.correction.{title,original,proposal,reason,save,cancel}`
- `personnel.zeiterfassung.correction.error.{tooOld,monthLocked}`
- `personnel.zeiterfassung.queue.{title,empty,approve,reject,rejectionReason}`
- `personnel.meine_zeiten.{title,requestCorrection,notAllowed}`

## Offline Behavior

- ❌ P2 non-goal

## References

- **Existing backend (reuse):**
  - `apps/tagea-backend/src/time-tracking/time-tracking.service.ts`
  - Entities: `apps/tagea-backend/src/time-tracking/entities/{tracked-time,time-tracking-entry}.entity.ts`
- **New backend artifacts:** see [contracts.md](./contracts.md)
- **Frontend routes (to be added):**
  - `/personal/zeiterfassung` (HR-Tabelle)
  - `/personal/zeiterfassung/genehmigungen` (Approval-Queue)
  - `/personal/meine-zeiten` (Employee-Sicht + Korrekturanfrage)
- **Related spec:** [personnel-zeitkonten/](../personnel-zeitkonten/spec.md), [personnel-schichten/](../personnel-schichten/spec.md)
