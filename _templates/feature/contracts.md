# Contracts: <Feature>

> API endpoints, DTOs, events — everything that flows between frontend and backend.

## Endpoints

### `GET /api/...`

**Request:** …
**Response:**

```ts
interface FooResponse {
  id: string;
  // ...
}
```

**Error codes:** 401, 403, 404

## Events (WebSocket / Push)

<If relevant.>

## Data Models

```ts
// Source: apps/tagea-frontend/src/app/.../models/foo.model.ts
interface Foo {
  // ...
}
```

> **Flutter port note:** The corresponding Dart class must respect the same JSON contract (identical field names, nullability).
