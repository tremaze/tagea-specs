# Keycloak Realm Config Runbook

> Operational runbook for enabling Apple and Google identity providers on a Tagea Keycloak realm. Follow this before announcing the feature in a tenant — the realm must be configured for each environment (dev, staging, prod).

## Prerequisites

- Keycloak admin access to the target realm.
- Apple Developer account with App ID + Services ID + Sign in with Apple key (for Apple).
- Google Cloud project with OAuth 2.0 Client ID configured (for Google).
- The Tagea Keycloak realm's redirect URI registered with both providers:
  `https://<keycloak-host>/realms/<realm>/broker/<alias>/endpoint`

## 1. Add Apple identity provider

In the Keycloak admin UI:

1. Realm → Identity Providers → Add provider → **Apple** (or generic OIDC v1.0 if no native Apple option).
2. Set `alias = apple`, `Display Name = Apple`.
3. Configure:
   - **Client ID** = the Services ID from Apple Developer.
   - **Client Secret** = JWT generated from your Sign in with Apple key (key ID + team ID + private key). Rotate every 6 months — Apple's key JWT has a max 6-month expiry.
   - **Default Scopes** = `openid name email`.
   - **Trust Email** = `ON` (Apple always returns verified emails).
   - **Sync Mode** = `IMPORT`.
4. Save.
5. Open the new provider → **Mappers** → add:
   - Attribute Mapper `email` → User attribute `email`.
   - Attribute Mapper `given_name` (claim) → User attribute `firstName` — **set "Mode" to `INHERIT`** so the import only happens on first sign-in (Apple omits the name claim on subsequent calls).
   - Attribute Mapper `family_name` → User attribute `lastName`, same mode.

## 2. Add Google identity provider

1. Realm → Identity Providers → Add provider → **Google**.
2. Set `alias = google`, `Display Name = Google`.
3. Configure:
   - **Client ID** = the OAuth 2.0 Client ID from Google Cloud.
   - **Client Secret** = the matching client secret.
   - **Default Scopes** = `openid profile email`.
   - **Trust Email** = `ON` (Google's `email_verified` claim is honored).
   - **Sync Mode** = `IMPORT`.
4. Save.

## 3. First-Broker-Login flow

The default `first broker login` flow handles cross-IdP linking. Confirm it has the following sub-flows (the Keycloak default since 22.x):

1. **Review Profile** — optional, can be set to `Disabled` if all required attributes come from the IdP.
2. **Create User If Unique** — `Alternative`.
3. **Handle Existing Account**:
   - `Confirm link existing account` (Required) — shown when the email collides with an existing user.
   - `Verify existing account by Email` (Alternative) — sends a verification link.
   - `Verify existing account by Re-authentication` (Alternative) — prompts re-auth via the existing IdP.

For auto-link on verified emails (the spec's preferred behavior), the **Detect Existing Broker User** step at the start of the flow must run and **Automatically Set Existing User** must be set to `Required`. This bypasses the confirmation prompt when the inbound IdP marks the email as verified AND the existing Keycloak user also has a verified email.

## 4. Microsoft (existing)

Verify the existing Microsoft IdP has the same `Trust Email = ON` and `Sync Mode = IMPORT` settings so cross-linking works in both directions.

## 5. Login theme

The Keycloak login theme must render the three providers in **Apple, Google, Microsoft** order. Apple's button must follow Apple HIG (black-on-white "Sign in with Apple" wordmark). The Tagea login theme handles this — update `themes/tagea/login/social-providers.ftl` (or equivalent) to enforce the order.

## 6. Verification

After deploying realm changes:

1. Visit `/welcome` on the target environment.
2. Confirm Apple, Google, Microsoft buttons render in that order.
3. Click each button — should redirect to the provider's consent screen (not error out).
4. For each provider, complete sign-in with a fresh account → confirm the user lands on `/join` and sees the onboarding pickers.
5. Repeat with an existing Microsoft-linked email via Google → confirm auto-link triggers and the user lands directly on `/dashboard`.

## E2E environment

The E2E realm-export at `apps/tagea-frontend-e2e/src/keycloak/realm-export.json` defines all three providers with placeholder credentials. The redirect roundtrip does **not** complete in E2E (no real provider available); tests verify the button presence + the `kc_idp_hint` query parameter on the resulting Keycloak URL.

## Rollback

To remove a provider without losing existing linked users:

1. Set the provider's `enabled = false` in Keycloak admin.
2. Do **not** delete the provider — that would orphan linked user identities.
3. Hide the corresponding button on `/welcome` via a frontend feature flag if needed.
