Status: Draft Target
Owner: SaltMarcher Team
Last Reviewed: 2026-07-16
Source of Truth: Session-generation structure, seams, and dependency direction.

# Session Generation Architecture

## Concerns And Boundary

This specification serves Session Planner, Encounter, persistence, and generator
maintainers. The central concern is retaining one deterministic compatibility
pipeline without transferring foreign truth into the Session Planner.

## Current Parallel-Branch Shape

The branch starts from stable R1 before the vertical package move. It therefore
uses `src/domain/sessiongeneration` and `src/data/sessiongeneration` while
preserving the target role boundary. Before merge after R4, these packages move
mechanically to:

```text
features/sessiongeneration/api/
features/sessiongeneration/domain/
features/sessiongeneration/application/
features/sessiongeneration/adapter/sqlite/
```

No JavaFX adapter belongs to SessionGeneration. Session Planner owns the compact
preview and confirmation UI. Encounter owns creature resolution and saved roster
persistence. Application composition supplies both capabilities explicitly.

## Pipeline View

```text
Session Planner input -> SessionGeneration compatibility pipeline
                      -> immutable preview and audits
confirmed preview    -> Encounter exact-CR resolution and import
                      -> Session Planner timeline replacement and references
```

Each pipeline stage is deterministic and independently testable. Reference-data
order and hash are explicit inputs. The UI cannot call data adapters or foreign
domain implementations.

Immutable generation results are encoded with an explicit payload version and
stored in the shared local SQLite database. Session loot references retain only
`(generationId, treasureId)` plus a display cache; restart-safe resolution goes
back through the SessionGeneration boundary.

## Decisions

- A dedicated capability was chosen because putting generator rules in Session
  Planner would violate its authored-session ownership.
- Splitting Encounter and Loot stages across owners was rejected because it
  would fragment one compatibility ruleset and seed sequence.
- Runtime XLSX or network reads were rejected; checked-in normalized resources
  make generation local, repeatable, and offline.
- A new left-bar or state tab was rejected; generation is a Session Planner use
  case and Encounter remains a runtime state-panel tab.

## Enforcement

JUnit owns behavior and Golden-Master proof. `architectureTest` owns target-root
dependency direction after R4. Until relocation, the boundary is Review-Owned.

## References

- `docs/project/architecture/source-architecture.md`
- `docs/sessionplanner/architecture/architecture-session-planner.md`
- `resources/sessiongeneration/sheet-v1/manifest.json`
