# Contracts: Global Search (Globale Suche)

> API endpoints, DTOs, events — everything that flows between frontend and backend.

## Endpoints (verified against backend `search.controller.ts`, 2026-09-25)

All routes are tenant-scoped (`X-Tenant-ID`). The Einrichtung comes from the optional `X-Institution-ID` header, validated by `InstitutionContextMiddleware`.

| Method + path         | Permission                                                                 | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `GET /search/global`  | `@Auth({ scope: 'authenticated', allowedUserTypes: [EMPLOYEE] })` — any employee; no permission key, no feature/module guard | Search clients and client relationships → `GlobalSearchResponseDto` |

There is no teamspace-scoped search endpoint. Teamspace access (`TeamspaceAccessGuard`) is not involved.

### `GET /search/global` query (`GlobalSearchQueryDto`)

| Param   | Type        | Notes                                                                                     |
| ------- | ----------- | ----------------------------------------------------------------------------------------- |
| `q`     | string      | required; trimmed by the controller; **min 2 characters after trim** (else `400`)          |
| `limit` | int 1–50    | optional, default 10; Angular always sends `10`                                            |

> Documentation-only shape.

```ts
// Source: apps/tagea-backend/src/search/dto/global-search.dto.ts
class GlobalSearchQueryDto {
  q: string; // @IsString(), minLength 2 checked in controller
  limit?: number; // @IsOptional() @IsInt() @Min(1) @Max(50), default 10
}
```

### Headers

| Header             | Required | Effect                                                                                                    |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------------- |
| `X-Tenant-ID`      | yes      | Tenant database                                                                                            |
| `X-Institution-ID` | no       | When present and valid: results limited to clients assigned to that Einrichtung (`client_institution_assignments`). When absent: **no institution filter — all clients of the tenant** |

### Response (`GlobalSearchResponseDto`)

> Documentation-only shape.

```ts
// Source: apps/tagea-backend/src/search/dto/global-search.dto.ts
enum SearchResultType {
  CLIENT = 'client',
  RELATIONSHIP = 'relationship',
}

class SearchResultItemDto {
  type: SearchResultType;
  id: string; // client id (type client) or relationship id (type relationship)
  displayName: string; // "first last"; relationship: related person's name or "Unbekannter Klient"
  description?: string; // client: "<n> Jahre • <city>"; relationship: "<type> von <first> <last>"
  email?: string; // omitted for anonymous clients
  isAnonymous?: boolean;
  phone?: string; // mobile, else landline; omitted for anonymous clients
  address?: string; // "street, postal city"; omitted for anonymous clients
  clientId?: string; // relationship only: owning client (navigation target)
  clientName?: string; // relationship only
  score?: number; // 0.2 | 0.4 | 0.6 | 0.8 | 1.0 — relevance
  dateOfBirth?: string; // client only, ISO date
  category?: string; // client only: 'client' | 'related_person' | 'contact' (ClientCategory)
}

class GlobalSearchResponseDto {
  results: SearchResultItemDto[]; // sorted by score desc, cut at limit
  total: number; // hits before the cut (clients + relationships, each limited separately)
  query: string; // trimmed query
  searchTime: number; // ms, measured in the controller
}
```

Example:

```
{
  "results": [
    {
      "type": "client",
      "id": "8f1c…",
      "displayName": "Max Müller",
      "description": "34 Jahre • Bremen",
      "email": "max@example.org",
      "isAnonymous": false,
      "phone": "0421 123456",
      "address": "Hauptstr. 1, 28195 Bremen",
      "score": 0.6,
      "dateOfBirth": "1992-03-14",
      "category": "client"
    },
    {
      "type": "relationship",
      "id": "b27a…",
      "displayName": "Anna Müller",
      "description": "Mutter von Max Müller",
      "isAnonymous": false,
      "clientId": "8f1c…",
      "clientName": "Max Müller",
      "score": 0.6
    }
  ],
  "total": 2,
  "query": "müller",
  "searchTime": 18
}
```

### Matching and ranking (server)

- Text: `LIKE %q%` (case-insensitive on names, email, street, city, relationship type; case-sensitive on phone and postal code). Contact fields only match when `is_anonymous IS NOT TRUE`.
- Full date (`dd.MM.yyyy`, `dd.MM.yy`, `yyyy-MM-dd`): `client.dateOfBirth = date`; relationships are still searched as text.
- Partial date (`dd.MM.` / `dd.MM`): day + month of `dateOfBirth`.
- Score over `"first last email"` (email left out for anonymous clients): exact 1.0, prefix 0.8, word prefix 0.6, substring 0.4, else 0.2.

### Error codes

| Status | When                                                                                     | Body message                                                  |
| ------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 400    | `q` missing / < 2 characters after trim; `limit` not an int in 1–50 (class-validator)    | `Search query must be at least 2 characters long` / validation |
| 401    | not authenticated                                                                         | —                                                             |
| 403    | caller is not an employee (e.g. client); employee not assigned to the `X-Institution-ID` Einrichtung (and no `access_all`) | `You are not assigned to institution <id>` |
| 500    | any error during the search                                                              | `An error occurred while searching`                           |

Angular maps **every** error to an empty result list (no distinct error UI).

## Events (WebSocket / Push)

None.

## Service: `GlobalSearchService`

Exact code in [`global-search.service.ts`](../../../apps/tagea-frontend/src/app/services/global-search.service.ts).

| Member                          | Purpose                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MIN_SEARCH_LENGTH` (static, 2) | Minimum trimmed query length                                                                         |
| `performSearch(query)`          | `GET search/global?q=…&limit=10`; returns `[]` below min length and on error; 5-minute in-memory cache keyed by lower-cased query |
| `clearCache()`                  | Empties the cache (not called by the shell today)                                                    |
| `getIconForType(type)`          | `client` → `person`, `relationship` → `people`, `contact` → `contacts`, else `search`                |
| `getRouteForResult(result)`     | client → `['/einrichtung', institutionId, 'profile', id]`; relationship/contact → same with `clientId`, fallback `['/einrichtung', institutionId, 'clients']`; without institution → `['/profile', …]` / `['/clients']` |

## Shell visibility

```ts
// Source: apps/tagea-frontend/src/app/auth-session/navigation-mode.service.ts
function shouldHideGlobalSearch(
  mode: NavigationModeValue, // 'einrichtung' | 'teamspace'
  isInSiblingApp: boolean,
): boolean; // mode !== 'einrichtung' || isInSiblingApp
```

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/models/search.model.ts
enum SearchResultType {
  CLIENT = 'client',
  RELATIONSHIP = 'relationship',
  CONTACT = 'contact', // frontend only — never returned by the backend
}

interface SearchResultItem {
  type: SearchResultType;
  id: string;
  displayName: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  clientId?: string;
  clientName?: string;
  score?: number;
  dateOfBirth?: string;
  category?: string;
  isAnonymous?: boolean;
}

interface GlobalSearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  searchTime: number;
}
```

> **Flutter port note:** The corresponding Dart class must respect the same JSON contract (identical field names, nullability). Treat `type` as an open enum: unknown values (including `contact`) must not crash the parser. Compare `category` case-insensitively (backend sends lower case, Angular upper-cases before mapping).
