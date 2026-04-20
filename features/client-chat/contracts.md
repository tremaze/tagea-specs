# Contracts: Client Chat

This wrapper has no direct backend contracts. Chat protocol and endpoints are owned by the `@tagea/chat` library — see that library's README/spec for wire details.

## Wrapper Configuration

```ts
// Provided by the wrapper component
{
  provide: CHAT_CONTAINER_CONFIG,
  useValue: { defaultSafeArea: 'conversation' } satisfies ChatContainerConfig
}
```

## Tenant Feature Flag

- `TenantFeaturesService.isChatEnabled()` — boolean signal/observable.
- When it flips to `false` during navigation, the wrapper redirects to `/client-portal`.

> **Flutter port note:** The Flutter chat implementation lives in `lib/features/chat/` (or a separate Dart package mirroring `@tagea/chat`). The client-portal wrapper only needs to mount that widget + subscribe to the feature flag.
