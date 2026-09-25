# Parity: Employee Profile

## Angular

- **Status:** ✅ Implemented
- **Path:** [`apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts`](../../../apps/tagea-frontend/src/app/pages/employee-profile/employee-profile.component.ts)

## Flutter

- **Status:** ⏳ Planned (M2 — no longer a non-goal)

## Port Log

| Date       | Who      | What                                                                                                                                                       |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | ltoenjes | Spec created (documentation only)                                                                                                                          |
| 2026-04-21 | ltoenjes | Drift audit: corrected guard dialog, removed custom-fields service, flagged disabled availability tab, added notification/preferences/delete-account flows |
| 2026-09-25 | Claude (M2-Specs) | Flutter status ❌ non-goal → ⏳; contracts verified against backend (`/employees/me*`, `POST /auth/me/change-password`, `GET /auth/password-policy`): fixed wrong paths (`/employees/me/change-password`, `/employees/me/password-policy`, `/notification-settings`, `/personal-preferences`), documented PATCH whitelist (date_of_birth/gender dropped), DTOs, errors, delete-own-account and password-change flows |
