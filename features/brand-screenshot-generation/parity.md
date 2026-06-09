# Parity: Brand Screenshot Generation

> Platform parity for brand-manager admin features (Flutter port is not in scope — brand-manager is web-only).

| Platform   | Status                | Notes                                                  |
| ---------- | --------------------- | ------------------------------------------------------ |
| brand-manager-ui (Angular) | ⏳ Planned | V1 implementation pending                              |
| tagea-frontend (Capacitor) | ⏳ Planned | Screenshot-mode bootstrap + Angular config "screenshot" |
| Flutter (tagea-flutter)    | N/A      | Brand-manager UI is web-only, not ported              |

## Angular paths (once implemented)

- **brand-manager backend module:** `apps/brand-manager/src/app/screenshots/`
- **brand-manager-ui module:** `apps/brand-manager-ui/src/app/screenshots/`
- **tagea-frontend bootstrap tweak:** `apps/tagea-frontend/src/main.ts` + screenshot config in `project.json`
- **GitHub workflow:** `.github/workflows/mobile-screenshots.yml`
- **Fastlane lanes:** `apps/tagea-frontend/ios/App/fastlane/Fastfile` + `apps/tagea-frontend/android/fastlane/Fastfile`
