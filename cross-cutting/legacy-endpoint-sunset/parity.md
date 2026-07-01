# Parity: Legacy Endpoint Sunset

## Angular

- **Status:** N/A — this is a process spec. Angular code does not consume the spec directly; the Sunset Table is consulted by humans during refactor PRs and cleanup PRs.

## Flutter

- **Status:** N/A — same as Angular. The Flutter port consults the spec for awareness of which backend endpoints are temporarily kept alive but are scheduled for removal; it should not call them in new code.

## Backend

- **Status:** ✅ Process live — the table is authoritative. Any backend endpoint marked `@deprecated` with a sunset note must have a corresponding row here, and any cleanup PR deleting an endpoint must update the row to `✅ removed`.

## Port Log

| Date       | Who        | What                                                                                                                  |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-05-16 | svenarbeit | Spec created. Initial table: 2 entries from entity-permissions pilot + 2 entries reflecting Auth-Hydration backward-compat. Force-update mechanism captured as future TODO inline. |
