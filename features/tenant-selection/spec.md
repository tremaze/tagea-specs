# Feature: Tenant Selection (3 Eingangsbühnen)

> **Status:** ✅ Web-Pfade live. Spec aktualisiert für die jetzige Architektur.
> **Owner:** Sven Baumgart
> **Last updated:** 2026-05-03

## Vision (Elevator Pitch)

Tagea hat **drei Eingangsbühnen** in die App, abhängig davon, wie der Nutzer reinkommt — eine pro Eingangstür, jede mit eigenem Zweck:

1. **Onboarding Wizard** — einmaliges App-First-Run-Onboarding in der nativen Capacitor-App. Träger wählen, Konto erstellen, fertig.
2. **Cloud Discovery** — Web-Verzeichnis auf `tagea.de` (oder analoge Cloud-Builds). Doctolib-Logik: User sucht Träger, klickt, landet auf der Tenant-Homepage. Kein Konto-Zwang.
3. **Tenant Homepage** — Träger-spezifische Startseite (Custom-Domain `<slug>.tagea.de` oder Custom-Domain `caritas-hamm.de`, plus Post-Pick aus Discovery oder Wizard). Zeigt Themen, ermöglicht direkte Terminbuchung als Gast oder mit Konto.

**Web-Pfade folgen Doctolib:** Termin-zuerst, Account optional, niedrige Schwelle. **App-Pfad** (Wizard) ist die einzige Stelle mit Pflicht-Konto, weil die native App ohne Tenant + Konto nicht funktionieren kann (Push, Termin-Sync, Chat).

## User Stories

### Native App (Onboarding Wizard)

- Als **Erst-Nutzer der nativen App** möchte ich **einen Träger auswählen und ein Konto anlegen**, damit ich **die App regulär nutzen kann**.
- Als **Bestandsnutzer auf neuem Gerät** möchte ich **direkt zur Anmeldung springen**, damit mein **Profil-Tenant nach dem Login automatisch übernommen wird** und ich den Wizard nicht erneut durchlaufen muss.

### Web (Cloud Discovery)

- Als **Web-Erstbesucher** möchte ich **meine Beratungsstelle aus einer durchsuchbaren Liste wählen**, damit ich **direkt auf ihrer Träger-Homepage einen Termin buchen kann** — ohne vorher ein Konto anlegen zu müssen.
- Als **Bestandsnutzer mit Konto** möchte ich **„Anmelden" oben rechts klicken**, damit ich **mein Dashboard öffne** ohne den Discovery-Schritt.

### Web (Tenant Homepage)

- Als **Web-Nutzer mit klarem Träger** (über Subdomain, Custom-Domain oder vorherige Auswahl) möchte ich **direkt eine Themen-Liste sehen**, damit ich **in zwei Klicks einen Termin buche**.
- Als **Web-Nutzer in akuter Belastung** möchte ich **anonym buchen können**, damit ich **sofort Hilfe bekomme** ohne meine Identität preiszugeben.
- Als **wiederkehrender Web-Nutzer** möchte ich **„Konto erstellen" im Header oder nach Buchung anbieten**, damit ich **meine Termine später verwalten kann** — aber als optionalen Schritt, nicht als Hürde.

## Routing-Architektur

| Route | Component | Guard | Wer sieht das? |
|---|---|---|---|
| `/onboarding` | `OnboardingWizardComponent` | `nativeOnlyGuard` (Web → /select-tenant) | Native App ohne persistierten Tenant |
| `/select-tenant` | `CloudDiscoveryComponent` | `webOnlyGuard` (Native → /onboarding) | Web-Cloud-Build ohne persistierten Tenant |
| `/welcome` | `LandingPageComponent` (Dispatcher) | `redirectIfAuthenticatedGuard` | Hat Tenant: TenantHomepage. Hat keinen: generisches Tagea-Welcome |
| `/` (Root) | `rootRedirectGuard` | — | Authenticated → /dashboard. cloudPickerRequired → /select-tenant oder /onboarding. Sonst → /welcome |

**Build-Klassifikation** in `TenantResolutionService.resolve()`:

| Build-Typ | Erkennung | Picker-Logik |
|---|---|---|
| Single-Tenant Native | `brand-config.json.nativeTenantId` | Nie Picker — Tenant ist hartcodiert |
| Cloud Native | `brand-config.json.cloudGroupId` | `cloudPickerRequired = true` wenn kein Tenant persistiert |
| Custom-Domain Web | Hostname matcht Tenant-Domain | resolved via `/by-domain` → setzt Tenant + `shouldShowLandingPage` |
| Standard Web | Hostname in Cloud-Liste, kein DEV-Hack | Nie Picker — `_resolved.set(true)`, `tenantInfo` bleibt leer |

Plus DEV-Hack `?cloudGroup=<idOrSlug>` URL-Param + localStorage `tagea.dev.cloudGroupId`, **gegated mit `if (!environment.production)`**.

## Bühne 1 — Onboarding Wizard (`/onboarding`)

5-Stage-Flow für native App-First-Run.

| # | Stage | Hero (links Desktop / oben Mobile) | Right-Pane Inhalt |
|---|-------|-----------------------------------|-------------------|
| 1 | `select` | „Willkommen bei Tagea" | Sticky Search-Card + Träger-Liste |
| 2 | `confirm` | „Schritt 2 von 5" | Tenant-Card + 3 Value-Props + Weiter / Anderer Träger |
| 3 | `account` | „Schritt 3 von 5" | Reactive Form: Vorname/Nachname/E-Mail/Passwort/Einrichtung/AGB |
| 4 | `verify` | „Schritt 4 von 5" | Mail-Icon + Email-Anzeige + Resend + „Ich habe bestätigt" |
| 5 | `done` | „Geschafft" | Check + Welcome + „Termin buchen" / „Beraterin schreiben" (jeweils Login) |

**Stepper-Navigation:** Past-Stages klickbar (außer von verify/done aus — forward-only). Auch „Zurück"-Pfeil oben links im rechten Pane.

### Acceptance Criteria — Wizard

- [ ] **Given** native App-Build mit `cloudGroupId` und keinem persistierten Tenant, **when** App startet, **then** wird `/onboarding` mit Stage `select` geladen.
- [ ] **Given** persistierte Träger-Auswahl liegt vor und gehört noch zur konfigurierten Cloud-Group, **when** App startet, **then** wird der Wizard übersprungen — App lädt direkt mit Branding des Trägers.
- [ ] **Given** Wizard auf Stage `select`, **when** Nutzer einen Träger antippt, **then** wechselt der Wizard zu Stage `confirm` und zeigt Tenant-Card mit Logo + Name + Standort.
- [ ] **Given** Stage `confirm`, **when** Nutzer „Anderer Träger" tippt, **then** wechselt der Wizard zurück zu `select` ohne Tenant-Auswahl zu persistieren.
- [ ] **Given** Stage `account`, **when** Vorname, Nachname, E-Mail, Passwort und AGB-Checkbox alle valide sind, **then** ist der „Weiter"-Button aktiv und ruft `PublicRegistrationService.register()`.
- [ ] **Given** Stage `verify`, **when** Nutzer „E-Mail erneut senden" tippt, **then** wird `PublicRegistrationService.resendVerification()` ausgelöst.
- [ ] **Given** Stage `verify`, **when** Nutzer „Ich habe meine E-Mail bestätigt" tippt, **then** wechselt der Wizard zu `done` (ohne tatsächliche Server-Verifikation — Happy-Path-Annahme).
- [ ] **Given** Stage `done`, **when** Nutzer „Termin buchen" oder „Beraterin schreiben" tippt, **then** ruft die App `applyCloudSelection` und startet `UnifiedAuthService.login()`.

## Bühne 2 — Cloud Discovery (`/select-tenant`)

Web-only Verzeichnis-Seite. Eingang für `tagea.de`-artige Cloud-Builds und für DEV-Tests.

### Layout

- **Header:** Tagea-Brand-Lockup links, Outlined „Anmelden"-Button rechts (Desktop hat zusätzlich „So funktioniert's" + „Für Träger" Textlinks)
- **Hero:** lila Verlauf (`--brand-primary-dark` → `--brand-primary` → `rgb(93, 70, 154)`), Eyebrow „Beratung · Termine · Vertraulich", H1 „Welche Beratungsstelle begleitet Sie?", Lead-Text, dekorative Radial-Gradients
- **Floating Search-Card:** überlappt den Hero (negativer Margin), Clear-Button erscheint nur bei Eingabe
- **Quick-Filter-Pills (Desktop only):** Schwangerschaftsberatung / Sucht / Familienberatung / Schulden / Soziale Hilfe — füllen das Suchfeld
- **Tenant-Grid:** `auto-fill, minmax(360px, 1fr)` Desktop / single-column Mobile, Hover `translateY(-2px)` + Brand-Color-Border
- **„So funktioniert's" (Desktop only):** drei Schritte
- **Footer:** Copyright + Telefonseelsorge

### Acceptance Criteria — Cloud Discovery

- [ ] **Given** Web-Build mit `cloudGroupId` + kein Tenant persistiert, **when** Nutzer hit `/`, **then** redirected `rootRedirectGuard` auf `/select-tenant`.
- [ ] **Given** `/select-tenant` ist geladen, **when** der Nutzer ihn betrachtet, **then** sieht er Header + Hero + Search-Card + Tenant-Grid mit allen aktiven Trägern der Cloud-Group, alphabetisch sortiert.
- [ ] **Given** Suchfeld leer, **when** Default-View geladen ist, **then** zeigt Eyebrow „{N} Träger" mit der Gesamtzahl.
- [ ] **Given** Nutzer tippt mindestens 1 Zeichen, **when** das Debounce-Fenster (300 ms) abläuft, **then** wird `searchTenants(slug, query)` aufgerufen und das Eyebrow zeigt „{N} Treffer".
- [ ] **Given** Server liefert leere Liste für eine Suche, **when** Nutzer das Ergebnis sieht, **then** zeigt der Picker den Empty-State mit `search_off`-Icon und „Keine Treffer für „{Query}"".
- [ ] **Given** Server antwortet mit 5xx oder Netzwerkfehler, **when** die Liste fehlschlägt, **then** zeigt der Picker einen Fehler-State mit Retry-Button.
- [ ] **Given** ein Träger hat einen `logoUrl`, **when** die Tenant-Card gerendert wird, **then** wird das Logo via `<img>` angezeigt.
- [ ] **Given** ein Träger hat keinen `logoUrl`, **when** das Avatar gerendert wird, **then** wird ein typisierter Initialen-Avatar mit Brand-Palette-Farben (`brandId`-basiert) angezeigt.
- [ ] **Given** Nutzer tippt eine Träger-Card, **when** der Selection-Vorgang läuft, **then** ruft `applyCloudSelection(tenantInfo)` und navigiert zu `/welcome`.
- [ ] **Given** Nutzer tippt „Anmelden" im Header, **when** Keycloak verfügbar, **then** wird `UnifiedAuthService.login()` gestartet.

## Bühne 3 — Tenant Homepage (`/welcome` mit resolved Tenant)

Träger-spezifische Doctolib-Style Landing.

### Layout

- **Header:** Träger-Avatar + Name + Stadt-Sub (Desktop), „Konto erstellen" Link + Outlined „Anmelden"-Button rechts (beide → Keycloak)
- **Hero links (Desktop) / oben (Mobile):** Träger-Accent-Verlauf (`primaryColor` mit `color-mix()` derived dark/light), Träger-Lockup, Eyebrow „Willkommen bei {Name}", H1 (Claim), Lead-Text, Notfall-Hinweis als Hero-Card unten (Desktop)
- **Themen-Pane rechts:** Eyebrow „Beratungsangebote", H2 „Womit können wir Ihnen helfen?", Themen-Liste mit Icon + Name + optional Description, Anonym-Hinweis darunter
- **Mobile Notfall-Banner:** wenn Mobile, sitzt das Notfall-Hinweis-Banner unter dem Hero, nicht IM Hero
- **Locations-Strip:** Cards mit Pin + Name + Adresse + Öffnungszeiten (heute Platzhalter, künftig aus Backend)
- **„So einfach geht's":** 4 Steps (Thema → Termin → Bestätigen → Beratung)
- **Footer:** Träger-Name + Datenschutz/Impressum + dezentes „Powered by Tagea"

### Booking-Flow (inline auf TenantHomepage)

Wenn der Nutzer ein Thema klickt, wird die TenantHomepage-Bühne **vollständig durch den BookingFlow ersetzt** (`bookingOpen = true`). Der BookingFlow ist ein 5-Step-Doctolib-Flow:

| # | Step | Inhalt |
|---|------|--------|
| 0 | Thema | Liste der Themen — übersprungen wenn `initialThemeId` gesetzt |
| 1 | Datum & Uhrzeit | Akkordion-Liste der Tage mit Slot-Buttons. Slot zeigt **Uhrzeit + Standort inline** (`14:30 · Köln-Mitte`) |
| 2 | Beratungsart | Gefiltert per `slot.allowedSettings`: vor-ort / video / telefon / chat |
| 3 | Anmerkungen + Kontakt | Gast/Konto-Toggle, Vorname / Nachname / E-Mail / Telefon-Felder, Notizen, Submit |
| 4 | Bestätigt | Check + Confirmation-Mail-Hinweis + Account-Upsell (Klick → Keycloak) + Schließen |

Stepper auf Desktop (Pills mit Brand-Akzent), Summary-Card rechts (Desktop) / unten (Mobile).

### Acceptance Criteria — Tenant Homepage

- [ ] **Given** Tenant ist resolved (custom domain ODER post-cloud-pick ODER native single-tenant), **when** `/welcome` lädt, **then** rendert `LandingPageComponent` den Dispatcher, der `<app-tenant-homepage>` einsetzt.
- [ ] **Given** TenantHomepage rendert, **when** der Hero gezeigt wird, **then** ist der Verlauf die Tenant-Akzentfarbe (`tenantInfo.primaryColor` oder `--brand-primary` Fallback).
- [ ] **Given** TenantHomepage rendert, **when** der Themen-Pane lädt, **then** ruft die Component `getTenantThemes(slug, tenantId)` und zeigt während des Loads einen Spinner.
- [ ] **Given** der Tenant hat 0 Institutionen oder 0 Templates, **when** Themen geladen, **then** zeigt der Pane „Aktuell sind keine Beratungsangebote freigeschaltet."
- [ ] **Given** der Themen-Fetch schlägt fehl, **when** Error eingetreten, **then** zeigt der Pane „Themen konnten nicht geladen werden." mit Retry-Button.
- [ ] **Given** Themen geladen, **when** Nutzer ein Thema klickt, **then** öffnet sich der BookingFlow inline (TenantHomepage wird ersetzt) mit `initialThemeId` gesetzt.
- [ ] **Given** BookingFlow auf Step Datum, **when** Slots laden, **then** ruft die Component `getTenantThemeSlots(slug, tenantId, theme)` und zeigt Loading/Empty/Error-States.
- [ ] **Given** BookingFlow auf Step Beratungsart, **when** der Step rendert, **then** sind nur Typen sichtbar, deren `id` in `slot.allowedSettings` enthalten ist.
- [ ] **Given** BookingFlow auf Step Anmerkungen, **when** Vorname (≥2), Nachname (≥2) und E-Mail (mit `@`) ausgefüllt sind, **then** ist der „Termin verbindlich buchen"-Button aktiv.
- [ ] **Given** Nutzer „Termin verbindlich buchen" klickt, **when** Submit läuft, **then** wird `GuestBookingService.createGuestBooking(payload)` mit allen Feldern aufgerufen und der Submit-Button zeigt Spinner.
- [ ] **Given** Submit ist erfolgreich, **when** Backend OK liefert, **then** wechselt der Flow auf Step Bestätigt mit Account-Upsell.
- [ ] **Given** Submit schlägt fehl, **when** Backend Error liefert, **then** wird der Submit-Spinner ausgeblendet und ein Fehler-Hinweis über dem Button gezeigt.
- [ ] **Given** Done-Step, **when** Nutzer „Konto erstellen" im Upsell klickt, **then** wird `UnifiedAuthService.login()` aufgerufen (Keycloak-Redirect).
- [ ] **Given** TenantHomepage Header, **when** Nutzer „Anmelden" klickt, **then** wird `UnifiedAuthService.login()` aufgerufen.

## Flows

```mermaid
flowchart TD
    A[App start] --> B{Build type}

    B -- nativeTenantId --> Z1[Tenant resolved → /welcome → TenantHomepage]
    B -- cloudGroupId + native --> Cn{persisted tenant?}
    B -- cloudGroupId + web --> Cw{persisted tenant?}
    B -- custom domain --> Z1
    B -- standard web --> SW[/welcome → LandingPage no-tenant card → Anmelden]

    Cn -- yes --> Z1
    Cn -- no --> ON[/onboarding → Wizard]
    Cw -- yes --> Z1
    Cw -- no --> CD[/select-tenant → Cloud Discovery]

    ON --> ON1[select → confirm → account → verify → done → Login]
    CD --> CDP[User picks tenant → applyCloudSelection → /welcome]
    CDP --> Z1

    Z1 --> TH[Themes pane loaded]
    TH --> TT[User picks theme → BookingFlow opens]
    TT --> BF[Date → Type → Notes → Submit → Done]
    BF --> AC{Account upsell?}
    AC -- yes --> KC[Keycloak login]
    AC -- no --> CL[Close → back to TenantHomepage]
```

## UI States

| Component | State | When | Render |
|---|---|---|---|
| OnboardingWizard | `loading` | `loadGroup()` läuft | Zentrierter Spinner |
| OnboardingWizard | `select` | Default | Hero + Search + Liste |
| OnboardingWizard | `confirm/account/verify/done` | Stage-State | Stage-spezifische rechte Pane + Hero-Eyebrow „Schritt N von 5" |
| CloudDiscovery | `loading` | Group lädt | Zentrierter Spinner |
| CloudDiscovery | `groupLoadFailed` | `getGroup()` 4xx/5xx | Volles Error-Layout mit Retry |
| CloudDiscovery | `default` | Suche leer | „{N} Träger"-Eyebrow + Tenant-Grid |
| CloudDiscovery | `searching` | Search.loading | Spinner zentriert in Results |
| CloudDiscovery | `results` | Server liefert ≥1 Treffer | „{N} Treffer"-Eyebrow + Tenant-Grid |
| CloudDiscovery | `empty` | Server liefert 0 Treffer | search_off + „Keine Treffer für „X"" |
| CloudDiscovery | `error` | Search-HTTP-Fehler | cloud_off + Retry |
| TenantHomepage | `themes-loading` | `getTenantThemes` läuft | Spinner im Themen-Pane |
| TenantHomepage | `themes-error` | Fetch fehlgeschlagen | cloud_off + Retry |
| TenantHomepage | `themes-empty` | 0 Themen | event_busy + „Aktuell keine Angebote" |
| TenantHomepage | `themes-loaded` | ≥1 Thema | Themen-Liste klickbar |
| BookingFlow | `theme` | Step 0 | Themen-Liste |
| BookingFlow | `slots-loading` | Step 1, getTenantThemeSlots läuft | Spinner |
| BookingFlow | `slots-error` | Step 1, Fetch fehlgeschlagen | cloud_off + Retry |
| BookingFlow | `slots-empty` | Step 1, 0 Slots | event_busy + „Keine freien Termine" |
| BookingFlow | `slots-loaded` | Step 1, ≥1 Slot | Day-Akkordion |
| BookingFlow | `type` | Step 2 | Type-Grid (gefiltert per allowedSettings) |
| BookingFlow | `type-empty` | Step 2, 0 Types | „Keine Beratungsart vorkonfiguriert" |
| BookingFlow | `notes` | Step 3 | Form |
| BookingFlow | `submitting` | Submit läuft | Submit-Button mit Spinner |
| BookingFlow | `submit-error` | Backend-Fehler | Error-Banner über Button |
| BookingFlow | `done` | Step 4 | Confirmation + Account-Upsell + Close |

## Non-Goals (aktuelle Phase)

- **QR-Code-Scan und Einladungscode-Eingabe** — siehe „Künftige Phasen".
- **Server-getriebene „Häufig gewählt"-Liste** — clientseitig hartcodiert oder Top-N aus Search.
- **Multi-Tenant-Logins** (ein Konto bei mehreren Trägern gleichzeitig) — Single-Slot-Persistenz, Wechsel via clear + neu.
- **Inline-Registration in Tenant Homepage** — alle Account-CTAs gehen via Keycloak-Redirect (Architektur-Entscheidung; Inline-Form lebt nur im Wizard, App-only).
- **Eigene Themen pro Einrichtung in der UI** — Themen werden tenant-weit aggregiert und dedupliziert.
- **Mitarbeiter-Registrierung** — `EmployeeRegistrationFormComponent` ist entfernt; Mitarbeiter werden via Tenant-Admin angelegt.

## Künftige Phasen

- **QR-Code-Scan** (`POST /public/qr-code/:token`) — Kameraaufruf, automatische Träger-Auswahl bei erfolgreichem Scan.
- **Einladungscode-Eingabe** (`POST /public/invitation-code/:code`) — manuelle Code-Eingabe für per Mail/Brief versandte Codes.
- **Real-Locations-Daten** in TenantHomepage — heute Platzhalter, sobald `tenant.locations` öffentlich ausgeliefert wird.
- **Tenant-themed Booking-Flow data wiring on Custom-Domain** — Custom-Domain-Tenants (`caritas-hamm.de`) haben heute keinen `cloudGroupSlug`; Booking-Endpoints brauchen aber slug. Backend-Erweiterung nötig (entweder slug auf Custom-Domain-Tenants setzen oder Booking-Endpoints ohne Group-Scope erlauben).

## Edge Cases

- **Persistierter Tenant ist deaktiviert** (`status != 'active'`): Backend liefert 404 → `clearCloudSelection()` → Wizard/Discovery erneut.
- **Persistierter Tenant aus anderer Cloud-Group**: Backend liefert 200 mit abweichendem `tenantGroupId` → clear + Wizard/Discovery.
- **Doppeltes Tap auf Träger-Card** in Discovery oder Wizard: `selecting`-Signal lockt UI; nur erste Selection wird verarbeitet.
- **Doppeltes Tap auf Submit** im BookingFlow: `submitting`-Signal lockt; zweiter Tap wird ignoriert.
- **Tenant ohne Institutionen** in TenantHomepage: `getTenantThemes` gibt `[]` zurück → Empty-State im Themen-Pane.
- **Slot-Pick wechselt allowedSettings**: Wenn vorher gewählter Type nicht mehr verfügbar, wird `selectedType` auf null zurückgesetzt — User picked sauber neue Auswahl.
- **iOS Safe-Area**: Container respektieren `env(safe-area-inset-*)`.
- **HTTP 429 (Rate-Limit)** auf `POST /public/booking`: Backend schickt deutsche Fehlermeldung, BookingFlow zeigt sie im `submit-error`-State.

## Permissions & Tenant/Institution

- **Required roles:** Keine — alle Routen sind `@Public()`.
- **Institution context:** Im Wizard wird Einrichtung als Pflichtfeld gesetzt. Im BookingFlow leitet sich `institutionId` automatisch aus dem gewählten Slot ab.
- **Backend access checks:**
  - Cloud-Group: `is_cloud_group = true` und `is_active = true`.
  - Tenants: `status = 'active'`.
  - Booking: Rate-Limit pro IP (5 Buchungen / Stunde).

## Notifications (Push / In-App)

- **Triggers:** Buchungsbestätigung per E-Mail nach erfolgreichem `POST /public/booking`.
- **Notification types:** Email an Klient + interne Notification an zuständigen Berater (Standard-Termin-Notification-Pfad).
- **Deep link:** Confirmation-Mail enthält Termin-Detail-Link (für Gast: Public-Confirmation-Page; für Account: Tagea-App-Termin-Detail).

## i18n Keys

User-facing-Strings stehen in der jetzigen Phase inline auf Deutsch (de). Schlüssel-Auswahl für die spätere Migration nach `apps/tagea-frontend/src/assets/i18n/de.json`:

```
cloudDiscovery.heroTitle             "Welche Beratungsstelle begleitet Sie?"
cloudDiscovery.heroLead              "Tagea verbindet Sie mit Beratungsstellen ..."
cloudDiscovery.searchPlaceholder     "Träger oder Stadt suchen ..."
cloudDiscovery.popularEyebrow        "{{count}} Träger"
cloudDiscovery.matchEyebrow          "{{count}} Treffer"
cloudDiscovery.emptyTitle            "Keine Treffer für „{{query}}""
cloudDiscovery.howItWorksTitle       "In drei Schritten zum Termin"

tenantHomepage.themesEyebrow         "Beratungsangebote"
tenantHomepage.themesTitle           "Womit können wir Ihnen helfen?"
tenantHomepage.themesEmpty           "Aktuell sind keine Beratungsangebote freigeschaltet."
tenantHomepage.anonymousTitle        "Auch anonym buchbar"
tenantHomepage.locationsEyebrow      "So erreichen Sie uns"
tenantHomepage.howItWorksTitle       "In vier Schritten zum Termin"
tenantHomepage.emergencyTitle        "Sofort Hilfe nötig?"

bookingFlow.title                    "Termin buchen"
bookingFlow.stepTheme                "Thema"
bookingFlow.stepDate                 "Datum & Uhrzeit"
bookingFlow.stepType                 "Beratungsart"
bookingFlow.stepNotes                "Anmerkungen"
bookingFlow.summaryTitle             "Ihre Buchungsdetails"
bookingFlow.submitButton             "Termin verbindlich buchen"
bookingFlow.doneTitle                "Termin gebucht"
bookingFlow.upsellTitle              "Diese Buchung im Konto verwalten?"

wizard.stepperLabel                  "Schritt {{n}} von 5"
wizard.confirmTitle                  "Bestätigen Sie Ihre Auswahl"
wizard.accountTitle                  "Konto erstellen"
wizard.verifyTitle                   "Bestätigen Sie Ihre E-Mail"
wizard.doneTitle                     "Geschafft"

common.signIn                        "Anmelden"
common.createAccount                 "Konto erstellen"
common.switchTenant                  "Anderen Träger wählen"
common.retry                         "Erneut versuchen"
```

Übersetzungen für die 16 weiteren Sprachen folgen, sobald die deutschen Strings final abgenommen sind.

## Offline Behavior

- **Wizard und Cloud Discovery** sind offline nicht öffenbar (sie brauchen den Cloud-Group-Fetch).
- **Tenant Homepage**: Wenn der Tenant bereits resolved ist (offline-cache hit), rendert die Hero-Sektion. Themen-Liste läuft in Empty/Error-State, weil `getTenantThemes` keinen Cache hat.
- **Native Persistenz**: Capacitor `Preferences` für `tagea.cloudTenant.selectedId`. Web: localStorage.

## Design Reference

- **Aktuelle Design-Bündel:**
  - `~/Downloads/design_handoff_tenant_selection/` (Variant B/C — Tenant Selection Wizard)
  - `/tmp/design_v3_cloud_discovery/tenant-selection/project/` (Cloud Discovery + Tenant Homepage + BookingFlow)
- **Tokens:** ausschließlich `--mat-sys-*` und `--brand-primary*` aus `apps/tagea-frontend/src/styles.scss`.
- **Material Icons verwendet:** `search`, `close`, `chevron_right`, `arrow_forward`, `arrow_back`, `login`, `account_circle`, `event_busy`, `event_note`, `cloud_off`, `error_outline`, `support`, `pregnant_woman`, `diversity_1`, `escalator_warning`, `health_and_safety`, `favorite`, `visibility_off`, `location_on`, `schedule`, `expand_more`, `check`, `check_circle`, `mark_email_read`, `info`, `shield`, `topic`, `calendar_today`, `event_available`, `celebration`.

## References

- **Onboarding Wizard:** `apps/tagea-frontend/src/app/pages/onboarding/onboarding-wizard.component.ts` + `wizard/{flow-hero,confirm-stage,account-stage,verify-stage,done-stage}.component.ts`
- **Cloud Discovery:** `apps/tagea-frontend/src/app/pages/cloud-discovery/cloud-discovery.component.ts`
- **Tenant Homepage:** `apps/tagea-frontend/src/app/pages/tenant-homepage/tenant-homepage.component.ts` + `booking-flow/booking-flow.component.ts`
- **/welcome Dispatcher:** `apps/tagea-frontend/src/app/pages/landing-page/landing-page.component.ts`
- **Frontend Services:**
  - `apps/tagea-frontend/src/app/services/public-cloud-group.service.ts`
  - `apps/tagea-frontend/src/app/services/public-tenant-group.service.ts`
  - `apps/tagea-frontend/src/app/services/guest-booking.service.ts`
- **Tenant Resolution:** `apps/tagea-frontend/src/app/core/tenant-resolution.service.ts`, `apps/tagea-frontend/src/app/core/cloud-tenant-storage.service.ts`
- **Routing:** `apps/tagea-frontend/src/app/routes/public.routes.ts`
- **Guards:** `apps/tagea-frontend/src/app/guards/{native-only,web-only,root-redirect,redirect-if-authenticated}.guard.ts`
- **Backend Controllers:**
  - `apps/tagea-backend/src/public-api/public-cloud-group.controller.ts`
  - `apps/tagea-backend/src/public-api/public-tenant.controller.ts`
  - `apps/tagea-backend/src/public-api/guest-booking.controller.ts`
- **E2E:** ⏳ noch keine Coverage. Vor Phase-1-Merge mindestens Smoke-Tests pro Bühne.
- **Backend endpoints:** see [contracts.md](./contracts.md)
