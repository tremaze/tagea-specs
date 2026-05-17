# Parity: Personnel — Zeiterfassung

## Angular

- **Status:** ⏳ Planned
- **Path (to be added):**
  - `apps/tagea-frontend/src/app/pages/personnel/pages/personnel-zeiterfassung.component.ts` (HR-Tabelle)
  - `apps/tagea-frontend/src/app/pages/personnel/pages/personnel-zeiterfassung-queue.component.ts` (Approval-Queue)
  - `apps/tagea-frontend/src/app/pages/personnel/pages/personnel-meine-zeiten.component.ts` (Employee + Korrekturanfrage)
- **E2E (to be added):** `apps/tagea-frontend-e2e/src/personnel/zeiterfassung.spec.ts`

## Flutter

- **Status:** ❌ Non-goal für HR-Surfaces.
- **Status:** 🟡 Mögliche Read-only-Portierung von `/personal/meine-zeiten` als Mobile-Sicht — separat zu entscheiden.

## Known Divergences

- HR-Tabelle und Approval-Queue existieren nur im Web.
- Mobile-App benutzt weiterhin die existierende Vivendi-Bridge zum Stempeln.

## Port Log

| Date       | Who       | What         |
| ---------- | --------- | ------------ |
| 2026-05-16 | baumgart  | Spec created |
