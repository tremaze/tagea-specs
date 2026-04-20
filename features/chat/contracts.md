# Contracts: Chat (Staff)

This wrapper has no direct backend contracts. The chat protocol (Matrix) and endpoints are owned by `@tagea/chat`.

## Wrapper Configuration

```ts
// Provided inside @Component decorator
{
  provide: CHAT_CONTAINER_CONFIG,
  useValue: { defaultSafeArea: 'conversation' } satisfies ChatContainerConfig
}
```

## Child Routes

From `packages/chat/src/lib/routes.ts`:

```ts
export const CHAT_BASE_ROUTES: Routes = [
  {
    path: '',
    component: ChatContainerComponent,
    children: [
      { path: '', component: ChatLoadingComponent, pathMatch: 'full' },
      { path: 'empty', component: ChatEmptyComponent },
    ],
  },
];
```

## Tenant Feature Flag

- `TenantFeaturesService.isChatEnabled()` — signal.
- When `false`, the `effect()` in the wrapper calls `Router.navigate(['/teamspace'])`.

## Known Implementation Note

The wrapper currently has `// void this.chatService.connect(idToken);` **commented out** — connection is handled elsewhere (likely inside `ChatContainerComponent` mount) rather than from this page. Flutter port should rely on the chat widget's own lifecycle rather than manually driving a `connect()` call from the page wrapper.
