Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Runtime-scene boundaries and cross-feature data flow.

# Runtime Scene Architecture

## Entity And Concerns

This specification serves maintainers of the GM runtime workspace, Encounter
state switching, and Scene persistence. It answers how parallel scenes share
foreign facts without sharing mutable feature internals and how restart-safe
combat remains Encounter-owned.

## Current And Target Shape

The stable implementation remains in the migration-era `src/domain`,
`src/data`, and `src/view` roots. Its internal roles follow the target feature
boundary so the later move to `features/scene/{api,domain,application,adapter}`
is mechanical rather than a redesign.

## Context View

```text
Party API ---------\
World Planner API --+--> Scene application --> Scene persistence
Session Planner API-/          |
                               +--> Encounter runtime-context API
                                          |
                                          +--> Encounter runtime persistence
```

Scene may consume only published foreign facts. It MUST NOT read foreign
repositories or persist copied foreign details. Encounter accepts generic
context keys and MUST NOT depend on Scene types.

## Decisions

- Runtime scenes are separate from authored Session Planner scenes because
  planning edits and live play have different consistency and lifecycle needs.
- Encounter sessions are keyed and persisted by Encounter because moving their
  mutable combat internals into Scene would split Encounter ownership.
- Scene sends a complete revisioned context snapshot. This makes recovery after
  a partial local storage failure idempotent and exposes stale synchronization.
- The Scene JavaFX contribution uses controls and main slots but no state slot,
  preserving simultaneous access to the Encounter state tab.

Rejected alternatives are one global Encounter, live-linked planner scenes,
and Scene-owned combat snapshots. Each would prevent independent party-split
state or duplicate another feature's truth.

## Quality And Enforcement

SQLite writes are transactional inside each owner. Cross-feature synchronization
is retryable rather than described as an atomic transaction. Production-route
tests own restart and reconciliation proof; `architectureTest` remains the
mechanical owner of project dependency rules.
