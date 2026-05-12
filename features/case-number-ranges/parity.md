# Parity: Case Number Ranges

## Backend

- **Status:** ✅ Implemented
- **Path:** `apps/tagea-backend/src/cases/services/number-range.service.ts`, `apps/tagea-backend/src/cases/controllers/cases.controller.ts`
- **Tests:** `apps/tagea-backend/src/cases/services/__tests__/number-range.service.spec.ts` (if present)

## Angular

- **Status:** 🚧 Settings UI (Träger-admin)
- **Path:** `apps/tagea-frontend/src/app/pages/settings-page/...` (Case-numbers section)

## Flutter

- **Status:** ⏳ Not ported (admin-only Settings, low priority for mobile)

## Known Divergences

- Auto-initialization is a backend-side guarantee — neither frontend has any awareness of it. They simply call `POST /institutions/:id/cases` and trust that the server provisions the number range on demand.

## Port Log

| Date       | Who      | What                                                                                              |
| ---------- | -------- | ------------------------------------------------------------------------------------------------- |
| 2026-05-05 | baumgart | Spec retrofitted from existing implementation; auto-init contract documented after Sentry triage |
