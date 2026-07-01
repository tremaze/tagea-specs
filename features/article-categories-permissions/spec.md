# Feature: Article Categories — Scope-Specific CRUD Permissions

> **Status:** 🟢 Implemented (2026-05-18)
> **Owner:** svenarbeit
> **Last updated:** 2026-05-18

## Vision (Elevator Pitch)

Article categories live in three scopes that mirror where the underlying
articles live (Teamspace ⊕ Einrichtung ⊕ Tenant-weit). The permission gate
that controls *who may create / edit / delete* a category now follows the same
three-scope split — instead of the previous single `tenant.articles.categories.manage`
permission which routed every category change through the Träger-Manager.

Concretely: a **Teamspace-Redakteur** can now manage categories for the news /
knowledge articles in their own teamspace, and an **Einrichtungs-Berater**
can manage the categories for the client-facing articles in their own
institution — without going through a tenant-wide bottleneck.

## User Stories

- As a **Teamspace-Redakteur** I want to **create/edit/delete article categories within my teamspace** so that **I can organise the news + knowledge articles I am responsible for, without asking a Träger-Manager**.
- As an **Einrichtungs-Berater** I want to **manage the article categories of my institution** so that **I can curate the client-facing article catalogue for our clients**.
- As a **Träger-Manager** I want my **existing tenant-wide override** to keep working so that **legacy mobile/web clients that still know only `tenant.articles.categories.manage` do not break after the rollout**.

## The Three-Scope Model

The `article_categories` row carries `teamspace_id` (nullable) and
`institution_id` (nullable). Storage already encoded the three-way split:

| `teamspace_id` | `institution_id` | Scope | Permission gate |
|---|---|---|---|
| set | NULL | Teamspace category (NEWS / KNOWLEDGE articles) | `articles.categories.{view,create,edit,delete}` (DB resource `ts.articles.categories`, scope `teamspace`) |
| NULL | set | Institution category (client-facing news) | `institution.articles.categories.{view,create,edit,delete}` (scope `institution`) |
| NULL | NULL | Tenant-wide category (legacy only) | `tenant.articles.categories.manage` (legacy bypass) |
| set + set | — | rejected with 400 Bad Request | — |

Default role mapping (see `tenant-migrations/20260518120000-SplitArticleCategoriesPermissions.ts`):

- **Teamspace `admin` + `redakteur`** → full CRUD on `articles.categories.*`
- **Teamspace `bearbeiter`** → view only
- **Institution `admin`** → full CRUD on `institution.articles.categories.*`
- **Institution `manager`/`supervisor`/`counselor`** → view + create + edit (no delete)
- **Träger-Manager** (tenant) → keeps `tenant.articles.categories.manage` (legacy bypass for any scope)

## Acceptance Criteria

- [x] **Given** a Teamspace-Redakteur with no tenant-level admin flags **When** they POST `/articles/categories` with `teamspace_id = X` (their teamspace) **Then** the response is **201**.
- [x] **Given** the same redakteur **When** they POST `/articles/categories` with `institution_id = Y` (cross-scope) **Then** the response is **403**.
- [x] **Given** an Einrichtungs-Berater **When** they POST `/articles/categories` with `institution_id = Y` (their institution) **Then** the response is **201**.
- [x] **Given** an Einrichtungs-Berater **When** they DELETE an institution category **Then** the response is **403** (delete is admin-only).
- [x] **Given** a Träger-Manager (holder of legacy `tenant.articles.categories.manage`) **When** they mutate a category of any scope **Then** the response is **2xx** (bypass).
- [x] **Given** a Mitarbeiter with no teamspace or institution role **When** they attempt any category mutation **Then** the response is **403**.
- [x] **Given** any user **When** they GET `/articles/categories?teamspace_id=X` **Then** only categories with that `teamspace_id` are returned.
- [x] **Given** any user **When** they POST `/articles/categories` without `teamspace_id` and without `institution_id` **Then** the response is **400** (DTO validation).

## Backwards Compatibility

The legacy `tenant.articles.categories.manage` permission and the `tenant.articles.documentation.*` / `tenant.articles.announcement.*` permissions remain in
the permission catalogue and in the database. Older mobile and web clients
that ship hard-coded references to these names continue to work:

- Legacy `manage` permission is honoured as a tenant-wide bypass in
  `ArticleCategoryService.assertCategoryPermission`.
- `tenant.articles.documentation.*` and `tenant.articles.announcement.*`
  remain wired in `ArticlesService.assertArticlePermission` even though
  there is no production UI for those article types.

No client-visible API contract changes; no rate of 4xx increases expected.

## Non-Goals

- Re-scoping existing article *data* (NEWS / KNOWLEDGE articles stay
  teamspace-scoped; CLIENT_NEWS articles stay institution-scoped via the
  separate `institution.client_news.*` permission family).
- Granting Träger-Manager additional fine-grained ts.* or institution.*
  category permissions; the legacy bypass already covers his use case.
- Adding categories to the `CLIENT_NEWS` controller — that surface has no
  category concept today and does not need one for this feature.

## Edge Cases

- **Both `teamspace_id` and `institution_id` set on POST**: rejected with 400
  (existing DTO validation, unchanged).
- **Tenant-wide categories** (`teamspace_id IS NULL AND institution_id IS NULL`):
  cannot be created through the HTTP API (DTO validation). They may already
  exist from pre-existing data and remain mutable for Träger-Manager via
  the legacy bypass.
- **SuperAdmin / TenantAdmin bypass**: untouched. Both flags short-circuit
  the entire scope routing.

## Permissions & Tenant/Institution

- **Backend access checks**: enforced inside `ArticleCategoryService.assertCategoryPermission` on the `create`, `update` and `remove` paths.
- **Controller decorators**: the previous explicit `@Auth({ scope: 'tenant', permissions: [...] })` decorators on POST / PATCH / DELETE were removed; the routes inherit the class-level `@Auth({ scope: 'authenticated' })` and let the service-level check route by category scope.
- **Frontend gates**: `RedaktionCategoriesComponent.canCreate/Edit/Delete` use `SessionAuthz.canInAnyTeamspace('articles.categories.*')` in teamspace mode and `SessionAuthz.canInInstitution(institutionId, 'institution.articles.categories.*')` in institution mode.

## i18n Keys

No new strings — the existing `redaktion.categories.*` keys cover all UI.

## References

- **Backend service:** `apps/tagea-backend/src/articles/services/article-category.service.ts`
- **Backend controller:** `apps/tagea-backend/src/articles/controllers/article-categories.controller.ts`
- **Migration:** `apps/tagea-backend/src/database/tenant-migrations/20260518120000-SplitArticleCategoriesPermissions.ts`
- **Permission catalogue:** `packages/permissions/src/lib/permissions.ts` (`INSTITUTION_ARTICLES_CATEGORIES_*`, `TS_ARTICLES_CATEGORIES_*`)
- **Frontend:** `apps/tagea-frontend/src/app/pages/teamspace/redaktion-categories.component.ts`
- **Backend unit spec:** `apps/tagea-backend/src/articles/services/article-category.service.spec.ts`
- **E2E spec:** `apps/tagea-frontend-e2e/src/tests/teamspaces/articles-categories-permissions.spec.ts`
- **Related:** `specs/features/teamspace-consumer-access/spec.md` (the two-scope model on which this builds).
