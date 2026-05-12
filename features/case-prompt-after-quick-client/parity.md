# Parity: Case Prompt After Quick-Client

## Angular

- **Status:** 🚧 In progress
- **Path:**
  - `apps/tagea-frontend/src/app/components/appointment-dialog-v2/appointment-dialog-v2.component.ts` (orchestration)
  - `apps/tagea-frontend/src/app/components/quick-create-client/quick-create-client.component.ts` (existing — emits new client)
  - `apps/tagea-frontend/src/app/components/quick-create-case/quick-create-case.component.ts` (new)
- **E2E:** `apps/tagea-frontend-e2e/src/tests/appointments/einrichtungs-berater-quick-creates-client-and-case.spec.ts`

## Flutter

- **Status:** ⏳ Planned
- **Path:** `lib/features/appointments/...` _(in tagea-flutter repo, follow-up after Flutter QuickCreate-Client lands)_
- **Integration tests:** `integration_test/appointments/...`

## Known Divergences

- The Angular implementation uses `MatDialog` for both the confirm prompt and the QuickCreateCase side panel. Flutter ports may use `showDialog` + a sheet pattern more idiomatic to Material on mobile — the *behavior* (gated prompt, slim form, sequential POSTs) must match, the *widgets* may differ.

## Port Log

| Date       | Who                  | What         |
| ---------- | -------------------- | ------------ |
| 2026-05-05 | baumgart@tremaze.de  | Spec created |
