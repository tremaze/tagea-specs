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

## Parity Matrix

| Feature | Angular | Flutter | Spec                               |
| ------- | ------- | ------- | ---------------------------------- |
| Login   | ✅      | ⏳      | [login/](./features/login/spec.md) |

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
