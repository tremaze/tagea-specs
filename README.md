# Tagea Feature Specs

Single source of truth for feature behavior. Both frontend implementations (Angular + Flutter) are built against these specs.

> **License:** GNU AGPL-3.0-or-later — Copyright © 2026 Tremaze GmbH. See [LICENSE](./LICENSE) for the full text.

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

### Auth flow

| Feature            | Angular | Flutter | Spec                                                         |
| ------------------ | ------- | ------- | ------------------------------------------------------------ |
| Login              | ✅      | ⏳      | [login/](./features/login/spec.md)                           |
| Auth Callback      | ✅      | ⏳      | [auth-callback/](./features/auth-callback/spec.md)           |
| Session Expired    | ✅      | ⏳      | [session-expired/](./features/session-expired/spec.md)       |
| Auth Error         | ✅      | ⏳      | [auth-error/](./features/auth-error/spec.md)                 |
| No Tenant          | ✅      | ⏳      | [no-tenant/](./features/no-tenant/spec.md)                   |
| Blocked Access     | ✅      | ⏳      | [blocked-access/](./features/blocked-access/spec.md)         |
| Awaiting Approval  | ✅      | ⏳      | [awaiting-approval/](./features/awaiting-approval/spec.md)   |
| Password Reset     | ✅      | ⏳      | [password-reset/](./features/password-reset/spec.md)         |
| Email Verification | ✅      | ⏳      | [email-verification/](./features/email-verification/spec.md) |
| Public Register    | ✅      | ⏳      | [public-register/](./features/public-register/spec.md)       |

### Client Portal

| Feature            | Angular | Flutter | Spec                                                         |
| ------------------ | ------- | ------- | ------------------------------------------------------------ |
| Client Dashboard   | ✅      | ⏳      | [client-dashboard/](./features/client-dashboard/spec.md)     |
| Client Termine     | ✅      | ⏳      | [client-termine/](./features/client-termine/spec.md)         |
| Client Dokumente   | ✅      | ⏳      | [client-dokumente/](./features/client-dokumente/spec.md)     |
| Client News        | ✅      | ⏳      | [client-news/](./features/client-news/spec.md)               |
| Client Nachrichten | ✅      | ⏳      | [client-nachrichten/](./features/client-nachrichten/spec.md) |
| Client Chat        | ✅      | ⏳      | [client-chat/](./features/client-chat/spec.md)               |
| Client Profile     | ✅      | ⏳      | [client-profile/](./features/client-profile/spec.md)         |

### Chat & AI

| Feature            | Angular | Flutter | Spec                                           |
| ------------------ | ------- | ------- | ---------------------------------------------- |
| Chat (staff)       | ✅      | ⏳      | [chat/](./features/chat/spec.md)               |
| Chat Room          | ✅      | ⏳      | [chat-room/](./features/chat-room/spec.md)     |
| Chat Invite        | ✅      | ⏳      | [chat-invite/](./features/chat-invite/spec.md) |
| Chat Attachment Source Menu | N/A | 🚧 | [chat-attachment-source-menu/](./features/chat-attachment-source-menu/spec.md) |
| AI Chat (Tagea AI) | ✅      | ⏳      | [ai-chat/](./features/ai-chat/spec.md)         |

### Teamspace

| Feature               | Angular | Flutter | Spec                                                               |
| --------------------- | ------- | ------- | ------------------------------------------------------------------ |
| Teamspace Home        | ✅      | ⏳      | [teamspace-home/](./features/teamspace-home/spec.md)               |
| Teamspace News        | ✅      | ⏳      | [teamspace-news/](./features/teamspace-news/spec.md)               |
| Teamspace Submissions | ✅      | ⏳      | [teamspace-submissions/](./features/teamspace-submissions/spec.md) |
| Teamspace LMS         | ✅      | ⏳      | [teamspace-lms/](./features/teamspace-lms/spec.md)                 |
| Teamspace Events      | ✅      | ⏳      | [teamspace-events/](./features/teamspace-events/spec.md)           |
| Teamspace Calendar    | ✅      | ⏳      | [teamspace-calendar/](./features/teamspace-calendar/spec.md)       |
| Gehaltsnachweise      | ✅      | ⏳      | [gehaltsnachweise/](./features/gehaltsnachweise/spec.md)           |

### Institution Staff (P2 — documentation only, Flutter non-goal)

| Feature                  | Angular | Flutter | Spec                                                       |
| ------------------------ | ------- | ------- | ---------------------------------------------------------- |
| Dashboard                | ✅      | ❌      | [dashboard/](./features/dashboard/spec.md)                 |
| Tasks                    | ✅      | ❌      | [tasks/](./features/tasks/spec.md)                         |
| Institution Calendar     | ✅      | ❌      | [calendar/](./features/calendar/spec.md)                   |
| Clients List             | ✅      | ❌      | [clients/](./features/clients/spec.md)                     |
| Cases List               | ✅      | ❌      | [cases/](./features/cases/spec.md)                         |
| Case Detail (7 tabs)     | ✅      | ❌      | [case-detail/](./features/case-detail/spec.md)             |
| Profile Detail (11 tabs) | ✅      | ❌      | [profile-detail/](./features/profile-detail/spec.md)       |
| Employees List           | ✅      | ❌      | [employees/](./features/employees/spec.md)                 |
| Pending Employees        | ✅      | ❌      | [pending-employees/](./features/pending-employees/spec.md) |
| PEP                      | ✅      | ❌      | [pep/](./features/pep/spec.md)                             |
| Bulk Messaging           | ✅      | ❌      | [bulk-messaging/](./features/bulk-messaging/spec.md)       |
| Reports                  | ✅      | ❌      | [reports/](./features/reports/spec.md)                     |
| Files (Institution)      | ✅      | ❌      | [files-institution/](./features/files-institution/spec.md) |
| Files (Global)           | ✅      | ❌      | [files-global/](./features/files-global/spec.md)           |
| Employee Profile (Own)   | ✅      | ❌      | [employee-profile/](./features/employee-profile/spec.md)   |

### Public (P2)

| Feature           | Angular | Flutter | Spec                                                       |
| ----------------- | ------- | ------- | ---------------------------------------------------------- |
| Welcome / Landing | ✅      | ❌      | [landing-page/](./features/landing-page/spec.md)           |
| Public Booking    | ✅      | ❌      | [public-booking/](./features/public-booking/spec.md)       |
| Public Video Join | ✅      | ❌      | [public-video-join/](./features/public-video-join/spec.md) |

### Cross-cutting features

| Feature            | Angular | Flutter | Spec                                                         |
| ------------------ | ------- | ------- | ------------------------------------------------------------ |
| Appointment Detail | ✅      | ⏳      | [appointment-detail/](./features/appointment-detail/spec.md) |
| News Detail        | ✅      | ⏳      | [news-detail/](./features/news-detail/spec.md)               |
| Knowledge Base     | ✅      | ❌      | [knowledge-base/](./features/knowledge-base/spec.md)         |
| Redaktion          | ✅      | ❌      | [redaktion/](./features/redaktion/spec.md)                   |

### App Shell

These bundles describe the app's chrome (layout, navigation, header, overlays) — everything around the per-feature pages.

| Bundle              | Angular | Flutter | Spec                                                        |
| ------------------- | ------- | ------- | ----------------------------------------------------------- |
| App Shell           | ✅      | ⏳      | [app-shell/](./shell/app-shell/spec.md)                     |
| Main Navigation     | ✅      | ⏳      | [main-navigation/](./shell/main-navigation/spec.md)         |
| Top Bar             | ✅      | ⏳      | [top-bar/](./shell/top-bar/spec.md)                         |
| Notification Center | ✅      | ⏳      | [notification-center/](./shell/notification-center/spec.md) |
| Mode Toggle         | ✅      | ⏳      | [mode-toggle/](./shell/mode-toggle/spec.md)                 |

### Cross-cutting platform

These bundles describe behavior that spans every feature — routing, HTTP, auth/tenant state, i18n/theming, bootstrap.

| Bundle             | Angular | Flutter | Spec                                                              |
| ------------------ | ------- | ------- | ----------------------------------------------------------------- |
| Routing & Guards   | ✅      | ⏳      | [routing-and-guards/](./cross-cutting/routing-and-guards/spec.md) |
| HTTP Interceptors  | ✅      | ⏳      | [http-interceptors/](./cross-cutting/http-interceptors/spec.md)   |
| Context Resolution | ✅      | ⏳      | [context-resolution/](./cross-cutting/context-resolution/spec.md) |
| i18n & Theming     | ✅      | ⏳      | [i18n-and-theming/](./cross-cutting/i18n-and-theming/spec.md)     |
| Bootstrap & Push   | ✅      | ⏳      | [bootstrap-and-push/](./cross-cutting/bootstrap-and-push/spec.md) |

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
