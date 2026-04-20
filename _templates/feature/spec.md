# Feature: <Name>

> **Status:** ⏳ Planned
> **Owner:** <name>
> **Last updated:** YYYY-MM-DD

## Vision (Elevator Pitch)

<1-2 sentences: What can the user do now that they couldn't before? Why does it matter?>

## User Stories

- As a **<role>** I want to **<action>** so that **<benefit>**.

## Acceptance Criteria

> Given/When/Then — observable behavior, phrased platform-agnostically.

- [ ] **Given** … **When** … **Then** …

## UI States

| State             | When? | What does the user see? | A11y notes |
| ----------------- | ----- | ----------------------- | ---------- |
| Initial / Loading |       |                         |            |
| Empty             |       |                         |            |
| Populated         |       |                         |            |
| Error             |       |                         |            |
| Offline           |       |                         |            |

## Flows

<Mermaid diagram or numbered steps. Avoid UI screenshots that go stale — prefer abstract state transitions.>

## Non-Goals

<What is explicitly _not_ covered? Prevents scope creep during porting.>

## Edge Cases

- <Empty lists, missing permissions, race conditions, etc.>

## Permissions & Tenant/Institution

- **Required roles:** <e.g. Client, Staff, Organizer>
- **Institution context:** <Is `institution_id` required? How is the active tenant resolved?>
- **Backend access checks:** <Which server-side permissions apply? What must the frontend handle (401/403)?>

## Notifications (Push / In-App)

- **Triggers:** <Which server events fire notifications for this feature?>
- **Notification types:** <e.g. `APPOINTMENT_INVITATION`, `APPOINTMENT_REMINDER`>
- **Deep link:** <Where does the user land when tapping the notification?>
- **Dismiss behavior:** <Is the notification marked after interaction? Reminder suppression?>

## i18n Keys

<List of translation keys used — or link to central i18n file. User-facing strings stay in German.>

## Offline Behavior

<Flutter-specific. What happens without network? Local cache? Request queueing?>

## References

- **Angular implementation:** `apps/tagea-frontend/src/app/...`
- **E2E tests:** `apps/tagea-frontend-e2e/src/...`
- **Backend endpoints:** see [contracts.md](./contracts.md)
