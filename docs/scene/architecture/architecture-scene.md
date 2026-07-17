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

## Current Shape

Scene is one vertical feature under `features/scene`. Its `api` publishes the
asynchronous command boundary and immutable model, `domain` owns the running
workspace, `application` orchestrates foreign facts and the synchronization
saga, `adapter/sqlite` persists Scene-owned truth, and `adapter/javafx`
contributes controls and main content to the passive shell. `SceneFeature` is
the only composition entry point used by `app`.

## Context View

```text
Party API ----------------\
World Planner API ---------+--> Scene application --> Scene SQLite adapter
Session Planner API -------/          |
                                      +--> Encounter runtime-context API
                                                 |
                                                 +--> Encounter-owned runtime
```

Scene consumes `ActivePartyModel`, `WorldPlannerSnapshotModel`,
`PreparedSceneCatalogModel`, `CreatureReferenceIndexModel`, and
`EncounterRuntimeContextApi` only from the providers' `api` packages. It MUST
NOT read foreign repositories, issue creature Catalog page queries, or persist
copied foreign details. Encounter accepts opaque context identifiers and MUST
NOT depend on Scene types.

## Decisions

- Runtime scenes are separate from authored Session Planner scenes because
  planning edits and live play have different consistency and lifecycle needs.
- A prepared scene import creates a new Scene-owned copy on every invocation.
  Provenance remains visible, but no live link back to Session Planner exists.
- Encounter sessions are keyed and persisted by Encounter because moving their
  mutable combat internals into Scene would split Encounter ownership.
- Scene commands and persistence work run asynchronously on the shared
  `ExecutionLane`; `SceneModel.current()` reads published memory and performs no
  persistence or foreign I/O.
- Creature choices and mob labels come from the app-refreshed immutable,
  revisioned creature reference index. Scene subscribes to that index but does
  not own its refresh lifecycle, so Scene activation cannot replace a Catalog
  search result.
- Scene saves the workspace with `encounterSynchronized=false` before sending a
  complete revisioned context snapshot. Only an accepted Encounter revision is
  saved as synchronized. Initialization and refresh retry a pending snapshot.
  This makes recovery after a partial local failure idempotent and observable.
- The Scene JavaFX contribution uses controls and main slots but no state slot,
  preserving simultaneous access to the Encounter state tab.

Rejected alternatives are one global Encounter, live-linked planner scenes,
and Scene-owned combat snapshots. Each would prevent independent party-split
state or duplicate another feature's truth.

## Quality And Enforcement

SQLite writes are transactional inside each owner. Cross-feature synchronization
is a retryable saga rather than an atomic transaction. `check` owns executable
qualification, while `architectureTest` mechanically enforces target package
dependency direction.

## References

- [Source Architecture](../../project/architecture/source-architecture.md)
- [Feature Boundary Standard](../../project/architecture/patterns/feature-boundaries.md)
- [Scene Requirements](../requirements/requirements-scene.md)
- [Scene Persistence Contract](../contract/contract-scene-persistence.md)
