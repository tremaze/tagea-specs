# Feature: Teamspace-Booking v2

> **Status:** ⏳ Spec drafted — D1–D9 decided 2026-05-22, awaiting implementation
> **Owner:** baumgart
> **Last updated:** 2026-05-22
> **Supersedes:** existing `apps/tagea-frontend/src/app/admin/components/teamspace-booking-categories-admin/` + backend modules `teamspace-availability` + parts of `teamspaces/services/teamspace-booking-categories.service.ts`

## Vision (Elevator Pitch)

Mitarbeiter:innen sollen Verfügbarkeiten so anlegen können, wie sie sie im Kopf haben: **mehrere Zeitblöcke pro Tag** (z.B. Mo 09–12 und 14–17), **mehrere Anbieter pro Verfügbarkeit** (Round-Robin verteilt Buchungen automatisch), und alles in einer **Master-Detail-Oberfläche mit Auto-Save** statt klickintensiver Dialoge. Buchungs-Konfiguration wird gleichzeitig als eigenes Backend-Modul aus dem überladenen `AppointmentsService` herausgelöst — sauber testbar, klar verantwortlich.

## Three Concepts (in einfachen Worten)

Das gesamte Feature dreht sich um drei Konzepte, die strikt getrennt sind:

- **Verfügbarkeit (`AvailabilityWindow`)** = eine **Regel**. "Donnerstag 10–12 und 14–17 stehen Anna und Bert für HR-Gespräche zur Verfügung." Sie existiert als Datenbank-Eintrag. Sie ist **kein Termin**.
- **Slot (`AvailableSlot`)** = ein **berechneter Vorschlag**. Wird zur Laufzeit erzeugt, wenn jemand "buchen" anklickt. Existiert **nirgendwo in der DB**. Aus einer Verfügbarkeit + Kategorie-Dauer + Puffer + bereits gebuchten Terminen entstehen konkrete Zeitfenster ("Do 14:30").
- **Termin (`Appointment`)** = der **gebuchte Eintrag**. Wird durch die Buchungs-Aktion erzeugt. Hat einen konkreten Anbieter (durch Round-Robin ausgewählt), eine konkrete Zeit, lebt seinen eigenen Lifecycle (Storno, Verschieben, Erinnerungen). Ist **nach der Erstellung von der Verfügbarkeit losgelöst** — die Verfügbarkeit kann sich ändern, der Termin bleibt.

Diese Trennung ist load-bearing. Wer "Slots speichern" möchte (häufiger Anfänger-Fehler), bricht das System: Regel-Änderungen müssten alle zukünftigen Slot-Vorschläge re-generieren. Slot-Generierung **on-the-fly** ist die einzige konsistente Variante.

## User Stories

### Teamspace-Admin (`ts.bookings.manage`)

- Als **Teamspace-Admin** will ich eine Verfügbarkeit anlegen mit **mehreren Zeitblöcken pro Wochentag** (Mo 09–12 und 14–17), damit ich Mittagspausen sauber abbilden kann ohne zwei separate Verfügbarkeiten zu verwalten.
- Als **Teamspace-Admin** will ich **mehrere Mitarbeitende** in einer Verfügbarkeit hinterlegen, damit Buchungen automatisch im **Round-Robin** verteilt werden und kein:e Mitarbeiter:in einseitig belastet wird.
- Als **Teamspace-Admin** will ich eine Verfügbarkeit auf bestimmte **Buchungs-Kategorien** beschränken können (oder offen für alle lassen), damit z.B. HR-Sprechstunden nicht für IT-Termine missbraucht werden.
- Als **Teamspace-Admin** will ich **Puffer** vor/nach Terminen und eine **Mindest-Vorlaufzeit** definieren, damit ich nicht ohne Vorbereitung in Termine geworfen werde.
- Als **Teamspace-Admin** möchte ich, dass **Mitarbeiter-Abwesenheiten** (Urlaub, Krankheit aus dem bestehenden `AbsencePeriod`-System) und **gesetzliche Feiertage** (`PublicHoliday`, nach Bundesland der Institution) automatisch berücksichtigt werden — ohne dass ich Sperrzeiten separat anlegen muss.
- Als **Teamspace-Admin** will ich die UI mit **Auto-Save** bedienen, damit ich beim Editieren nicht permanent "Speichern" klicken muss.
- Als **Teamspace-Admin** will ich eine Verfügbarkeit per "Vorschau"-Button checken können, bevor ich sie "Veröffentliche" — damit ich keine halb-fertigen Slots live habe.

### Mitarbeitende (kein Permission-Bit nötig)

- Als **Mitarbeitende:r** will ich beim Termin-Anlegen einen Slot-Picker sehen, der zeigt: "An welchem Tag/zur welcher Uhrzeit kann ich für Kategorie X bei Teamspace Y buchen?" — basierend auf den hinterlegten Verfügbarkeiten.
- Als **Mitarbeitende:r** will ich beim Anlegen einen Termin direkt erstellen können, ohne dass ich wissen muss, welcher der drei verfügbaren Kolleg:innen "dran" ist — Round-Robin macht das im Hintergrund.

### Tenant-Admin / Träger-Manager

- Als **Tenant-Admin** will ich Verfügbarkeiten und Kategorien aller Teamspaces meines Tenants verwalten können, ohne separate Permission-Bits zu sammeln (Elevation via `isAdminElevated()`).

### Future / Open Decision — Self-Service (siehe D4)

- _(Optional)_ Als **Mitarbeitende:r** will ich meine eigenen Verfügbarkeiten anlegen/ändern können, ohne den Admin zu fragen.

## Decisions (D1–D9 entschieden 2026-05-22)

| ID | Topic | Decision | Begründung |
|---|---|---|---|
| **D1** | Multi-Block-Modell | ✅ **Eigene Tabelle `availability_blocks`** (1:N zur Window) | DB-Constraints (kein Overlap pro Window+Day) + Indizes für schnelle Slot-Generierung |
| **D2** | Multi-Employee-Modell | ✅ **Join-Table `availability_employees`** mit `last_booked_at` pro Anbieter | Round-Robin braucht atomares UPDATE pro Anbieter; JSONB wäre race-anfällig |
| **D3** | Draft/Published-Lifecycle | ✅ **Nur `is_active`** — Schema-einfach | Auto-Save schreibt Felder, "Veröffentlichen"-Button setzt `is_active=true`. Funktional identisch zu Draft/Published bei halber Komplexität |
| **D4** | Self-Service-Verfügbarkeiten | ✅ **Bleibt Admin-only** für v2 | Kein User-Wunsch dokumentiert. Falls später nötig: separates Feature mit `ts.bookings.manage_own` |
| **D5** | Custom-Fields-Scope-Asymmetrie | ✅ **Beides teamspace-scope** migrieren | Passt zum Two-Scope-Modell (Submissions-Cut 2026-05-04 als Blaupause). Permission-Migration nötig |
| **D6** | Round-Robin-Algorithmus | ✅ **Least-recently-booked** | Einfach erklärbar, deterministisch, trivial testbar. (b) und (c) als v3-Erweiterung möglich |
| **D7** | Sperrzeiten-Modell | ✅ **Existierende Strukturen integrieren** — KEINE neue Tabelle | `AbsencePeriod` (per Mitarbeiter, mit Vivendi-Sync) und `PublicHoliday` (Meta-DB, mit Bundesland-Targeting) existieren bereits aber werden vom Slot-Generator heute ignoriert. Integration statt Reinvent. |
| **D8** | Modul-Auszug aus `AppointmentsService` | ✅ **Neues Modul `teamspace-booking`** | ~700 Zeilen werden aus `appointments.service.ts:7416–8120` herausgeschält; Booking ist eigener Lifecycle (Regel → Slot → Termin) |
| **D9** | Mobile-App-Legacy-DTO | ✅ **Hard Cut, KEIN Legacy-Wrapper** | Feature nicht in Produktion genutzt — kein App-Lag-Risiko. Spart Wrapper-Code, kein Sunset-Eintrag nötig |

## Acceptance Criteria

> Given/When/Then — observable behavior, plattform-agnostisch.

### Verfügbarkeit anlegen (Admin)

- [ ] **Given** Teamspace-Admin öffnet `/teamspace/terminbuchungen/konfiguration`, **When** die Seite lädt, **Then** sieht sie eine Master-Detail-UI mit Karten links (Verfügbarkeiten) und Editor rechts.
- [ ] **Given** die Liste ist leer, **When** die Seite lädt, **Then** wird der Onboarding-Empty-State mit drei Startpunkten gezeigt: "Von Null", "Aus Vorlage", "Aus bestehender kopieren".
- [ ] **Given** Admin klickt "Neue Verfügbarkeit", **When** der Editor öffnet, **Then** ist eine leere Verfügbarkeit im Draft-State (`is_active=false`) im Backend erzeugt und im Editor offen.
- [ ] **Given** Admin füllt Name, Teamspace, ≥1 Mitarbeiter:in, ≥1 Wochentag mit ≥1 Block aus, **When** Auto-Save feuert (Debounce 800ms), **Then** wird die Verfügbarkeit gespeichert ohne explizites Klicken.
- [ ] **Given** Admin klickt "Veröffentlichen", **When** Validierung erfolgreich, **Then** wird `is_active=true` gesetzt und die Verfügbarkeit ist ab sofort buchbar.
- [ ] **Given** Admin fügt für Mo zwei Zeitblöcke an (09–12 und 14–17), **When** gespeichert, **Then** sind beide Blöcke als eigene Rows in `availability_blocks` persistiert.

### Multi-Employee + Round-Robin

- [ ] **Given** Verfügbarkeit hat 3 Mitarbeitende A/B/C, **When** Klient:in bucht Slot Do 14:30, **Then** wird der/die Mitarbeitende mit ältestem `last_booked_at` ausgewählt (initial: alphabetisch erster).
- [ ] **Given** Mitarbeiter A war zuletzt dran, **When** ein neuer Slot gebucht wird, **Then** wird B (oder C) zugewiesen, und A's `last_booked_at` bleibt unverändert.
- [ ] **Given** zwei Klient:innen buchen exakt denselben Slot Do 14:30 in derselben Millisekunde, **When** beide Requests durchlaufen, **Then** bekommt der/die Erste den Slot + zugeordneten Anbieter, der/die Zweite erhält 409 Conflict — **keine** Doppelbuchung.
- [ ] **Given** Mitarbeiter:in B ist beim Buchen nicht mehr Teamspace-Mitglied (zwischenzeitlich entfernt), **When** Round-Robin B wählen würde, **Then** wird B übersprungen, nächste:r in der Liste wird gewählt.

### Slot-Generierung (Read-Path)

- [ ] **Given** Verfügbarkeit Mo 09–12, Kategorie 30min, Puffer 10min, **When** Slot-Endpoint aufgerufen wird, **Then** zurück kommen Slots `[09:00, 09:40, 10:20, 11:00]` (12:00 wäre über Ende).
- [ ] **Given** Termin Mo 09:30 existiert bereits, **When** Slot-Endpoint aufgerufen wird, **Then** wird Slot `09:00` zurückgegeben (`09:00`-Block-mit-Termin-um-09:30 erlaubt, weil `09:00+30=09:30=Termin-Start` — hier KOLLISION → Slot raus). Slot `10:20` weiterhin verfügbar.
- [ ] **Given** Verfügbarkeit hat Multi-Block Mo 09–12 + 14–17, **When** Slot-Endpoint, **Then** Slots aus beiden Blöcken werden zurückgegeben (keine 12:00–14:00-Slots).
- [ ] **Given** Mitarbeiter A hat `AbsencePeriod 2026-06-01 bis 2026-06-15` (Urlaub), **When** Slot-Endpoint für diesen Zeitraum aufgerufen wird, **Then** wird A in `availableEmployeeIds` der Slots nicht aufgeführt. Wenn A der einzige Anbieter war: Slot fällt komplett raus.
- [ ] **Given** `PublicHoliday 2026-12-25` (bundesweit), **When** Slot-Endpoint für 2026-12-25 aufgerufen wird, **Then** kommen für diesen Tag keine Slots zurück — unabhängig von der Verfügbarkeit.
- [ ] **Given** `PublicHoliday 2026-08-15` (`Mariä Himmelfahrt`, nur Bayern und Saarland), **When** Institution in NRW liegt, **Then** Slots werden normal generiert. **When** Institution in Bayern liegt, **Then** kein Slot.

### Kategorien (Konfiguration)

- [ ] **Given** Admin öffnet Tab "Buchungskategorien", **When** Liste lädt, **Then** Card-Grid mit allen aktiven Kategorien des Teamspaces, ergänzt um Warn-Banner "X Kategorien haben keine Verfügbarkeit zugeordnet".
- [ ] **Given** Admin klickt eine Kategorie, **When** Detail-View öffnet, **Then** wird die Beziehung Kategorie ↔ deckende Verfügbarkeiten ↔ teilnehmende Mitarbeitende visualisiert.
- [ ] **Given** Kategorie "X" hat keine Verfügbarkeit, **When** ein:e Mitarbeiter:in versucht für "X" zu buchen, **Then** kommt der Slot-Endpoint mit leerer Liste zurück und das Frontend zeigt "Keine Slots verfügbar".

### Permission Gating

- [ ] **Given** User hat **kein** `ts.bookings.manage`, **When** sie `/teamspace/terminbuchungen/konfiguration` öffnet, **Then** Redirect via `requirePermission`-Guard.
- [ ] **Given** User hat `ts.bookings.manage` in Teamspace A, aber nicht in B, **When** sie eine Verfügbarkeit für Teamspace B per API anlegt, **Then** Backend 403.
- [ ] **Given** User ist Tenant-Admin (`is_tenant_admin=true`), **When** sie eine Verfügbarkeit in beliebigem Teamspace anlegt, **Then** Resolver-Bypass — 200.

### Hard-Cut-Migration

- [ ] **Given** Pre-Cut existiert eine bestehende Verfügbarkeit (singular `employee_id`, singular `time_start`/`time_end`), **When** Migration läuft, **Then** wird genau **1 Block** in `availability_blocks` + **1 Eintrag** in `availability_employees` mit `last_booked_at=NULL` erzeugt.
- [ ] **Given** Pre-Cut Termin mit `booking_category_id` existiert, **When** Migration läuft, **Then** bleibt die FK-Referenz intakt — Listings (`appointments.controller.ts:725-790`) zeigen weiter korrekte Kategorien.
- [ ] **Given** Cutover-Tag wird ausgeliefert, **When** ein alter Client (Web oder Mobile) das alte DTO-Shape gegen die neuen Endpoints sendet, **Then** 400 — Feature war pre-cut nicht in Produktion, kein Backward-Compat nötig (D9: Hard Cut, kein Wrapper).

## UI States

### Konfigurations-Seite (Master-Detail)

| State | When? | What does the user see? | A11y |
|---|---|---|---|
| Loading | Initial fetch | Spinner über Master-Detail-Shell | aria-busy="true" |
| Empty (Onboarding) | Kein Window im Teamspace | Empty-State mit 3 Startpunkten (Von Null / Vorlage / Kopieren) | H1 mit "Beginne mit deiner ersten Verfügbarkeit" |
| Populated, kein Window selektiert | Cards links, leerer Editor rechts | Hinweis "Wähle eine Verfügbarkeit oder lege eine neue an" | Focus auf erstem Card-Item |
| Populated, Window selektiert | Cards links (eines highlighted), Editor rechts | Editor mit Sections "Wer & wofür" / "Wochenplan" / "Erweitert" | Focus-Trap im Editor wenn keyboard-navigated |
| Saving (auto) | Beim Auto-Save in flight | Footer-Indicator "Wird gespeichert…" | aria-live polite |
| Saved | Letzter Save erfolgreich | Footer-Indicator "Änderungen automatisch gespeichert" mit Cloud-Done-Icon | aria-live polite |
| Save Error | Backend 4xx/5xx | Footer-Indicator rot mit Retry-Action | aria-live assertive, Toast |
| Validation Error | Form invalid (z.B. time_end ≤ time_start) | Inline-Error am Feld, Auto-Save pausiert | aria-invalid am Feld |
| Draft (nicht veröffentlicht) | `is_active=false` | Status-Pill "DRAFT" gelb, "Veröffentlichen"-Button im Footer | aria-label "Verfügbarkeit ist nicht veröffentlicht und nicht buchbar" |
| Published | `is_active=true` | Status-Pill "AKTIV" grün, Button-Text "Aktualisieren" | aria-label "Verfügbarkeit ist aktiv und buchbar" |

### Kategorien-Tab

| State | When? | What does the user see? | A11y |
|---|---|---|---|
| Empty | Keine Kategorien | Empty-State + "Erste Kategorie anlegen" CTA | H2 |
| Populated | ≥1 Kategorie | Card-Grid; Warn-Banner falls ≥1 Kategorie ohne Verfügbarkeit | Banner mit role="alert" |
| Detail-View | User klickt Kategorie | Coverage-Visualisierung: Kategorie ↔ N Verfügbarkeiten ↔ M Mitarbeitende | Breadcrumb-Nav |
| Edit Form | Neue/Bearbeiten | Standard-Felder + Custom-Fields-Tabs | aria-label am Form |

### Slot-Picker (Read-Path beim Buchen)

| State | When? | What does the user see? |
|---|---|---|
| Loading | Slot-Endpoint in flight | Skeleton-Days mit Pulsing |
| Empty | Keine Slots in nächsten 14 Tagen | "Keine freien Termine — bitte kontaktiere uns direkt" |
| Populated | Slots vorhanden | Tag-Spalten mit Click-baren Time-Chips |
| Conflict | Beim Buchen war Slot inzwischen weg | Toast "Slot bereits vergeben, bitte anderen wählen" + Refresh |

## Flows

### Slot-Generierung (Read)

```
GET /teamspace-booking/slots?teamspaceId=X&categoryId=Y&from=2026-05-22&to=2026-06-05
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ SlotGeneratorService.generateSlots()    │
        │                                         │
        │  1. Lade Verfügbarkeiten für TS+Cat     │
        │     (is_active=true, nicht expired)     │
        │  2. Lade PublicHolidays für Bundesland  │
        │     der Institution + Datums-Range      │
        │  3. Lade AbsencePeriods für alle        │
        │     teilnehmenden Anbieter im Range     │
        │  4. Pro Tag im Bereich:                 │
        │     - Wenn PublicHoliday → skip Tag     │
        │     - Pro Window: pro Block: erzeuge    │
        │       Slot-Kandidaten (Dauer + Puffer)  │
        │     - Filter: Vorlaufzeit               │
        │  5. Pro Slot: ermittle teilnehmende     │
        │     Anbieter; filter raus:              │
        │     - Anbieter mit AbsencePeriod        │
        │       überlappend diesem Tag            │
        │     - Anbieter mit bestehendem Termin   │
        │       überlappend slot.start..slot.end  │
        │  6. Wenn ≥1 Anbieter übrig → Slot       │
        │     bleibt; wenn keiner → Slot raus     │
        └─────────────────────────────────────────┘
                              │
                              ▼
        Response: [{ start, end, durationMinutes,
                     availabilityWindowId,
                     availableEmployeeIds[] }, ...]
```

### Buchung (Write — kritischer Pfad)

```
POST /teamspace-booking { teamspaceId, categoryId, slotStart, slotEnd, providerEmployeeId? }
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ TeamspaceBookingService.createBooking() │
        │                                         │
        │ BEGIN TRANSACTION                       │
        │  1. SELECT FOR UPDATE auf Window        │
        │  2. Re-Generate Slots für den Tag,      │
        │     prüfe ob slotStart noch frei        │
        │  3. Wenn nicht frei → ROLLBACK + 409    │
        │  4. Wenn providerEmployeeId gesetzt:    │
        │     prüfe ob in availability_employees, │
        │     sonst 400                           │
        │     Wenn null: Round-Robin auswählen    │
        │     (RoundRobinSelectorService)         │
        │  5. INSERT INTO appointments (…)        │
        │     mit assigned_to_employee_id =       │
        │     ausgewählter Anbieter               │
        │  6. UPDATE availability_employees       │
        │     SET last_booked_at = NOW()          │
        │     WHERE employee_id = ausgewählt      │
        │  7. Notify Provider (Email + In-App)    │
        │ COMMIT                                  │
        └─────────────────────────────────────────┘
                              │
                              ▼
        Response: { appointmentId, providerEmployeeId, ... }
```

### Round-Robin-Auswahl

```
Input: availabilityWindowId, slotStart, slotEnd

  1. SELECT employee_id, last_booked_at
     FROM availability_employees
     WHERE availability_window_id = ?
     ORDER BY last_booked_at ASC NULLS FIRST, employee_id ASC
  2. Für jeden Kandidaten in Reihenfolge:
       - Ist Employee noch Teamspace-Mitglied? (sonst skip)
       - Hat Employee AbsencePeriod überlappend slotStart..slotEnd? (sonst skip)
       - Hat Employee einen Termin überlappend slotStart..slotEnd? (sonst skip)
       - Found → return employee_id
  3. Kein Kandidat → 409 Conflict
```

## Architecture (Module Split)

Hard Cut nutzt die Gelegenheit, das Booking-Konzept aus `AppointmentsService` herauszuschälen. Neue Struktur (per **D8**):

```
apps/tagea-backend/src/teamspace-booking/
├── teamspace-booking.module.ts
├── services/
│   ├── teamspace-booking.service.ts             ← orchestriert createBooking()
│   ├── slot-generator.service.ts                ← Slot-Berechnung (pure, testbar)
│   ├── round-robin-selector.service.ts          ← Anbieter-Auswahl (pure, testbar)
│   ├── availability.service.ts                  ← Window/Block-CRUD (ehem. teamspace-availability)
│   ├── booking-categories.service.ts            ← Category-CRUD (ehem. teamspaces/services/)
│   ├── booking-custom-fields.service.ts         ← Custom-Fields-Wrapper (verschoben)
│   └── booking-validation.service.ts            ← validateNoOverlap, validateTimeRange, etc.
├── controllers/
│   ├── teamspace-booking.controller.ts          ← /teamspace-booking/* (intern, ehem. /appointments/teamspace-booking)
│   ├── teamspace-booking-admin.controller.ts    ← /teamspaces/:id/booking-config/* (Admin-CRUD)
│   └── teamspace-booking-public-config.controller.ts ← Read-only "welche Kategorien/Slots gibt's?" für interne Mitarbeiter
├── entities/
│   ├── availability-window.entity.ts
│   ├── availability-block.entity.ts             ← NEU (D1)
│   ├── availability-employee.entity.ts          ← NEU (D2)
│   └── booking-category.entity.ts               ← verschoben
└── dto/
    └── …

# D7-Integration (KEINE neuen Entities):
#   SlotGeneratorService injiziert AbsencePeriodRepository
#   (apps/tagea-backend/src/working-hours/) und
#   PublicHolidayService (apps/tagea-backend/src/public-holidays/)
#   → reine Reuse-Beziehung, keine neue Tabelle, keine Migration
```

**`AppointmentsService` wird entlastet:**
- Methoden `getTeamspaceAvailableSlots`, `findTeamspaceAvailabilityWindows`, `generateTeamspaceSlotsFromWindows`, `generateTeamspaceSlotsForDay`, `filterTeamspaceBookedSlots`, `createTeamspaceBooking`, `getAllAccessibleBookingCategories`, `getBookingCategoriesByTeamspace`, `getTeamspaceBookings`, `getTeamspaceBookingsStats` werden in die neuen Services verschoben.
- `AppointmentsService` bleibt verantwortlich für: Appointment-CRUD, Status-Lifecycle, Participants, Notifications. `TeamspaceBookingService.createBooking()` ruft am Ende `AppointmentsService.createAppointment(...)` auf — saubere Trennung.

## Data Model

> Vollständige TypeORM-Entities siehe [`contracts.md`](./contracts.md).

### Neue Tabellen

```
availability_windows (refactored — alte Tabelle behält Namen, droppt singuläre Spalten in Welle C-Cleanup)
├── id, teamspace_id, institution_id, type ('recurring' | 'explicit')
├── name (NEU — heute fehlt das, im Prototyp dabei)
├── specific_date (nullable; nur für 'explicit')
├── valid_from, valid_until (NEU — Gültigkeitsbereich)
├── min_lead_time_minutes (NEU — Mindest-Vorlaufzeit)
├── buffer_before_minutes, buffer_after_minutes
├── allowed_category_ids JSONB, allowed_settings JSONB, location
├── is_active (auto-save honored hier — Draft wenn false)
└── created_at, updated_at

availability_blocks (NEU — D1)
├── id, availability_window_id (FK CASCADE)
├── weekday (1..7) — für 'recurring'; NULL für 'explicit'
├── time_start, time_end (HH:MM)
├── UNIQUE(window_id, weekday, time_start) — zwei Blöcke an gleichem Tag/Start verboten
└── CHECK (time_start < time_end)

availability_employees (NEU — D2)
├── id, availability_window_id (FK CASCADE)
├── employee_id (FK CASCADE)
├── last_booked_at TIMESTAMPTZ NULL
├── display_order INT (für stabile Sortierung in UI)
└── UNIQUE(window_id, employee_id)

# D7: KEINE neue Tabelle. Reuse von:
#   - absence_periods (existiert, working-hours-Modul, Vivendi-Sync-gefüttert)
#   - public_holidays (existiert, Meta-DB, mit Bundesland-Targeting via states[])

booking_categories (Tabelle bleibt; minimaler Schema-Change)
├── (bestehende Felder)
└── icon, color, display_order — bleiben (UI-relevant)
```

### Audit-Trigger

Per **D3** (kein Draft/Published im Schema) brauchen wir **keinen** zusätzlichen `entity_changelog`-Trigger auf den vier Booking-Tabellen. Falls D3 später kippt, müssen Trigger via Repair-Migration nachgezogen werden — analog zur bekannten Audit-Lücke bei `teamspace_employee_assignments` (siehe MEMORY).

### Cache-Update-Trigger (Custom Fields)

`20251123000003-CreateCacheUpdateTrigger.ts` referenziert `teamspace_booking_categories` by name. Da der Tabellenname **stabil bleibt** (Booking-Categories behält Tabelle), ist der Trigger sicher. **Wichtig:** bei späterer Rename-Migration MUSS die Trigger-Funktion atomar mit dem Schema-Rename aktualisiert werden — sonst Live-Crash.

## Permissions & Tenant/Institution

Drei Dimensionen, drei klare Regeln:

### A. Wer darf die Konfiguration verwalten?

- **Permission-String:** `ts.bookings.manage` (Teamspace-scope, bestehend)
- **Scope:** Pro Teamspace
- **Default-Rollen:**
  - Teamspace-Admin → bekommt's automatisch
  - Tenant-Admin → bypass via `isAdminElevated()` (Memory-Eintrag)
  - Normale Mitarbeiter → nein

### B. Wer darf als Anbieter in einer Verfügbarkeit erscheinen?

**Keine Permission — eine Zuweisung durch den Admin.**

- Voraussetzung: Person ist Mitglied des Teamspaces (`teamspace_employee_assignments`)
- Admin wählt im Editor aus der Mitglieder-Liste, wer in der Verfügbarkeit landet
- Wird Mitgliedschaft entzogen: Round-Robin überspringt diese Person automatisch (Defense-in-depth in `RoundRobinSelectorService`)

### C. Wer darf buchen?

- **Intern (Mitarbeiter buchen für sich/Klienten):** authenticated EMPLOYEE im selben Tenant; **keine** spezielle Permission heute, Service prüft Kategorie/Teamspace-Existenz (bleibt so)
- **Anonym / Public-Flow:** **nicht hier** — läuft auf `employee_availability_windows` (separater Stack)
- **Klientenportal:** **nicht hier** — eigener Stack über `client_counselor_assignments`

### Endpoint-Permission-Matrix

| Endpoint | Method | Scope | Permission |
|---|---|---|---|
| `/teamspaces/:id/booking-config/categories` | GET | teamspace | `ts.bookings.manage` (oder `view` falls D5 ausdifferenziert) |
| `/teamspaces/:id/booking-config/categories` | POST/PATCH/DELETE | teamspace | `ts.bookings.manage` + ModuleGuard(`offer_booking`) |
| `/teamspaces/:id/booking-config/availability` | GET | teamspace | `ts.bookings.manage` |
| `/teamspaces/:id/booking-config/availability` | POST/PATCH/DELETE | teamspace | `ts.bookings.manage` + ModuleGuard(`offer_booking`) |
| `/teamspaces/:id/booking-config/custom-fields/*` | * | teamspace (NEU — siehe D5) | `ts.bookings.manage` (ersetzt institution-scope) |
| `/teamspace-booking/slots` | GET | authenticated EMPLOYEE | — (Service prüft TS/Cat) |
| `/teamspace-booking` (POST) | POST | authenticated EMPLOYEE | — (Service prüft Cat-Existenz + Modul) |

## Non-Goals

- **Self-Service-Verfügbarkeiten** (D4 = b). v2 bleibt Admin-only. Kann als v3 nachgereicht werden.
- **Konsolidierung mit `employee_availability_windows`.** Der Public/Client-Stack bleibt separat. Falls perspektivisch unified, ist das ein eigenständiges Projekt.
- **Per-Window-konfigurierbarer Round-Robin-Algorithmus** (D6 = a, fix least-recently-booked). v3.
- **Praxis-Schließtage / Brückentage als eigene Tabelle.** Für v2 nicht abgedeckt — Workaround via `AbsencePeriod` pro Mitarbeiter oder `valid_until` an der Verfügbarkeit. Falls Bedarf konkret wird: v3-Feature `institution_closure_days`.
- **Slot-Caching / Pre-Computation.** Slots werden weiterhin on-the-fly berechnet. Performance-Tuning erst bei nachgewiesenem Bedarf.
- **iCal/CalDAV-Export der Verfügbarkeiten.** Outlook-Sync ist appointments-only und bleibt so.
- **History-/Audit-Trail für Verfügbarkeits-Änderungen** (D3 = b). Falls später nötig, separate Migration.
- **Public-Booking-Refactor.** `/booking` und `/welcome` BookingFlow bleiben unangetastet.

## Edge Cases

- **Letzter Mitarbeitender entfernt:** Verfügbarkeit hat 1 Anbieter, Admin entfernt diesen → Verfügbarkeit ist nicht buchbar. Backend validiert: ≥1 Anbieter beim Veröffentlichen, sonst 400. Bei nachträglichem Mitgliedschafts-Entzug: Round-Robin liefert 409, Frontend zeigt "Keine Slots".
- **Verfügbarkeit ohne Mitarbeitende speichern (Draft):** erlaubt — `is_active=false` darf inkomplett sein.
- **Mitarbeitende:r doppelt eingetragen:** UNIQUE-Constraint verhindert das.
- **Zeitblock-Overlap am gleichen Tag:** Validierung in `BookingValidationService.validateBlockOverlaps()` — z.B. Mo 09–12 + Mo 11–14 ist verboten (Slot-Generierung würde Duplikate erzeugen).
- **`valid_until < valid_from`:** CHECK-Constraint + Form-Validation.
- **Slot-Berechnung über Daylight-Saving-Wechsel:** Slots werden in **Tenant-Timezone** berechnet (analog zu `appointments.service.ts`), nicht in UTC. Berlin DST-Sprung (letzter So März / letzter So Oktober) wird durch Timezone-aware Date-Lib behandelt.
- **AbsencePeriod nachträglich angelegt:** bestehende Termine bleiben (Appointment-Lifecycle ist unabhängig). Neue Buchungen sehen den Anbieter nicht mehr im Slot-Picker. Wenn er einziger Anbieter war: Slot verschwindet.
- **AbsencePeriod über Wochengrenze hinweg:** Slot-Generator behandelt jeden Tag im Range einzeln (Date-Comparison auf `start_date <= day <= end_date`).
- **PublicHoliday-Lookup ohne Bundesland:** Falls Institution kein Bundesland gesetzt hat (Edge), Default = `is_nationwide=true`-Holidays only.
- **Praxis-Schließtage (z.B. Brückentag):** Nicht durch v2 abgedeckt. Workaround: Admin trägt `AbsencePeriod` für jeden Mitarbeiter ein, oder befristet die Verfügbarkeit per `valid_until`. Falls Bedarf groß: v3-Feature `institution_closure_days`.
- **Multi-Tab-Konflikt:** Admin hat zwei Tabs offen, beide editieren dasselbe Window → Last-Write-Wins (Auto-Save mit `updated_at`-Optimistic-Lock). Bei Konflikt: 409, Frontend zeigt Toast + Refresh.
- **Round-Robin-Race:** Zwei Bookings für gleichen Slot kollidieren → `SELECT FOR UPDATE` auf Window serialisiert, der zweite Request läuft auf 409 weil Slot belegt.
- **Termin verschieben über Slot-Grenze hinweg:** orthogonal — nur `AppointmentsService`-Domäne.
- **Kategorie löschen während Termin existiert:** `appointments.booking_category_id ON DELETE SET NULL` schützt — Termin bleibt, zeigt "Ohne Kategorie".
- **Capacitor-App mit altem DTO:** Nicht relevant (D9). Feature war pre-cut nicht in Produktion — keine alten Clients im Feld.

## Hard Cut Strategy

**Hard Cut bedeutet hier:** Nach Cutover-Tag existiert die alte UI/Service-Struktur nicht mehr. Bestehende Daten werden migriert, nicht parallel gehalten.

### Was wirklich Hard Cut sein kann:
- ✅ Frontend Admin-Komponente — alte komplett löschen, neue ersetzt direkt unter selber Route
- ✅ Backend-Module-Struktur — Code-Move aus `AppointmentsService` in `TeamspaceBookingService`
- ✅ Schema — additive Migration, alte Spalten in **separater Welle-C-Cleanup-Migration** droppen (nicht in einem Schritt)
- ✅ i18n — alle 16 Locales atomar in einer PR
- ✅ Prototyp-Route — beim Cut löschen

### Hard Cut ist hier wirklich hart (D9):
- Feature war **nicht in Produktion genutzt** — keine alten Clients im Feld
- **Kein Legacy-Wrapper**, kein Sunset-Spec-Eintrag, keine 4-Wochen-Übergangsperiode
- Buchungen im Public-Stack (`employee_availability_windows`) sind unabhängig und bleiben unverändert

### Welle-Reihenfolge (zwingend)

```
Welle A (Foundation) — 4–6 Tage
  ├─ A1: ✅ Decisions D1–D9 entschieden (2026-05-22)
  ├─ A2: Backend Characterization-Tests (Soll-Verhalten der heutigen Slot-Generierung
  │      + Booking-Erstellung festschreiben — vor Refactor!)
  └─ A3: E2E-Coverage-Plan BOOKING_COVERAGE_PLAN.md

Welle B (Backend) — 5–7 Tage
  ├─ B0: Modul-Auszug aus AppointmentsService → TeamspaceBookingService (D8)
  │      (REINER MOVE, keine Logik-Änderung — Characterization-Tests bleiben grün)
  ├─ B1: Schema-Migration (neue Tabellen availability_blocks + availability_employees)
  ├─ B2: Data-Migration (Bestandsdaten → neue Strukturen)
  ├─ B3: SlotGeneratorService + RoundRobinSelectorService Rewrite
  │      + Integration AbsencePeriodRepository + PublicHolidayService (D7)
  ├─ B4: DTOs neu (KEIN Legacy-Wrapper — D9)
  └─ B5: Tests grün ziehen + neue Tests für Multi-Block + Round-Robin + Absences/Holidays

Welle C (Frontend Hard Cut) — 5–7 Tage
  ├─ C1: Prototyp-Assets nach shared/booking-config/ promoten
  ├─ C2: Neue Komponenten gegen neues Backend; alte löschen
  ├─ C3: i18n-Keys über alle 16 Locales
  ├─ C4: E2E-Suite grün
  └─ C5: Cleanup — Prototyp-Route weg, BookingFlow-Vertrag prüfen
         + separate Drop-Migration für alte Spalten
         (NICHT in C2 — frühestens nach 1 Sprint Soak-Zeit)
```

**Total:** ~14–20 Arbeitstage (Decisions schon durch, Legacy-Wrapper entfällt).

## Test Strategy

Heute: **0 Backend-Specs, 1 E2E-Permission-Pin.** Hard Cut blind = russisches Roulette. Welle A2 + A3 sind keine Optionen, sondern Voraussetzungen.

### Characterization-Tests (Welle A2)

> Ziel: dokumentieren, was heute funktioniert, BEVOR es refactored wird. Falls Refactor ein Verhalten ändert, fail-by-default.

Pflicht-Suite (Backend-Specs):
- `slot-generator.service.spec.ts` (NEU — testet ehemaliges `generateTeamspaceSlotsFromWindows` + ` ForDay`)
  - Single-Block-Window erzeugt N Slots
  - Multi-Block-Window erzeugt Slots aus beiden Blöcken (Welle B+)
  - Puffer wird berücksichtigt
  - Vorlaufzeit blockt zu nahe Slots
  - Bestehender Termin entfernt überlappende Slots
  - PublicHoliday blockt ganzen Tag (Welle B+)
  - AbsencePeriod entfernt Anbieter aus Slot, Slot verschwindet wenn niemand übrig
  - Bundesland-Filter: NRW-Institution sieht keine bayerischen Feiertage als blockiert
- `round-robin-selector.service.spec.ts` (NEU)
  - Erster Pick wenn alle `last_booked_at=NULL` → alphabetisch erster
  - LRBO ordering
  - Skip wenn Termin überlappt
  - Skip wenn Employee nicht mehr Teamspace-Mitglied
  - Skip wenn Employee AbsencePeriod hat
  - 409 wenn niemand verfügbar
- `teamspace-booking.service.spec.ts` (NEU)
  - createBooking schreibt Appointment + Updates last_booked_at
  - Race: zwei parallele Bookings auf selben Slot → einer 200, anderer 409
  - providerEmployeeId explizit gesetzt: skip Round-Robin
- `availability.service.spec.ts` (NEU)
  - validateBlockOverlaps verbietet Mo 09–12 + Mo 11–14
  - validateNoOverlap zwischen verschiedenen Windows (Welle B+)
- `booking-categories.service.spec.ts` (NEU)
  - CRUD + Custom-Fields-Cache-Update

### E2E-Coverage-Plan (Welle A3 → BOOKING_COVERAGE_PLAN.md)

5 Wellen analog zum "E2E Welle-Cookbook" aus dem Memory:

| Welle | Fokus | Tests |
|---|---|---|
| 1 | Permission Gating | Admin-only-Routes, normale Mitarbeiter blocked, Tenant-Admin-Bypass |
| 2 | Configuration CRUD | Window anlegen, Multi-Block hinzufügen, Multi-Employee hinzufügen, Veröffentlichen, Löschen |
| 3 | Slot-Generierung | Slot-Endpoint mit Puffer, Vorlaufzeit, Multi-Block, AbsencePeriod, PublicHoliday-Bundesland-Filter |
| 4 | Buchung + Round-Robin | Slot buchen, Round-Robin korrekt, Race-Condition (2 parallele Buchungen) |
| 5 | Edge-Cases | Mitgliedschafts-Entzug, Kategorie ohne Verfügbarkeit, Drafts, Daylight-Saving, ganzer Anbieter im Urlaub |

Geschätzt: ~20–25 E2E-Tests in 5 Specs. Reset-Utility für Test-Daten (siehe MEMORY `appointment-reset.utils.ts`-Pattern).

### Frontend Component-Tests

Optional in Welle C — Master-Detail-Shell + WeekScheduleComponent als Hauptkandidaten.

## i18n Keys

> Alle Keys in **allen 16 Locales** (`apps/tagea-frontend/src/assets/i18n/{de,en,fr,tr,ro,ar,ru,uk,it,pl,hr,fa,ku,bg,sr,sq}.json`). Validator: `python3 scripts/translate/validate-all.py` pflicht vor Push.

**Bestehende Keys** (bleiben oder werden ersetzt):
- `bookingCategories.admin.*` (heute 2 Keys — expandieren)
- `permissions.ts_bookings_manage`
- `appointmentBookings` (pageTitle)

**Neue Keys** (Vorschlag-Struktur):
- `teamspaceBookingConfig.master.*` — Listen-Karten, Header, Empty-State
- `teamspaceBookingConfig.editor.*` — alle Editor-Sections
- `teamspaceBookingConfig.editor.weekSchedule.*` — Multi-Block-Editor
- `teamspaceBookingConfig.editor.employees.*` — Multi-Employee-Picker + Round-Robin-Hinweis
- `teamspaceBookingConfig.editor.advanced.*` — Puffer/Vorlaufzeit/Gültigkeit
- `teamspaceBookingConfig.categories.list.*` — Kategorien-Grid + Warn-Banner
- `teamspaceBookingConfig.categories.detail.*` — Detail-View
- `teamspaceBookingConfig.autoSave.*` — "Wird gespeichert" / "Gespeichert" / "Fehler"
- `teamspaceBookingConfig.absenceHint.*` — Hinweis im Editor: "Urlaube/Krankheiten werden automatisch aus den Mitarbeiter-Stammdaten gezogen"
- `bookingFlow.errors.slotTaken` — 409-Toast beim Buchen

Grobe Schätzung: ~80–120 neue Keys in `de.json`, gleich viele in jeder anderen Locale.

## Offline Behavior

**Flutter-Port:** P3 / Documentation only. Die Booking-Konfiguration ist Admin-Web-only und braucht keine Offline-Fähigkeit. Der **Read-Path (Slot-Picker)** im Klientenportal/Public ist nicht Teil dieses Specs.

## References

- **Backend implementation:**
  - NEU: `apps/tagea-backend/src/teamspace-booking/` (gesamtes Modul)
  - ALT (löschen): `apps/tagea-backend/src/teamspace-availability/`, Teile von `apps/tagea-backend/src/teamspaces/services/teamspace-booking-categories.service.ts`, ~700 LoC aus `apps/tagea-backend/src/appointments/services/appointments.service.ts:7416–8120`
- **Frontend implementation:**
  - NEU: `apps/tagea-frontend/src/app/pages/teamspace/booking-config/` (Master-Detail-Shell)
  - NEU: `apps/tagea-frontend/src/app/shared/booking-config/` (Wiederverwendbare Komponenten — Wochenplan-Editor, Avatar-Stack, Tokens)
  - ALT (löschen): `apps/tagea-frontend/src/app/admin/components/teamspace-booking-categories-admin/`, `apps/tagea-frontend/src/app/pages/teamspace/booking-config-prototype/`, `apps/tagea-frontend/src/app/admin/services/teamspace-booking-category-state.service.ts`
- **API contracts:** [`contracts.md`](./contracts.md)
- **Angular↔Flutter parity:** [`parity.md`](./parity.md)
- **E2E plan:** zu erstellen → `apps/tagea-frontend-e2e/BOOKING_COVERAGE_PLAN.md`
- **Legacy-Endpoint-Sunset-Eintrag:** zu erstellen → `specs/cross-cutting/legacy-endpoint-sunset/spec.md`
- **Prototyp (Design-Sign-off basis):** `apps/tagea-frontend/src/app/pages/teamspace/booking-config-prototype/`
