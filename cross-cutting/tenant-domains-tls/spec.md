# Feature: Tenant Domains & On-Demand TLS (with ownership verification)

> **Status:** 🚧 In progress — foundation implemented (tenant_domains model + `ask` endpoint), follow-ups planned
> **Owner:** toenjes
> **Last updated:** 2026-06-27
> **Type:** Backend infrastructure + edge architecture (no Flutter port — server/ingress-only behavior)

## Vision (Elevator Pitch)

Let new tenant hostnames go live with **zero DNS or certificate ops on our side** — both
`kunde.tagea.app`-style subdomains and tenant-owned custom domains (`verein-beispiel.de`).
A wildcard DNS record plus a reverse proxy with automatic certificate issuance handle TLS;
a small backend `ask` endpoint gates which hostnames may obtain a certificate, a
domain-ownership verification step makes sure a tenant only activates a hostname it actually
controls, and the backend keeps Keycloak's redirect URIs in sync automatically.

## Background & Motivation

Originally a tenant's custom hostname was a single nullable column `Tenant.domain`
(`varchar(255) unique`), read by `PublicTenantService.findTenantByDomain()` for
branding/landing-page resolution. There was no certificate automation, no subdomain model,
no ownership proof, and only one hostname per tenant.

The edge layer (Caddy on the worker nodes, behind the Hetzner Load Balancer in TCP
pass-through, shared Redis cert store) is **live**: existing hostnames and a `*.tagea.app`
wildcard are served via DNS-01. This spec covers the **backend behavior** the edge depends on:
the `ask` endpoint, the domain data model, the ownership-verification lifecycle, and the
Keycloak redirect-URI sync.

### Why ownership verification is in scope

A security review flagged that "add a row" silently becomes "activate a new authenticated,
TLS-valid surface". Ownership verification + restricting domain management to **Tremaze staff
only** (not customers) closes claim-jacking, dangling-DNS pre-registration, and ACME
rate-limit abuse.

## Goals

1. Self-service hostnames with no per-domain ops (subdomain or custom).
2. Issue TLS certificates only for hostnames we are allowed to (the `ask` gate).
3. Prove control before activation (DNS-based ownership challenge).
4. Support N hostnames per tenant.
5. Keep Keycloak redirect URIs in sync automatically (no manual "Invalid redirect_uri" friction).
6. Stay additive / backwards-compatible — existing `Tenant.domain` keeps working.

## Non-Goals

- The Caddy / Load Balancer / Redis configuration itself (deploy repo + ops tickets).
- Multi-level wildcard subdomains (`a.b.tagea.app`). One level only.
- Per-tenant isolated ACME accounts or Keycloak realms (one realm, one frontend client).
- Apex/marketing hostnames — handled by a dedicated static site.

## Architecture Context (edge → backend)

```
Browser ── TLS ──► Hetzner LB (TCP pass-through, use_private_ip)
                        │  round-robin (private network) to worker nodes
                        ▼
                 Caddy (per node, shared Redis cert store)
                  │            │
   *.tagea.app ───┘            └──── custom domains
   one wildcard cert                 on-demand TLS
   via DNS-01 (no ask)               │
                          GET …/public/caddy/ask?token=<secret>&domain=<sni>
                          (internal address; gated by shared secret)
                                      │
                          isCertifiableDomain(host) ── true ⇒ 2xx ⇒ issue · else 403
```

| Hostname kind        | DNS                                | Certificate                          | Hits `ask`? |
| -------------------- | ---------------------------------- | ------------------------------------ | ----------- |
| `kunde.tagea.app`    | wildcard `*.tagea.app`             | shared wildcard cert (DNS-01)        | No          |
| `verein-beispiel.de` | tenant CNAME → `ingress.tagea.app` | per-domain, on-demand (HTTP/ALPN-01) | **Yes**     |

## Data Model

A dedicated 1:N table `tenant_domains` (meta schema). `Tenant.domain` is kept and backfilled
during the transition.

```ts
// apps/tagea-backend/src/tenants/tenant-domain.entity.ts
@Entity('tenant_domains')
class TenantDomain {
  id: string;                 // varchar(36)
  tenant_id: string;          // FK → tenants(id) ON DELETE CASCADE
  host: string;               // full host, lowercase; unique only among verified rows
  type: 'subdomain' | 'custom';
  status: 'pending' | 'verified' | 'failed' | 'disabled';
  verification_token: string | null;
  verification_method: 'dns-txt' | 'cname' | null;
  verified_at: Date | null;
  claim_expires_at: Date | null;   // pending claims expire (anti-squatting)
  created_at: Date;
}
```

- **Partial unique index** on `host WHERE status = 'verified'` → at most one verified owner per
  host; pending claims stay non-exclusive.
- **Migration / backfill:** each existing `Tenant.domain` → `type='custom', status='verified'`.
- Implemented in #486.

## Domain Lifecycle & Ownership Verification

- **Subdomain** (`type='subdomain'`): we own `tagea.app` → no external proof; format +
  reserved-label check, then `verified`. Served by the wildcard cert; never hits `ask`.
- **Custom domain** (`type='custom'`): created `pending` with a `verification_token` and a
  `claim_expires_at`. Admin places `TXT _tagea-challenge.<host> = <token>` (preferred) or a
  `CNAME <host> → ingress.tagea.app`. A backend job resolves DNS and flips to `verified`;
  after N failures → `failed`. Only verified custom domains are returned by `ask`.

No chicken-and-egg: verification is a DNS lookup, independent of certificate issuance.

## API / Contracts

### `GET /public/caddy/ask` — On-Demand TLS gate (implemented, #486)

Called by Caddy's `on_demand_tls { ask … }`. **Internal address only**, and gated by a
**shared secret**.

- **Request:** `?token=<CADDY_ASK_TOKEN>&domain=<host>` (Caddy appends both; the token is a
  static query param on the configured ask URL).
- **Response:** `200` (empty) ⇒ issue · `403` ⇒ refuse. `@Public()`, `@HttpCode(200)`.
- **Token check is timing-safe and runs BEFORE any DB lookup; fails closed** (no configured
  secret ⇒ refuse all). This makes the endpoint safe even if reachable externally (no
  enumeration oracle, no DB-load amplifier).
- `isCertifiableDomain(host)`: normalize → reject malformed / wildcard-base hosts (`*.tagea.app`)
  before any query → `existsBy({ host, type:'custom', status:'verified' })`.

### Admin domain management (planned — **super-admin / Tremaze-staff scope only**)

Domains may be assigned to a tenant **only by Tremaze staff**, never by the customer. All
endpoints use `@Auth({ scope: 'super-admin' })` (not `tenant-admin`). Home: the `super-admin`
module.

| Method   | Endpoint                                            | Purpose                          |
| -------- | --------------------------------------------------- | -------------------------------- |
| `GET`    | `/super-admin/tenants/:id/domains`                  | List a tenant's hostnames        |
| `POST`   | `/super-admin/tenants/:id/domains`                  | Add a subdomain or custom domain |
| `POST`   | `/super-admin/tenants/:id/domains/:domainId/verify` | Trigger a DNS re-check           |
| `DELETE` | `/super-admin/tenants/:id/domains/:domainId`        | Remove / disable a hostname      |

Response for a pending custom domain surfaces the DNS record to set. A **reserved-label
denylist** (`www`, `api`, `login`, `mail`, `admin`, `v2`, `tmp`, `ingress`, …) rejects
subdomain labels that would collide with infra hosts under `*.tagea.app`.

## Keycloak Redirect-URI Sync (planned)

Keycloak validates `redirect_uri`/`Web Origins` per client. A new tenant hostname therefore
needs registration, or login fails with "Invalid redirect_uri". The backend already has a
Keycloak Admin API integration (`auth/services/user-management.service.ts`: admin token from
the master realm, `KEYCLOAK_FRONTEND_CLIENT_ID`, `KEYCLOAK_REALM`). **One realm, one frontend
client for all tenants.**

On the `verified` transition (and on remove/disable), the backend updates the frontend client:

- `redirectUris` += `https://<host>/*`
- `webOrigins` += `https://<host>`
- post-logout redirect URIs analogously

**Mechanism — reconcile, not append:** Keycloak has no atomic "add redirect URI" (it's
GET-modify-PUT of the whole client), so concurrent domain changes would clobber. Instead, any
domain change enqueues a deduplicated **single-worker BullMQ job** that recomputes
`redirectUris = static base ∪ {per verified domain}` and PUTs once → race-free, no stale
entries.

## Security Invariants (changing any of these requires a security review)

1. **The `ask` endpoint is gated by the shared secret `CADDY_ASK_TOKEN`** — checked timing-safe,
   before any DB lookup, fail-closed. (Network isolation — internal address + node firewall —
   is defense-in-depth, not the primary control.)
2. **Only `verified` + `custom` domains issue certs.** Everything else ⇒ 403.
3. **`*.tagea.app` is excluded from on-demand** — served by the wildcard cert; never per-host issuance.
4. **Input is normalized and validated** (lowercase, length ≤ 255, charset `[a-z0-9.-]`, no `..`,
   no leading/trailing dot, no port/path/scheme/wildcard) before any query.
5. **Ownership is proven before `verified`** for custom domains (DNS TXT or CNAME-to-ingress).
6. **Pending claims are non-exclusive and expire** — uniqueness only among `verified` rows.
7. **Domain management is `super-admin` (Tremaze) only** — never tenant-admin/customer.
8. **No wildcard redirect URIs in Keycloak** (`https://*.tagea.app/*`) — exact per-host URIs via
   the reconcile. The wildcard DNS makes every `*.tagea.app` TLS-valid, so a wildcard redirect
   would be an open flank.
9. **Least privilege:** the Keycloak service account needs only `manage-clients`; the DNS-01
   token and the Redis cert store are crown jewels (private network only, encrypted at rest).
10. **Unknown/inactive hosts hard-fail** (404/444) at the app — never a default-tenant fallback
    (phishing protection, since the wildcard makes every host TLS-valid).

## Acceptance Criteria

- [x] `GET /public/caddy/ask` with a valid token + verified custom host → `200`.
- [x] Missing/wrong token → `403` before any DB lookup; no secret configured → fail closed.
- [x] `pending`/`failed`/`disabled`/unknown host → `403`.
- [x] Any `*.tagea.app` host → `403`.
- [x] Malformed input → `403` without touching tenant data.
- [x] Migration backfills existing `Tenant.domain` as `verified`/`custom`; resolution unchanged.
- [ ] A custom domain added by a super-admin starts `pending` and is not yet certifiable.
- [ ] tenant-admin / customer cannot add or verify a domain (403).
- [ ] Correct DNS TXT/CNAME → domain becomes `verified`; never-pointing domain → `failed`.
- [ ] On `verified`, `https://<host>/*` appears on the Keycloak frontend client; login works.
- [ ] Concurrent domain changes do not lose redirect URIs (reconcile).
- [ ] Unknown `*.tagea.app` host hard-fails (no default-tenant branding).

## Edge Cases

- Unknown but TLS-valid `*.tagea.app` subdomain → app hard-fails (404/444).
- Tenant set `inactive` while a domain is `verified` → `ask` 403 and routing rejects.
- DNS propagation lag → verification job retries with backoff; manual re-check available.

## Risks & Mitigations

| Risk                                                              | Likelihood | Impact    | Mitigation |
| ----------------------------------------------------------------- | ---------- | --------- | ---------- |
| Claim-jacking / squatting                                         | Low        | High      | super-admin-only management + DNS proof + verified-only uniqueness + claim expiry |
| Wildcard + permissive routing → TLS-valid phishing subdomains     | Medium     | High      | Hard-fail unknown hosts; no default tenant |
| `ask` abused as oracle / DB-DoS                                   | Low        | Medium    | Shared-secret gate before DB; index-only `existsBy`; input validation |
| Keycloak redirect-URI race / clobber                             | Medium     | Medium    | Reconcile via single-worker BullMQ job; exact URIs |
| Wildcard redirect URI as open flank                              | Low        | High      | No wildcards in Keycloak; exact per-host |
| Shared ACME / Redis / DNS token compromise                        | Low        | Very high | Verification gate; least privilege; private network; encrypted at rest |

## Rollout / Phases

| # | Phase | Ticket | Status |
|---|---|---|---|
| 0 | Edge prerequisites (wildcard DNS, LB→TCP, Caddy build, shared Redis) | ops | ✅ live |
| 1 | Foundation: `tenant_domains` + `ask` endpoint + shared-secret gate | #486 | ✅ PR open |
| 2 | Ownership verification (DNS TXT/CNAME) | #488 | ⏳ |
| 3 | Super-admin admin API + reserved-label denylist | #489 | ⏳ |
| 4 | Keycloak redirect-URI sync (reconcile) | #490 | ⏳ |
| 5 | Routing cutover (Host→tenant, hard-fail unknown) | #491 | ⏳ |
| 6 | Ops: on-demand activation + node firewall | #492 | ⏳ |

Tracking epic: tremaze/tagea-next#495.

## Open Decisions (resolved)

- ✅ **Data model:** dedicated `tenant_domains` table (not columns on `tenants`).
- ✅ **Admin scope:** `super-admin` (Tremaze staff) only — never tenant-admin.
- ✅ **`ask` protection:** shared secret (`CADDY_ASK_TOKEN`), not network-only (the public API
  surface + path-unaware LB make pure network isolation impractical).
- ✅ **Keycloak sync:** reconcile-on-verify via single-worker queue; exact URIs, no wildcards.
- ⏳ **Re-verification:** verify-once vs. periodic re-check — start verify-once.

## References

- **Custom-domain column (legacy):** `apps/tagea-backend/src/tenants/tenant.entity.ts`
- **Domain lookup + `isCertifiableDomain`:** `apps/tagea-backend/src/public-api/public-tenant.service.ts`
- **`ask` controller:** `apps/tagea-backend/src/public-api/caddy-tls-ask.controller.ts`
- **Entity + migration:** `apps/tagea-backend/src/tenants/tenant-domain.entity.ts`,
  `apps/tagea-backend/src/database/meta-migrations/20260627120000-CreateTenantDomains.ts`
- **Keycloak admin integration:** `apps/tagea-backend/src/auth/services/user-management.service.ts`
- **Super-admin scope:** `apps/tagea-backend/src/auth/authorization/auth.decorator.ts`
- **Meta-DB access:** `apps/tagea-backend/src/tenants/tenant-connection.service.ts`
