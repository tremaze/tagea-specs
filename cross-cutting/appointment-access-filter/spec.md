# Cross-Cutting: Appointment Access Filter

> **Status:** ✅ Specified
> **Owner:** baumgart
> **Last updated:** 2026-05-05

## Vision (Elevator Pitch)

Termine sind department-sensible Daten. Eine Beraterin im Fachbereich
"Familie" darf inhaltliche Details zu "Sucht"-Fällen nicht sehen. Heute
ist der Filter-Code für diesen Schutz inkonsistent über die Read-Endpoints
verteilt: Kalender und Einzel-View filtern, der Listen-Endpoint und
mehrere weitere Endpoints lassen Daten durch. Diese Spec definiert den
einheitlichen Soll-Zustand für **alle** Read-Pfade auf Termine: dieselben
Akteur-Regeln, dieselbe Quelle (Case-Department, fallback Klient-Department),
dieselbe Implementierung über einen geteilten Filter-Helper.

## Akteur-Klassen

Wer einen Termin liest, fällt in eine dieser Klassen — entscheidet, **ob**
gefiltert wird:

| Klasse | Erkennung | Filter-Verhalten |
| ------ | --------- | ---------------- |
| **Tenant-Admin** | `auth_user_tenant.is_tenant_admin = true` (oder Service-Side `UserRole.ADMIN`-Check, siehe `appointments.service.ts::getUserDepartmentIds`) | **Bypass** — kein Filter, alle Daten tenant-weit. |
| **User mit Department-Assignments** | mind. 1 Eintrag in `user_department_assignments` für `user_id = principal.employeeId` | Filter aktiv — sieht eigene Department-Termine + Termine ohne Department-Bezug. |
| **User ohne Department-Assignments** | 0 Einträge in `user_department_assignments` | Filter aktiv — sieht **nur** Termine ohne Department-Bezug (legacy fallback). |
| **Tenant-only Personas** (z.B. Personalverwalter) | hat `INSTITUTION_ACCESS` nicht | 403 vor Filter — Auth-Layer blockt, Service wird nie erreicht. |

## Datenquelle: woher kommt der Department-Bezug eines Termins?

Ein Termin ist department-zugeordnet auf zwei Wegen, in dieser Reihenfolge:

1. **Über den Case** (primär): wenn mindestens ein client-Participant einen
   `case_id` hat und der referenzierte Case ein gesetztes `department_id`,
   dann ist DAS das Filter-Department des Termins.
2. **Über den Klienten** (Fallback, wenn kein Case-Bezug): wenn `case_id`
   auf allen client-Participants `NULL` ist, fällt der Filter auf
   `client.department_id` zurück.
3. **Kein Department-Bezug**: wenn weder ein Case-Department noch ein
   Klient-Department gesetzt ist, gilt der Termin als department-frei und
   ist für alle User mit Institution-Zugriff sichtbar (legacy-kompatibel).

Diese Reihenfolge ist die heutige Implementierung in
`appointments.service.ts::getCalendarAppointments` (Z. 559+) und wird in
den Filter-Helper extrahiert.

## Self-Bypass: Staff-Participant Override

Wer als Mitarbeiter explizit zum Termin eingeladen ist, sieht den Termin
unmaskiert — unabhängig davon, ob Klient/Fall in einem fremden Department
liegen. Eingeladen-Sein wird gleichgesetzt mit "darf alle Details sehen",
weil sonst die operative Mitwirkung am Termin (Vorbereitung, Absage,
Statuspflege) nicht möglich ist.

**Erkennung:** Es existiert ein `appointment_participants`-Eintrag mit
`participant_type = 'staff'` und `participant_employee_id = principal.employeeId`
für den angefragten Termin.

**NICHT als Bypass-Trigger:**
- `appointment.created_by_employee_id = principal.employeeId` allein. Erstellt-Haben
  bedeutet historisch nicht, mitzuwirken — der Klient/Fall kann nach Erstellung
  in ein anderes Department verschoben worden sein, der Ersteller verbleibt
  aber im Audit-Trail. Wer weiterhin sehen soll, muss Staff-Participant sein.
- Teamspace-Mitgliedschaft. Teamspace-Termine haben eigene Mechanik
  (`teamspace_employee_assignments`); diese Regel betrifft ausschließlich
  Institution-Mode-Reads.
- Klient-Participant-Rolle (z.B. der Berater ist gleichzeitig als Klient
  irgendwo eingetragen — Edge Case, ignorieren).

**Reihenfolge der Bypass-Auswertung** (kürzeste Wirkung zuerst):

1. Tenant-Admin → kompletter Bypass, kein Filter angewendet.
2. Staff-Participant-Self-Bypass für den **konkreten Termin** → Department-Filter
   wird für diese eine Zeile übersprungen, alle anderen Termine durchlaufen
   den normalen Filter.
3. Department-Membership-Filter (Hide oder Restricted-View, je nach Endpoint).
4. Legacy-Fallback (User ohne Department-Assignments sieht nur Termine ohne
   Department-Bezug).

## Filter-Modi

Wenn der Filter aktiv ist, gibt es zwei Varianten, wie ein "verbotener"
Termin im Result aussieht:

### Hide
Der Termin **erscheint nicht** im Result-Set. Bei direkter ID-Anfrage
(`GET /appointments/:id`) → `403 Forbidden` (oder `404`, je nach
Endpoint-Konvention).
**Anwendungsfall**: Listen, Reports, Such-Endpoints, Picker. Der User soll
gar nicht wissen, dass es den Termin gibt.

### Restricted-View
Der Termin **bleibt im Result**, aber sensible Felder werden maskiert:
- `title` → `'Termin belegt'`
- `description` → `null`
- `location` → `null`
- `custom_fields_summary` → `null`
- `template_name` → `null`
- `has_full_access` → `0` (Frontend-Hint)

Andere Felder (`id`, `start_datetime`, `end_datetime`, `status`,
`duration_minutes`, `is_all_day`) bleiben sichtbar.
**Anwendungsfall**: ausschließlich Kalender-View. Sinn: Doppelbuchungs-
Prävention überlagert Datenschutz — der User muss sehen, dass die Zeit
belegt ist, ohne den Inhalt zu sehen.

## Endpoint-Matrix

Soll-Modus pro Read-Pfad, plus aktueller Stand:

| Endpoint | Zweck | Soll-Modus | Ist-Status |
| -------- | ----- | ---------- | ---------- |
| `GET /institutions/:instId/appointments/calendar` | Kalender-Slots, Doppelbuchungs-Prävention | Restricted-View | ✅ implementiert |
| `GET /institutions/:instId/appointments/:id` | Einzelansicht | Restricted-View über `checkAppointmentAccess` (object-based) | ✅ implementiert; nutzt eigenes Pattern statt Filter-Helper, weil der Service zusätzlich zu Hide einen Maskiert-Modus für UX-Konsistenz mit Calendar braucht (User sieht "Termin belegt" statt 404, wenn er die ID aus einem Calendar-Slot kennt). Kein Refactor-Blocker, der Helper kommt nur bei reinen List/Picker-Endpoints zum Einsatz. |
| `GET /institutions/:instId/appointments` | Listen-View, Reports, Suche | **Hide** | ❌ kein Filter |
| `GET /institutions/:instId/appointments/minimal` | Picker | **Hide** | ❌ kein Filter (anzunehmen) |
| `GET /institutions/:instId/appointments/case/:caseId` | Termine eines Falls | **Hide** | ❌ kein Filter (anzunehmen) |
| `GET /institutions/:instId/appointments/client/:clientId` | Termine eines Klienten | **Hide** | ❌ kein Filter (anzunehmen) |
| `GET /institutions/:instId/appointments/upcoming` | Dashboard-Widget | **Hide** | ❌ kein Filter (anzunehmen) |
| `GET /institutions/:instId/appointments/billing` | Abrechnung | **Bypass** für Billing-User | per Permission `BILLING_VIEW`/`BILLING_MANAGE` gegated; wer abrechnet, sieht alle Termine zur Aggregation. |
| `GET /institutions/:instId/appointments/teamspace-bookings` | Teamspace-Buchungen | **Hide** | ❌ kein Filter (anzunehmen) |
| Client-Portal: `/appointments/my-appointments` | Klient sieht eigene | **Eigene Mechanik** (`client_id`-Match) | ✅ separat, nicht Teil dieser Spec |
| `GET /appointments/events/public` | Public Event-Listing | **Bypass** (öffentlich, `visibility=public`-Filter ist die einzige Sperre) | ✅ — nicht Teil dieser Spec |

## Acceptance Criteria

### Filter-Verhalten pro Akteur-Klasse

- [ ] **Given** Berater mit Department-A-Assignment, **when** er
      `GET /institutions/:instId/appointments` aufruft, **then** Termine,
      deren Klient-Participants einem Case mit `department_id = B`
      angehören, erscheinen **nicht** im Result.
- [ ] **Given** Berater mit Department-A-Assignment, **when** er
      `GET /institutions/:instId/appointments/calendar` aufruft, **then**
      Department-B-Termine bleiben in der Liste, aber `title='Termin belegt'`,
      `description=null`, `location=null`, `has_full_access=0`.
- [ ] **Given** Berater ohne Department-Assignment, **when** er Termine
      listet, **then** sieht er nur Termine, deren Cases (oder
      Klienten-Fallback) **kein** `department_id` haben (legacy-fallback).
- [ ] **Given** Trägeradmin (`is_tenant_admin = true`), **when** beliebiger
      Termine-Read-Endpoint, **then** **alle** Termine sichtbar (Bypass,
      kein Filter).
- [ ] **Given** Personalverwalter (tenant-only), **when** Institutions-
      Endpoint-Aufruf, **then** 403 vor Filter (Auth-Layer).

### Datenquellen-Reihenfolge

- [ ] **Given** Termin mit Klient-Participant, dessen Case `department_id = B`
      hat, **then** filtert der Service auf das **Case**-Department, **nicht**
      `client.department_id`.
- [ ] **Given** Termin mit Klient-Participant ohne `case_id`, aber
      `client.department_id = B`, **then** filtert der Service auf das
      **Klient**-Department.
- [ ] **Given** Termin mit Case ohne `department_id` (Legacy), **then** ist
      der Termin für alle Institutions-User sichtbar (legacy-fallback,
      backward compatible).

### Self-Bypass: Staff-Participant

- [ ] **Given** Berater im Department-A, **and** Termin mit Klient-Participant
      auf Case mit `department_id = B`, **and** Berater ist als Staff-Participant
      auf dem Termin eingetragen, **when** er Liste/Kalender/Detail aufruft,
      **then** Termin ist sichtbar **mit allen Feldern unmaskiert**
      (kein `'Termin belegt'`, `has_full_access = 1`).
- [ ] **Given** Berater im Department-A, **and** Termin mit Klient-Participant
      ohne Case (Klient hat `department_id = B`), **and** Berater ist als
      Staff-Participant auf dem Termin eingetragen, **when** er Liste/Kalender/Detail
      aufruft, **then** Termin ist sichtbar mit allen Feldern unmaskiert.
- [ ] **Given** Berater im Department-A, **and** Termin mit Klient/Case in
      Department-B, **and** Berater ist **NICHT** Staff-Participant, aber
      `created_by_employee_id` zeigt auf ihn, **when** er Liste aufruft,
      **then** Termin ist **versteckt** (Hide-Mode) bzw. maskiert
      (Restricted-View). Erstellen allein gibt keinen Bypass.
- [ ] **Given** Berater im Department-A, **and** Termin mit Klient/Case in
      Department-A (eigenes Department), **when** er Liste aufruft, **then**
      Termin ist sichtbar — egal ob Staff-Participant oder nicht (regulärer
      Department-Match).
- [ ] **Given** Berater im Department-A, **and** Termin mit Klient/Case in
      Department-B, **and** Berater ist **NICHT** Staff-Participant, **when**
      er Liste aufruft, **then** Termin ist versteckt (Hide-Mode).

### Konsistenz über Endpoints

- [ ] **Given** ein Termin ist im Calendar-Endpoint als "Termin belegt"
      maskiert, **when** der gleiche User den Listen-Endpoint
      `GET /appointments` aufruft, **then** ist der Termin dort **gar nicht**
      enthalten (Hide ≠ Restricted-View, aber gleiche Department-Logik).
- [ ] **Given** ein Berater versucht, einen Termin per ID zu öffnen, der im
      Listen-Endpoint nicht erschienen wäre, **then** `403`.

## Implementation Note (non-normative)

Filter-Logik wird zu einer privaten Service-Methode

```ts
applyDepartmentAccessFilter(
  qb: SelectQueryBuilder<Appointment>,
  mode: 'hide' | 'restricted-view',
): Promise<void>
```

extrahiert. Die existierende Logik in `getCalendarAppointments` (Z. 559+)
ist die Ausgangsbasis. Aufrufer:

| Service-Methode | Endpoint | Modus |
| --------------- | -------- | ----- |
| `getCalendarAppointments` | `/calendar` | restricted-view |
| `findAll` | `GET /appointments` | hide |
| `findAllMinimal` | `/minimal` | hide |
| `findByCaseId` | `/case/:caseId` | hide |
| `findByClientId` | `/client/:clientId` | hide |
| `getUpcomingAppointments` | `/upcoming` | hide |
| `getTeamspaceBookings` | `/teamspace-bookings` | hide |
| `findOne` | `/:id` | hide (wirft `403`) |

Nicht über den Helper laufen:
- `getBillingAppointments` — Bypass für Billing-User per Permission-Gate.
- `getPublicEvents` / `getEventAvailability` — eigene Mechanik (visibility,
  allow_public_registration).
- `findAppointmentsForClient` — Client-Portal, eigener Filter über
  `client_id`-Match.

## Non-Goals

- **Frontend-UX-Anpassungen**: Tabellen, Karten, Listen-Komponenten bleiben
  identisch. Restricted-View-Termine erscheinen heute schon mit
  `'Termin belegt'`; List-Endpoints liefern künftig weniger Items, das ist
  für die UI transparent.
- **Migration historischer Daten**: Cases ohne `department_id` bleiben
  ohne. Backward compatible — der Legacy-Fallback bleibt aktiv.
- **Multi-Department-Hierarchien** (`departments.parent_id`-Vererbung):
  out of scope. Wenn parent-child-Vererbung nötig wird, separate Spec.
- **Audit-Trail / Cascade-Filter**: nicht Teil dieser Spec — siehe
  `appointments.service.ts::softDeleteByCaseId` und Phase-2-E2E-Coverage
  in `apps/tagea-frontend-e2e/APPOINTMENTS_COVERAGE_PLAN.md`.
- **Performance-Tuning**: zusätzliche DB-Indizes auf
  `cases.department_id`, `clients.department_id` und
  `appointment_participants.case_id` werden ggf. später in einem separaten
  Performance-PR betrachtet.

## Test-Coverage-Anker

Existierende E2E-Specs unter `apps/tagea-frontend-e2e/src/tests/appointments/`:

- `einrichtungs-berater-sees-only-own-department-appointments.spec.ts` —
  Calendar-Restricted-View-Pattern (✅ aktiv).
- `traegeradmin-bypasses-department-filter.spec.ts` — Tenant-Admin-Bypass
  (✅ aktiv).
- `personalverwalter-cannot-list-appointments.spec.ts` — Auth-Layer-Block
  (✅ aktiv).

Mit Implementation der Spec sollen folgende Tests dazukommen:

- `appointments-list-hides-foreign-department.spec.ts` — `GET /appointments`
  mit Hide-Modus.
- `appointments-minimal-hides-foreign-department.spec.ts` — Picker-Test.
- Konsistenz-Test: gleicher Termin → Calendar zeigt "Termin belegt", List
  zeigt gar nichts.

Für den Staff-Participant-Self-Bypass (added 2026-05-05):

- `einrichtungs-berater-staff-participation-grants-foreign-department-via-case.spec.ts` —
  Berater im Dept-A sieht Termin mit Case in Dept-B unmaskiert, weil Staff-Participant.
- `einrichtungs-berater-staff-participation-grants-foreign-department-via-client.spec.ts` —
  gleiche Regel, aber Klient-Department-Fallback (kein Case).
- `einrichtungs-berater-created-by-alone-does-not-bypass-department.spec.ts` —
  Tripwire: `created_by_employee_id` ohne Staff-Participant gibt KEINEN Bypass.
- `einrichtungs-berater-without-staff-participation-stays-hidden.spec.ts` —
  Negative Sanity: ohne Staff-Participant + ohne Department-Match bleibt der
  Termin versteckt.
