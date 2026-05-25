# Contracts: Teamspace-Booking v2

> API endpoints, DTOs, entities — everything that flows between frontend, backend and database.

All endpoints below live under `apps/tagea-backend/src/teamspace-booking/controllers/`. Pre-existing legacy endpoints (`/teamspace-availability/*`, `/teamspaces/:id/booking-categories/*`, `/appointments/teamspace-booking/*`) werden **am Cutover-Tag entfernt** — feature war nicht in Produktion (D9: Hard Cut, kein Legacy-Wrapper).

## Entities

```ts
// apps/tagea-backend/src/teamspace-booking/entities/availability-window.entity.ts

@Entity('availability_windows')
export class AvailabilityWindow {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;

  @Column({ type: 'varchar', length: 36 }) teamspace_id: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) institution_id: string | null;

  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 20, default: 'recurring' }) type: 'recurring' | 'explicit';
  @Column({ type: 'date', nullable: true }) specific_date: string | null; // only for 'explicit'

  @Column({ type: 'date', nullable: true }) valid_from: string | null;
  @Column({ type: 'date', nullable: true }) valid_until: string | null;

  @Column({ type: 'int', default: 0 }) min_lead_time_minutes: number;
  @Column({ type: 'int', default: 0 }) buffer_before_minutes: number;
  @Column({ type: 'int', default: 0 }) buffer_after_minutes: number;

  @Column({ type: 'jsonb', default: '[]' }) allowed_category_ids: string[];
  @Column({ type: 'jsonb', default: '[]' }) allowed_settings: string[];
  @Column({ type: 'varchar', length: 255, nullable: true }) location: string | null;

  @Column({ type: 'boolean', default: false }) is_active: boolean; // Draft when false (D3)

  @OneToMany(() => AvailabilityBlock, b => b.window, { cascade: true })
  blocks: AvailabilityBlock[];

  @OneToMany(() => AvailabilityEmployee, e => e.window, { cascade: true })
  employees: AvailabilityEmployee[];

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
```

```ts
// apps/tagea-backend/src/teamspace-booking/entities/availability-block.entity.ts

@Entity('availability_blocks')
@Unique(['availability_window_id', 'weekday', 'time_start'])
export class AvailabilityBlock {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) availability_window_id: string;

  @ManyToOne(() => AvailabilityWindow, w => w.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'availability_window_id' })
  window: AvailabilityWindow;

  @Column({ type: 'int', nullable: true }) weekday: number | null; // 1..7; NULL for explicit
  @Column({ type: 'varchar', length: 5 }) time_start: string; // HH:MM
  @Column({ type: 'varchar', length: 5 }) time_end: string;   // HH:MM

  // CHECK (time_start < time_end) — added via migration constraint
}
```

```ts
// apps/tagea-backend/src/teamspace-booking/entities/availability-employee.entity.ts

@Entity('availability_employees')
@Unique(['availability_window_id', 'employee_id'])
export class AvailabilityEmployee {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) availability_window_id: string;
  @Column({ type: 'varchar', length: 36 }) employee_id: string;

  @ManyToOne(() => AvailabilityWindow, w => w.employees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'availability_window_id' })
  window: AvailabilityWindow;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'timestamptz', nullable: true }) last_booked_at: Date | null;
  @Column({ type: 'int', default: 0 }) display_order: number;
}
```

> **Hinweis D7:** Es gibt **keine** `availability_blackouts`-Tabelle. Sperrzeiten werden aus bestehenden Quellen abgeleitet:
>
> - **Mitarbeiter-Abwesenheiten:** `AbsencePeriod` (`apps/tagea-backend/src/working-hours/entities/absence-period.entity.ts`) — wird vom `SlotGeneratorService` und `RoundRobinSelectorService` als Filter konsultiert. Abgedeckte Types: `VACATION`, `SICK`, `TRAINING`, `OTHER`. Auch Vivendi-synced Daten greifen automatisch.
> - **Gesetzliche Feiertage:** `PublicHoliday` (`apps/tagea-backend/src/public-holidays/entities/public-holiday.entity.ts`, Meta-DB) — der `SlotGeneratorService` lädt Holidays für das Bundesland der jeweiligen Institution (`institution.state_code` matched gegen `public_holidays.states[]` ODER `is_nationwide=true`).
>
> Praxis-Schließtage (Brückentag, Betriebsausflug) sind in v2 **nicht** abgedeckt — Workaround via `AbsencePeriod` pro Mitarbeiter oder `valid_until` an der Verfügbarkeit.

```ts
// apps/tagea-backend/src/teamspace-booking/entities/booking-category.entity.ts
// (NAME UNCHANGED — table 'teamspace_booking_categories' bleibt, weil Cache-Trigger
//  per Name darauf zeigt. Verzicht auf Rename schützt CustomFields-Pipeline.)

@Entity('teamspace_booking_categories')
export class BookingCategory {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) teamspace_id: string;
  // (existing fields — no schema break for v2)
  // …
}
```

## Endpoints

### Admin / Configuration

#### `GET /teamspaces/:teamspaceId/booking-config/availability`

Liefert alle Verfügbarkeiten des Teamspaces (auch Drafts).

**Permission:** `ts.bookings.manage` (teamspace-scope)
**Response 200:**

```ts
interface AvailabilityWindowDto {
  id: string;
  teamspace_id: string;
  institution_id: string | null;
  name: string;
  type: 'recurring' | 'explicit';
  specific_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
  min_lead_time_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  allowed_category_ids: string[];
  allowed_settings: string[];
  location: string | null;
  is_active: boolean;
  blocks: AvailabilityBlockDto[];
  employees: AvailabilityEmployeeDto[];
  created_at: string;
  updated_at: string;
}

interface AvailabilityBlockDto {
  id: string;
  weekday: number | null;
  time_start: string; // HH:MM
  time_end: string;   // HH:MM
}

interface AvailabilityEmployeeDto {
  id: string;
  employee_id: string;
  last_booked_at: string | null;
  display_order: number;
}
```

**Error codes:** 401, 403

#### `POST /teamspaces/:teamspaceId/booking-config/availability`

Legt eine neue Verfügbarkeit an (Draft, `is_active=false`).

**Permission:** `ts.bookings.manage` + ModuleGuard(`offer_booking`)
**Request:**

```ts
interface CreateAvailabilityWindowDto {
  name?: string; // optional, default "Neue Verfügbarkeit"
  type?: 'recurring' | 'explicit'; // default 'recurring'
  specific_date?: string; // required if type='explicit'
  // initial state is otherwise empty — Admin fills via PATCH
}
```

**Response 201:** `AvailabilityWindowDto`

#### `PATCH /teamspaces/:teamspaceId/booking-config/availability/:windowId`

Update einer Verfügbarkeit (Auto-Save-Target). Akzeptiert partielle Updates inkl. `blocks[]` und `employees[]` Replace.

**Request:**

```ts
interface UpdateAvailabilityWindowDto {
  name?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  min_lead_time_minutes?: number;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  allowed_category_ids?: string[];
  allowed_settings?: string[];
  location?: string | null;
  is_active?: boolean; // Veröffentlichen
  blocks?: AvailabilityBlockUpdate[];
  employees?: AvailabilityEmployeeUpdate[];
  // Optimistic Lock:
  updated_at_known?: string;
}

interface AvailabilityBlockUpdate {
  id?: string; // omit for create
  weekday: number | null;
  time_start: string;
  time_end: string;
}

interface AvailabilityEmployeeUpdate {
  id?: string;
  employee_id: string;
  display_order?: number;
}
```

**Response 200:** `AvailabilityWindowDto`
**Errors:** 400 (validation — block overlap, time_start >= time_end, employee not in teamspace), 403, 404, 409 (Optimistic-Lock-Konflikt: `updated_at_known` veraltet)

#### `DELETE /teamspaces/:teamspaceId/booking-config/availability/:windowId`

**Response 204**
**Errors:** 403, 404

#### `GET|POST|PATCH|DELETE /teamspaces/:teamspaceId/booking-config/categories[/:id|/reorder|/active|/archived|/:id/toggle-active|/:id/archive|/:id/unarchive]`

Verhalten bleibt 1:1 wie heute (`teamspace-booking-categories.controller.ts`), nur unter neuem Pfad. DTOs siehe bestehende.

#### Sperrzeiten — keine eigenen Endpoints (D7)

Sperrzeiten werden aus `AbsencePeriod` (Working-Hours-Modul) und `PublicHoliday` (Meta-DB) abgeleitet — kein neuer CRUD für dieses Modul. Mitarbeiter-Abwesenheiten verwalten Admin/Mitarbeiter wie heute über die `working-hours`-Surfaces.

Beim Slot-Endpoint wirken sie als Filter (siehe `SlotGeneratorService` weiter unten).

#### `GET|POST|PATCH|DELETE /teamspaces/:teamspaceId/booking-config/custom-fields/*`

Custom-Fields-Admin. Per D5 migriert von institution-scope nach teamspace-scope. Endpoint-Shape selbst bleibt unverändert zu heute.

### Read-Path (Slot-Picker)

#### `GET /teamspace-booking/slots`

Berechnet Slots on-the-fly.

**Permission:** authenticated EMPLOYEE (Service prüft TS- und Category-Existenz, kein Permission-Bit)
**Query-Params:**

```
teamspaceId    (required)
categoryId     (required)
from           (required, ISO date)
to             (required, ISO date, max 14 Tage Spanne)
employeeId     (optional, filter auf bestimmten Anbieter)
```

**Response 200:**

```ts
interface AvailableSlotDto {
  start: string;            // ISO datetime
  end: string;              // ISO datetime
  durationMinutes: number;
  availabilityWindowId: string;
  // alle Anbieter, die diesen Slot bedienen könnten (Round-Robin entscheidet erst beim Buchen)
  availableEmployeeIds: string[];
}

type SlotsResponse = AvailableSlotDto[];
```

**Errors:** 400 (Span zu groß, falsches Date-Format), 404 (TS/Cat nicht gefunden)

### Booking (Write — kritischer Pfad)

#### `POST /teamspace-booking`

Erzeugt einen Appointment aus einem Slot.

**Permission:** authenticated EMPLOYEE
**Request:**

```ts
interface CreateBookingDto {
  teamspaceId: string;
  categoryId: string;
  slotStart: string; // ISO datetime
  slotEnd: string;   // ISO datetime
  providerEmployeeId?: string; // optional — wenn gesetzt, skip Round-Robin
  setting?: 'vor-ort' | 'telefonat' | 'video' | 'chat';
  location?: string;
  participantEmployeeIds?: string[]; // weitere Teilnehmer
  participantClientIds?: string[];
  notes?: string;
}
```

**Response 201:**

```ts
interface BookingCreatedDto {
  appointmentId: string;
  providerEmployeeId: string;          // wer am Ende ausgewählt wurde
  selectedByRoundRobin: boolean;       // false wenn user-set, true wenn auto
  appointment: AppointmentDto;          // voll hydrierter Appointment-Datensatz
}
```

**Errors:**
- 400 — Validation (z.B. category nicht in TS, slot ungültig)
- 403 — Booking-Modul deaktiviert
- 409 — **Slot nicht mehr frei** (Race) ODER **kein Round-Robin-Kandidat verfügbar**
- 422 — Sperrzeit überlappend

### Public Read (auch in Capacitor-App, NICHT anonym)

#### `GET /teamspaces/:teamspaceId/booking-config/categories/active`

Liste aller aktiven Kategorien für interne Mitarbeitende-Buchung.

**Permission:** authenticated EMPLOYEE
**Response:** `BookingCategoryDto[]`

## Events (WebSocket / Push)

Keine neuen WebSocket-Events. Booking erzeugt einen Appointment, dessen normale Notification-Pipeline (`APPOINTMENT_INVITATION`, in-app) greift unverändert.

**Push-Notifications (in der App):**
- Provider erhält bei Booking eine `APPOINTMENT_INVITATION` (existierender Flow, kein neues Event)

## Round-Robin-Algorithmus (Pseudo-Code)

```ts
// apps/tagea-backend/src/teamspace-booking/services/round-robin-selector.service.ts

async selectProvider(
  windowId: string,
  slotStart: Date,
  slotEnd: Date,
  manager: EntityManager,
): Promise<string> {
  const candidates = await manager
    .createQueryBuilder(AvailabilityEmployee, 'ae')
    .innerJoin(TeamspaceEmployeeAssignment, 'tea',
      'tea.employee_id = ae.employee_id AND tea.teamspace_id = (SELECT teamspace_id FROM availability_windows WHERE id = :windowId)',
      { windowId },
    )
    .where('ae.availability_window_id = :windowId', { windowId })
    .orderBy('ae.last_booked_at', 'ASC', 'NULLS FIRST')
    .addOrderBy('ae.display_order', 'ASC')
    .addOrderBy('ae.employee_id', 'ASC')
    .setLock('pessimistic_write')
    .getMany();

  for (const candidate of candidates) {
    // (1) AbsencePeriod-Filter (D7): Anbieter im Urlaub/Krank → skip
    const absence = await manager.findOne(AbsencePeriod, {
      where: {
        employee_id: candidate.employee_id,
        is_active: true,
        start_date: LessThanOrEqual(slotEnd),
        end_date: MoreThanOrEqual(slotStart),
      },
    });
    if (absence) continue;

    // (2) Termin-Konflikt → skip
    const conflict = await manager.findOne(Appointment, {
      where: {
        assigned_to_employee_id: candidate.employee_id,
        start_datetime: LessThan(slotEnd),
        end_datetime: MoreThan(slotStart),
        status: Not(In(['cancelled', 'no_show'])),
      },
    });
    if (conflict) continue;

    // (3) Frei → atomar Pick + last_booked_at-Update
    await manager.update(AvailabilityEmployee,
      { id: candidate.id },
      { last_booked_at: new Date() });
    return candidate.employee_id;
  }

  throw new ConflictException('No provider available for this slot');
}
```

## Slot-Generator (Pseudo-Code, D7-Integration)

```ts
// apps/tagea-backend/src/teamspace-booking/services/slot-generator.service.ts

async generateSlots(
  teamspaceId: string,
  categoryId: string,
  from: Date,
  to: Date,
): Promise<AvailableSlotDto[]> {
  const institution = await this.resolveInstitution(teamspaceId);
  const stateCode = institution.state_code; // z.B. 'NW'

  // PublicHoliday-Lookup (Meta-DB): nationwide ODER stateCode in states[]
  const holidays = await this.publicHolidaysService.findForRange(from, to, stateCode);
  const holidayDates = new Set(holidays.map(h => h.date.toISOString().slice(0, 10)));

  const windows = await this.availabilityService
    .findActiveForTeamspaceAndCategory(teamspaceId, categoryId);

  const slots: AvailableSlotDto[] = [];

  for (const day of eachDayInRange(from, to)) {
    // D7: Feiertag → ganzer Tag raus
    if (holidayDates.has(day.toISOString().slice(0, 10))) continue;

    for (const window of windows) {
      if (!isWindowActiveOn(window, day)) continue;

      for (const block of window.blocks.filter(b => b.weekday === day.getDay())) {
        for (const slot of generateSlotCandidates(block, day, category.duration, window)) {
          // Pro Slot: ermittle teilnehmende Anbieter
          const availableEmployees: string[] = [];
          for (const empAssign of window.employees) {
            // (a) AbsencePeriod überlappend → skip
            const onLeave = await this.absencePeriodRepo.exists({
              employee_id: empAssign.employee_id,
              is_active: true,
              start_date: LessThanOrEqual(day),
              end_date: MoreThanOrEqual(day),
            });
            if (onLeave) continue;

            // (b) Termin überlappend → skip
            const conflict = await this.hasAppointmentConflict(
              empAssign.employee_id, slot.start, slot.end,
            );
            if (conflict) continue;

            availableEmployees.push(empAssign.employee_id);
          }

          if (availableEmployees.length > 0) {
            slots.push({
              start: slot.start.toISOString(),
              end: slot.end.toISOString(),
              durationMinutes: category.duration,
              availabilityWindowId: window.id,
              availableEmployeeIds: availableEmployees,
            });
          }
        }
      }
    }
  }

  return slots;
}
```

## Data Models (Frontend)

```ts
// apps/tagea-frontend/src/app/pages/teamspace/booking-config/models/availability-window.model.ts

export interface AvailabilityWindow {
  id: string;
  teamspace_id: string;
  institution_id: string | null;
  name: string;
  type: 'recurring' | 'explicit';
  specific_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
  min_lead_time_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  allowed_category_ids: string[];
  allowed_settings: string[];
  location: string | null;
  is_active: boolean;
  blocks: AvailabilityBlock[];
  employees: AvailabilityEmployee[];
  created_at: string;
  updated_at: string;
}

export interface AvailabilityBlock {
  id: string;
  weekday: number | null;
  time_start: string;
  time_end: string;
}

export interface AvailabilityEmployee {
  id: string;
  employee_id: string;
  last_booked_at: string | null;
  display_order: number;
}

// Hinweis D7: Es gibt keinen AvailabilityBlackout-Type im Frontend.
// Mitarbeiter-Abwesenheiten werden über die bestehenden Working-Hours-Surfaces
// gepflegt (apps/tagea-frontend/src/app/pages/.../working-hours/...).
// Feiertage werden serverseitig im Slot-Generator gefiltert — keine Frontend-Modellierung nötig.
```

> **Flutter port note:** Dart-Klassen müssen das identische JSON-Contract respektieren (gleiche Feldnamen, gleiche Nullability). Sollte vom Booking-Read-Path im Flutter-Client konsumiert werden — der Admin-Path ist Web-only.

## Legacy / Hard Cut (D9)

**Kein Legacy-Wrapper.** Feature war pre-cut nicht in Produktion — keine alten Clients im Feld. Alte Endpoints werden mit Cutover entfernt:

| Alter Endpoint | Aktion |
|---|---|
| `POST/PATCH/DELETE /teamspace-availability/*` | gelöscht |
| `GET/POST/PATCH/DELETE /teamspaces/:id/booking-categories/*` | umgezogen nach `/teamspaces/:id/booking-config/categories/*` (Pfad neu, Logik äquivalent) |
| `POST /appointments/teamspace-booking` | umgezogen nach `POST /teamspace-booking` |
| `GET /appointments/teamspace-booking/available-slots` | umgezogen nach `GET /teamspace-booking/slots` |
| `GET /appointments/booking-categories/*` | umgezogen nach `/teamspaces/:id/booking-config/categories/...` + Public-Read-Endpoint |

Kein Sunset-Spec-Eintrag, keine Übergangsperiode.

## Cache-Trigger-Hinweis

Der bestehende `cache_update_trigger` (`apps/tagea-backend/src/database/tenant-migrations/20251123000003-CreateCacheUpdateTrigger.ts`) referenziert die Tabelle `teamspace_booking_categories` namentlich. Da die Tabelle in v2 **denselben Namen behält** (nur die Spalten werden teilweise additiv erweitert), bleibt der Trigger funktional. **Bei jeder zukünftigen Namens-Änderung MUSS die Trigger-Funktion atomar mit dem Schema-Rename in derselben Migration aktualisiert werden** — sonst Live-Crash.

## Error-Code-Übersicht

| Code | Wann |
|---|---|
| 400 | Validation: Block-Overlap, time_start ≥ time_end, employee nicht in Teamspace, valid_until < valid_from |
| 401 | Nicht eingeloggt |
| 403 | Permission fehlt ODER Booking-Modul für Teamspace deaktiviert |
| 404 | Window/Category/Blackout nicht gefunden |
| 409 | Slot nicht mehr frei (Race) ODER Optimistic-Lock-Konflikt beim Window-Update ODER kein Round-Robin-Kandidat |
| 422 | Sperrzeit überlappt mit gewähltem Slot |
