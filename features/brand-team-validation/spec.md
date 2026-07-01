# Feature: Brand Team Validation

> **Status:** 🚧 Spec drafted — implementing
> **Owner:** ltoenjes
> **Last updated:** 2026-05-09

## Vision (Elevator Pitch)

Reject misconfigured Apple Developer Team IDs at every layer of the brand-manager — DTO, service, build trigger, and config emitter — so that an invalid team ID can never reach the iOS CI build, where it would fail with an unhelpful `xcodebuild` error.

The motivating incident: a brand was saved with the numeric App Store Connect "team_id" `6744736254` (an unrelated identifier exposed in the ASC web UI) where the alphanumeric Apple Developer Team ID `5H3U37UD3V` was needed. The misconfig passed validation and only failed at the iOS archive step — wasting CI minutes and human debugging time.

## User Stories

- As a **brand-manager admin** I want the form to reject obviously wrong team IDs (e.g. all-numeric) at input time so I can't save a misconfigured brand.
- As a **brand-manager admin** I want a clear hint that "Apple Developer Team ID" is **not** the same as the numeric "team_id" shown elsewhere in App Store Connect.
- As a **brand-manager admin** I want the system to verify against App Store Connect that the team ID matches the configured ASC credentials before I save, so a typo is caught immediately.
- As a **release operator** I want a build dispatch to fail fast with a clear backend error if the brand's team configuration is incomplete or stale, instead of waiting 30 seconds for a cryptic Xcode signing failure on a runner.

## Acceptance Criteria

### Format validation (Layer 1)

- [ ] **Given** a brand-manager API client, **When** it calls `POST /brands` or `PATCH /brands/:id` with a `teamId` that does not match `^(?=.*[A-Z])[A-Z0-9]{10}$`, **Then** the API responds 400 with the German error message `"Apple Developer Team ID erwartet (10 Zeichen, mind. ein Buchstabe). Du verwechselst sie evtl. mit der numerischen App Store Connect 'team_id' — die ist NICHT die richtige."`.
- [ ] **Given** the brand creation wizard's "Create New Team" flow, **When** the user types an all-numeric value into the Team ID field, **Then** an inline `mat-error` shows the same German hint and the "Create Team" button is disabled.
- [ ] **Given** the team detail page (new team), **When** the user types a value that does not match the regex, **Then** the form is invalid and the existing pattern error renders the German hint.
- [ ] **Given** a team admin calls `PUT /teams/:teamId` or `POST /teams/:teamId/api-key`, **When** the URL path parameter does not match `^(?=.*[A-Z])[A-Z0-9]{10}$`, **Then** the API responds 400 (consistent with brand DTO validation).

### Referential integrity (Layer 2)

- [ ] **Given** a `POST /brands` or `PATCH /brands/:id` request with `teamId: "ABCDEF1234"`, **When** no `Team` record exists for that ID, **Then** the API responds 400 with `"Team ABCDEF1234 ist im Brand Manager nicht angelegt. Bitte zuerst unter /teams anlegen."` (the existing 404 NotFound from `findOne` is reformatted to 400).
- [ ] **Given** a brand is updated to point at an existing Team, **When** that Team is later deleted, **Then** the next save of the brand fails with the same 400 (deletion does not cascade-clear `Brand.teamId` in this iteration — the next save catches it).

### ASC verification on save (Layer 3)

- [ ] **Given** a brand save where the resolved Team has ASC credentials and an uploaded `.p8`, **When** the save handler runs, **Then** it calls `AppStoreConnectService.verifyTeamId(token, brand.teamId)` and rejects with 400 if ASC reports a different team ID.
- [ ] **Given** a brand save where the resolved Team has no ASC creds yet (e.g. brand created before team setup is complete), **When** the save handler runs, **Then** the ASC check is **skipped silently** — Layers 1+2 still apply, but missing creds do not block saving (the team page is the right place to fix that).
- [ ] **Given** ASC is unreachable or returns 5xx, **When** the verification call fails with a non-mismatch error, **Then** the save is allowed (fail open) and the failure is logged at warn level — we don't want a transient ASC outage to block saves.

### Pre-flight build dispatch (Layer 4)

- [ ] **Given** a `POST /builds/...` request that triggers an iOS or `both` mobile build, **When** the brand's `teamId` is missing, malformed, or points to a non-existent Team, **Then** the dispatch responds with `success: false` and a German error message before any GitHub workflow is dispatched.
- [ ] **Given** the brand's Team exists but `team.agreementValid === false` (i.e. last `validate-all` reported a problem), **When** the build is iOS-targeting, **Then** the dispatch fails with `"Team {id} hat ein offenes App Store Connect Problem: {agreementError}"`.
- [ ] **Given** an Android-only build (`platform: 'android'`), **When** the team is misconfigured, **Then** the dispatch is **not** blocked — Android builds don't need iOS team data.

### Config emitter (Layer 5)

- [ ] **Given** a CI runner calls `GET /brands/:id/build-config` (the endpoint that produces `/tmp/brand-config/config.json`), **When** the brand has an iOS bundle ID configured but the `teamId` would fail Layer 1 or Layer 2 validation, **Then** the endpoint responds 422 (Unprocessable Entity) with a German error message — never a partial / malformed config.
- [ ] **Given** the same endpoint is called for a brand without any iOS bundle ID, **When** the brand has no `teamId` set, **Then** the response is unchanged — Android-only brands still work.

### Frontend UX (Layer 7)

- [ ] **Given** the brand creation wizard's team step, **When** the user sees the "Team ID" input, **Then** a help icon next to the field exposes a tooltip: `"Achtung: Apple Developer Team ID (10 Zeichen, alphanumerisch, z.B. 5H3U37UD3V) — NICHT die numerische 'team_id' aus App Store Connect (z.B. 6744736254)."`.
- [ ] **Given** the team-step input is invalid (regex fail), **When** the user moves focus away, **Then** the field shows a `mat-error` with the German hint.
- [ ] **Given** the team-detail edit page, **When** the user enters a malformed ID for a new team, **Then** the existing pattern error message updates to the new German wording.
- [ ] **Given** the brand editor's "Create New Team" panel, **When** the new team ID is invalid, **Then** the "Create Team" button is disabled.

## Format Definition

The Apple Developer Team ID — used in:

- Code signing (`DEVELOPMENT_TEAM` build setting in Xcode pbxproj)
- `match` provisioning profile branch names (`team-{teamId}` in the certs git repo)
- App Store Connect API `seedId` field on bundle IDs

— always conforms to **`^[A-Z0-9]{10}$` _with at least one letter_**, written as `^(?=.*[A-Z])[A-Z0-9]{10}$`.

The "at least one letter" constraint distinguishes it from the **numeric** App Store Connect "team_id" (e.g. `6744736254`) which is a separate identifier shown in some ASC contexts and is NOT a valid `DEVELOPMENT_TEAM` value. The incident on 2026-05-08 was caused by exactly this confusion.

If a future Apple team ID is observed without any letters, the regex must be relaxed and this section updated — but as of writing, no such team ID has been observed in 1500+ Apple Developer accounts referenced in the public ecosystem.

## Validation Layers (Defense in Depth)

| # | Layer | Where | Catches |
|---|-------|-------|---------|
| 1 | Format regex | `CreateBrandDto`, `UpdateBrandDto`, `UpdateTeamDto`, team URL param pipe | `6744736254` (all-digit), short/long values, lowercase, special chars |
| 2 | Team must exist | `BrandsService.create/update` | `teamId` pointing to a Team record that was never created in the brand manager |
| 3 | ASC verifyTeamId | `BrandsService.create/update` (when ASC creds present) | `teamId` that is well-formed but doesn't match the credentials' actual seedId |
| 4 | Pre-flight build dispatch | `MobileBuildTriggerService.validateBuildRequest` | Stale state at build time (e.g. team became invalid since last save) |
| 5 | Config emitter | `BrandsService.exportToBrandConfig`, `BrandsService.getBuildConfig` | Defense in depth — refuses to emit a config that would fail in CI even if Layers 1-4 were bypassed |
| 7 | Frontend pattern validators | `team-step.component.ts`, `team-detail.component.ts`, `brand-editor.component.ts` | Catches typos at input time, before API roundtrip |

Layer 6 (drift detection cron) is intentionally out of scope for this iteration — the existing `validate-all` admin action is the manual fallback. It can be added later.

## Non-Goals

- No automatic mutation: the system never auto-corrects a wrong team ID; it always rejects with a message.
- No cascade deletion: removing a Team does not auto-clear `Brand.teamId` on referencing brands. Affected brands fail to save until they pick a new team.
- No retry / backoff for ASC verification — if ASC is down, save proceeds (fail open). The next save attempt will re-check.
- No drift detection cron (Layer 6) in this iteration.
- No retroactive validation of existing brands. Existing rows that already violate the new rules are not migrated; the next save will surface the error.
- No new "search teams against ASC" feature. The brand admin still has to know which team they want.

## Edge Cases

- **Brand has no iOS bundle ID** (Android-only / cloud brand): `teamId` is allowed to be empty/null; Layers 2-5 are bypassed. Layer 1 still runs but only when a non-empty value is provided.
- **Team has ASC creds but no uploaded API key**: Layer 3 is skipped (verifyTeamId needs the .p8). Logged at debug level.
- **ASC returns no bundle IDs at all** (brand-new team): `verifyTeamId` returns null (cannot determine actual seedId) — save is allowed.
- **Two brands point at the same Team**: fully supported; this is the normal case (multi-brand per developer account is rare but exists).
- **Race condition**: two concurrent saves of the same brand both pass Layer 2 and Layer 3, then one wins. No data corruption — last-writer-wins on a single column.
- **CI running an old build that was queued before the brand was misconfigured**: out of scope. The CI uses whatever `/tmp/brand-config/config.json` is provided to it at dispatch time, and Layer 5 ensures the dispatched config is valid.

## Permissions & Tenant/Institution

- **Required roles:** brand-manager admin (no new role)
- **Institution context:** N/A — brand manager is internal tooling
- **Backend access checks:** existing `POST /brands`, `PATCH /brands/:id`, build trigger auth applies; no new endpoints to authorize

## Notifications (Push / In-App)

None.

## Error Messages (German, user-facing)

| Code | Message |
|------|---------|
| Format invalid | `Apple Developer Team ID erwartet (10 Zeichen, mind. ein Buchstabe). Du verwechselst sie evtl. mit der numerischen App Store Connect 'team_id' — die ist NICHT die richtige.` |
| Team not found | `Team {id} ist im Brand Manager nicht angelegt. Bitte zuerst unter /teams anlegen.` |
| ASC team mismatch | `Apple meldet Team-ID {actualTeamId} für die hinterlegten Credentials, konfiguriert war aber {expectedTeamId}. Bitte hinterlegte ASC-Zugangsdaten oder Team-ID korrigieren.` |
| Build pre-flight team missing | `iOS-Build benötigt eine konfigurierte Apple Developer Team ID auf der Brand.` |
| Build pre-flight team invalid | `Team {id} hat ein offenes App Store Connect Problem: {agreementError}` |
| Config emitter | `Brand-Config kann nicht erzeugt werden: {underlying validation error}` |

User-facing strings stay in German per project policy. Backend log lines and code comments stay in English.

## Open Questions

None as of 2026-05-09. The user explicitly chose "all layers except Layer 6 (cron)" on the same day.

## References

- **Backend brands DTO:** `apps/brand-manager/src/app/brands/dto/create-brand.dto.ts`
- **Backend ASC service:** `apps/brand-manager/src/app/teams/app-store-connect.service.ts` (existing `verifyTeamId`)
- **Build trigger:** `apps/brand-manager/src/app/builds/mobile-build-trigger.service.ts`
- **Frontend team step:** `apps/brand-manager-ui/src/app/brands/brand-creation-wizard/steps/team-step.component.ts`
- **Frontend team detail:** `apps/brand-manager-ui/src/app/teams/team-detail/team-detail.component.ts`
- **Frontend brand editor:** `apps/brand-manager-ui/src/app/brands/brand-editor/brand-editor.component.ts`
- **Original incident** (causing this spec): GitHub Actions iOS build failure on 2026-05-08 for brand `caritas-luenen-selm-werne` — `team_id 6744736254` saved instead of `5H3U37UD3V`.
