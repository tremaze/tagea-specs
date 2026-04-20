# Tagea Feature Specs

Single source of truth for feature behavior. Both frontend implementations (Angular + Flutter) are built against these specs.

## Information Flow

```
tagea-next (Angular, source of truth)
└── specs/                    ← here
        │
        │ git submodule
        ▼
tagea-flutter
└── reference/                ← tagea-next as submodule (read-only)
    └── specs/
```

## Workflow

1. **New feature** is defined here as a spec (or extracted from existing Angular code)
2. **Angular implementation** lives/evolves in this same repo → `apps/tagea-frontend/...`
3. **Flutter port** reads spec + Angular reference code via the submodule

## Status Conventions

| Symbol | Meaning                                              |
| ------ | ---------------------------------------------------- |
| ✅     | Implemented & covered by E2E tests                   |
| 🚧     | In progress                                          |
| ⏳     | Planned / spec exists, not implemented               |
| ❌     | Not planned (intentional non-goal for this platform) |

## Feature Inventory

See [INVENTORY.md](./INVENTORY.md) for the full list of features, derived from the Angular router. That file drives what specs exist and in what order they get ported.

## Parity Matrix

| Feature                            | Angular | Flutter | Spec                                                         |
| ---------------------------------- | ------- | ------- | ------------------------------------------------------------ |
| Login                              | ✅      | ⏳      | [login/](./features/login/spec.md)                           |
| Auth Callback                      | ✅      | ⏳      | [auth-callback/](./features/auth-callback/spec.md)           |
| Session Expired                    | ✅      | ⏳      | [session-expired/](./features/session-expired/spec.md)       |
| Client Dashboard                   | ✅      | ⏳      | [client-dashboard/](./features/client-dashboard/spec.md)     |
| Client Termine                     | ✅      | ⏳      | [client-termine/](./features/client-termine/spec.md)         |
| Client Dokumente                   | ✅      | ⏳      | [client-dokumente/](./features/client-dokumente/spec.md)     |
| Client News                        | ✅      | ⏳      | [client-news/](./features/client-news/spec.md)               |
| Client Nachrichten                 | ✅      | ⏳      | [client-nachrichten/](./features/client-nachrichten/spec.md) |
| Client Chat                        | ✅      | ⏳      | [client-chat/](./features/client-chat/spec.md)               |
| Client Profile                     | ✅      | ⏳      | [client-profile/](./features/client-profile/spec.md)         |
| Appointment Detail (cross-cutting) | ✅      | ⏳      | [appointment-detail/](./features/appointment-detail/spec.md) |
| News Detail (cross-cutting)        | ✅      | ⏳      | [news-detail/](./features/news-detail/spec.md)               |

## Scripts

### Creating a new spec

Scaffold from the template (substitutes title, owner, date):

```bash
specs/_scripts/new-spec.sh <feature-slug> [--title "Display Name"]

# Example
specs/_scripts/new-spec.sh appointment-reminder --title "Appointment Reminder"
```

The script prints the Markdown row to paste into the parity matrix above.

### Checking parity status

Reads all `features/*/parity.md` files and reports status per platform:

```bash
specs/_scripts/parity-status.sh              # full table
specs/_scripts/parity-status.sh --outdated   # only features where Flutter lags Angular
specs/_scripts/parity-status.sh --markdown   # regenerate parity matrix rows for this README
```

Useful for spotting drift between the matrix above and the actual `parity.md` files, and as a CI check that Flutter doesn't fall too far behind.

### Verifying contracts against source

Detects drift between `contracts.md` and the Angular source: extracts TypeScript identifiers (interface names, enum values, field names, method references) from fenced code blocks and reports any that no longer exist under `apps/tagea-frontend/src/`.

```bash
node specs/_scripts/verify-contracts.js              # all features
node specs/_scripts/verify-contracts.js login        # single feature slug
node specs/_scripts/verify-contracts.js --strict     # non-zero exit on any finding (CI)
```

**Allowlist mechanics (so documentation-only shapes don't flag):**

- Code blocks preceded by a blockquote containing "Flutter port note" are treated as Flutter target, not Angular source.
- Code blocks preceded by a blockquote containing "Documentation-only shape" are excluded from verification.
- Inline marker `// documentation-only` inside a code block has the same effect.
- `dart` fenced blocks are always skipped.
