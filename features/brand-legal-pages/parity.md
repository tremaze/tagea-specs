# Parity: Brand Legal Pages

## Angular (brand-manager-ui)

- **Status:** 🚧 In progress
- **Path:** `apps/brand-manager-ui/src/app/brands/brand-editor/steps/legal-step.component.ts`
- **E2E:** none (admin-only feature; public page tested via direct HTTP)

## Backend (brand-manager NestJS)

- **Status:** 🚧 In progress
- **Path:** `apps/brand-manager/src/app/brands/legal-pages.controller.ts`

## Flutter

- **Status:** N/A — branded mobile apps consume the public URL via WebView / external browser; no native port required.

## Known Divergences

- The legal pages live on the brand-manager service host (e.g. `bm.example.com`), not on the user-facing app domain. Mobile apps link out to those URLs.
- The public page is server-rendered HTML (no SPA), unlike most other tagea pages.

## Port Log

| Date       | Who      | What         |
| ---------- | -------- | ------------ |
| 2026-05-05 | ltoenjes | Spec created |
