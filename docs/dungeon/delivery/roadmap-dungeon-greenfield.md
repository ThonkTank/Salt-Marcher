Status: Temporary Migration
Owner: SaltMarcher Team
Last Reviewed: 2026-07-18
Source of Truth: Ordered delivery milestones, dependencies, exit gates, and
legacy-deletion boundaries for the Dungeon greenfield migration.

# Dungeon Greenfield Roadmap

## Purpose

This roadmap moves the shipped whole-map Dungeon implementation to the durable
target owned by the Dungeon architecture, domain, requirements, and persistence
contract. It is an execution document, not a second architecture specification.
It is deleted after the final milestone removes every compatibility route named
below.

The migration preserves accepted editor and travel behavior except where the
requirements explicitly add missing behavior such as direct token movement and
the global Dungeon travel context. It does not preserve internal Java types or
disposable Dungeon test data.

## Target Outcome

The completed feature has:

- one canonical authored representation for each Dungeon concept
- one typed Editor boundary with atomic immutable state
- typed accepted or rejected command outcomes instead of unchanged-state
  inference and generic feedback
- real window reads whose cost follows requested chunks, with full entity
  closure loaded only for commands that require it
- patch-based single-map and compound multi-map commits with inverse history
- a JavaFX adapter that depends only on Dungeon APIs and platform UI mechanisms
- stable travel action identity, direct reachable-tile movement, and one global
  cross-map travel-context owner outside Dungeon and Hex
- measured production-route performance and architecture gates that make the
  target properties executable

SaltMarcher remains one local JavaFX process, one SQLite database, and a modular
monolith. Dungeon remains one feature; the roadmap does not split authored,
editor, or travel behavior into services or Gradle modules.

## Fixed Decisions

These decisions are not reopened by individual migration slices:

- authored coordinates are sparse and unbounded in positive and negative
  directions; fixed width and height are not authored limits
- `DungeonMap` is the logical consistency and revision boundary for one map
- stable entity identity is map-wide even when an entity intersects several
  chunks
- one chunk is `64 x 64` cells and viewport reads include one surrounding ring
- the JavaFX adapter owns Dungeon-to-canvas translation; application code does
  not publish render frames or hit structures
- camera, hover, open popups, and other passive interaction state remain local
  to JavaFX
- party travel position remains party-owned runtime truth, never Dungeon
  authored truth
- existing Dungeon rows are disposable development data and may be replaced by
  one automatic destructive schema migration

Changing one of these decisions requires updating its durable owner document
before changing this roadmap.

## Delivery Rules

Every slice must:

1. preserve a runnable production path and pass `./gradlew check`
2. move at least one real production consumer to the target path
3. delete the replaced route in the same milestone instead of adding a second
   indefinite compatibility layer
4. keep previews repository-free after their workset is loaded
5. keep one successful user command equal to one committed revision advance
6. add production-route proof for changed observable behavior and deterministic
   proof for domain, persistence, ordering, and cache invariants

Temporary adapters may translate old state into the next target boundary only
inside the owning milestone. New callers may not depend on them, and each such
adapter must appear in that milestone's deletion gate.

## Milestone Dependency Order

```text
M0 Target Lock And Baseline
  -> M1 Editor API And Atomic State
      -> M2 Canonical Language And Typed Outcomes
          -> M3 Patch Commands And History
              -> M4 Window Store And Incremental Unit Of Work
                  -> M5 Viewport Runtime And Qualification
                  -> M6 Travel Completion And Global Context
                      -> M7 Legacy Deletion And Final Acceptance
```

M5 and M6 may proceed in parallel only after M4 provides the shared window-read
and commit boundaries. M7 starts only after both are complete.

## Current Migration State

- Current foundation: M0 through M3 are complete through PR #508; M4.1 is
  complete on `main` through PR #509. Production catalog CRUD now uses the
  metadata-only `DungeonCatalogStore`, and the remaining whole-map repository
  is explicitly temporary M4 migration infrastructure.
- This slice: M4.2 installs schema version 3 as the single destructive
  Dungeon-only replacement. It makes room-owned cells, absolute cluster
  boundaries, chunk content revisions, and entity-to-chunk membership the
  canonical SQLite shape while discarding pre-v3 Dungeon rows.
- The temporary whole-map bridge moves to those canonical rows so production
  Editor and travel behavior remain runnable. `DungeonChangeSet(before, after)`
  still owns only the later M4 write migration and may not recreate deleted
  storage shapes.
- Next step after this slice merges: M4.3 publishes `DungeonWindowStore` and
  moves the Editor cold viewport/load path to explicit chunk and identity-
  closure reads over the new membership index.

### Active Slice Contract: M4.2 Canonical Schema And Membership

- **Goal and current evidence:** replace the additive legacy schema that stores
  room anchors and reconstructs room ownership from duplicated cluster-floor
  rows. The domain already owns exact `RoomRegion.floorCells`; current SQLite
  loading partitions `dungeon_room_cluster_floor_cells` back into rooms and
  stores cluster centers independently.
- **Owners and implementation surface:** the Dungeon persistence contract owns
  stored semantics; this roadmap owns sequencing. The slice changes the schema
  declaration and migration plan, room/cluster source records and mappers, the
  temporary map loader/writer, chunk/membership indexing, and focused SQLite
  plus production Editor proof.
- **Invariants:** migration version 3 drops and recreates only named Dungeon
  tables, retains no historical Dungeon rows, and leaves Party, Hex, and every
  non-Dungeon table and row byte-for-byte untouched. Room cells are unique per
  room and coordinate; cluster centers and authored bounds derive
  deterministically; boundary cells are absolute; membership contains one row
  per stable entity and intersecting chunk using floor division for negatives;
  chunk rows equal the membership chunk union and carry committed content
  revision.
- **Later-slice exclusions:** M4.2 does not publish window/closure APIs, perform
  row-level patch commits, remove whole-map command/travel reads, or qualify M5
  latency. The full-map bridge may temporarily rebuild canonical rows and
  membership until M4.4 replaces its writer.
- **Deletion boundary:** remove `dungeon_room_floors`,
  `dungeon_room_cluster_floor_cells`, `dungeon_room_cluster_vertices`, stored
  room/cluster position columns, their records and mapping helpers, and every
  loader/writer query that references them. No compatibility view or backfill
  survives.
- **Acceptance and proof:** a real v2-shaped database upgrades automatically to
  v3 with empty canonical Dungeon tables and unchanged non-Dungeon sentinels;
  a production-authored multi-entity map round-trips exact room cells,
  boundaries, revisions, negative chunks, and membership; existing Editor and
  travel behavior remain green; final acceptance is literal green
  `./gradlew check` followed by the desktop install proof.
- **Local candidate evidence (2026-07-18):** the two focused canonical SQLite
  migration/index tests are green; the complete `DungeonEditorBehaviorSuiteTest`
  plus `DungeonTravelProjectionLevelTest` UI route is green; `architectureTest`
  is green; `./gradlew check` is green; and `./gradlew installDesktopApp` is
  green. Publication and required CI remain the slice's open handoff gates.

## M0: Target Lock And Baseline

### Goal

Make the intended architecture unambiguous before another implementation path
is added.

### Deliver

- align Dungeon, Maps, Travel, and source-architecture documents with the target
  boundaries named in this roadmap
- record the accepted editor and travel behavior through production-route tests
  before structural migration begins
- define qualification datasets at small, medium, and large sparse scales so
  operation counts and latency can be compared across milestones
- add or tighten architecture rules that identify the current Editor JavaFX to
  Application dependency as migration debt rather than a permanent allowance
- assign the cross-feature travel-context work to the project roadmap item for
  Dungeon and Hex travel tracking

### Exit Gate

- durable documents contain no `features.maps` API target and name
  `platform.ui.mapcanvas` as the passive mechanism
- Editor, persistence, and travel targets agree on state, command, revision,
  chunk, and ownership semantics
- the current production behavior baseline is green
- every compatibility boundary named in M1 through M7 has exactly one deletion
  milestone

### Locked Baseline

The M0 production-route baseline is the complete `./gradlew check` proof. Its
Dungeon editor acceptance route is `DungeonEditorBehaviorSuiteTest`; its travel
level and projection route is `DungeonTravelProjectionLevelTest`. These tests
remain behavior proof while later milestones replace internals. Architecture
and qualification fixture tests support that proof but do not substitute for
it.

All qualification slices use the deterministic
`DungeonQualificationDataset` fixture with the same `64 x 64` visible chunk
and one-chunk loading ring:

| Scale | Authored cells | Purpose |
| --- | ---: | --- |
| Small | 1,000 | fast correctness and work-count feedback |
| Medium | 10,000 | regression comparison during M3 and M4 |
| Large | 100,000 | M5 production-route performance qualification |

Coordinates span positive and negative sparse space. Qualification reports
must name the dataset, requested chunks, materialized entities, repository
round trips, projection work, and warm/cold run state; latency without these
deterministic work bounds is not an acceptance result.

## M1: Editor API And Atomic State

### Goal

Create the real integration seam before changing domain or persistence
internals.

### Deliver

- publish `DungeonEditorApi.current/subscribe/dispatch`
- publish one immutable, revisioned `DungeonEditorState` containing catalog,
  selected authored window, tool family and options, selection, draft or
  preview, inspector, command status, and request generation
- accept typed `DungeonEditorIntent` values; persistence-touching dispatch stays
  off the JavaFX thread and publishes through the UI dispatcher
- expose the Editor API from `DungeonFeature.Component`
- move Dungeon JavaFX editor consumers to API types and build canvas scenes and
  hit evidence only in the JavaFX adapter
- keep camera, hover, focus, caret, popup, and drag-pixel state JavaFX-local

### Migration Slices

1. Introduce the API and adapt the existing runtime into one atomic state.
2. Move controls and state-pane consumers to the API.
3. Move map scene, hit translation, and pointer dispatch to the API.
4. Enforce the completed boundary through `architectureTest`.

### Exit Gate

- zero Dungeon Editor JavaFX imports from Dungeon application, domain, or SQLite
  packages
- one API state revision supplies controls, map, and state pane without reading
  three independently published models back into application code
- draw and hit evidence are derived from the same consumed Editor state revision
- existing editor behavior remains green through production routes

### Delete

- `DungeonEditorRuntimeDependencies.CompatibilityReadbackModels`
- application-owned prepared render-frame facts and frame-deferral logic
- JavaFX-facing operation bundles and direct runtime-service dependencies
- the Dungeon Editor exception that permits JavaFX-to-Application dependencies

## M2: Canonical Language And Typed Outcomes

### Goal

Make the model and interaction language express product concepts once.

### Deliver

- replace create/delete tool variants with `ToolFamily`, `ToolOptions`, and
  `PointerGesture` semantics owned by the Editor API
- make `RoomRegion` the owner of room floor cells and `RoomCluster` the owner of
  cluster identity, name, and boundaries; derive cluster floor and anchors
- keep one internal representation for cell, edge, direction, topology ref,
  room region, boundary, connection, transition, and marker concepts; public
  DTOs exist only where the API boundary needs immutable publication
- collapse same-layer wrapper/core pairs such as parallel room and room-cluster
  values
- return typed rejection reasons such as blocked route, protected exterior
  wall, referenced connection, invalid stair geometry, stale revision, and
  missing transition destination
- map rejections to specific user-facing status without parsing strings or
  treating an unchanged map as the only rejection signal
- make corridor routing an injected domain policy so a richer route finder can
  replace the initial orthogonal policy without changing editor commands

### Migration Slices

1. Publish typed tool families, family-specific options, and pointer gestures;
   move the JavaFX consumer and retain only one application adapter to the old
   runtime language.
2. Make family and gesture semantics canonical in the runtime; delete the old
   create/delete tool enum, registry, and tool-name translation.
3. Publish typed accepted or rejected outcomes and map stable rejection reasons
   to specific status messages.
4. Establish `RoomRegion` and `RoomCluster` ownership and collapse same-layer
   room and cluster wrapper/core pairs.
5. Remove the remaining duplicate primitives and enum-name round trips within
   the milestone boundary.
6. Inject corridor routing, move feature-marker semantic edits to the typed
   command path, and close the M2 architecture and behavior gates.

### Exit Gate

- adding one tool option changes one tool handler and its owned API/domain types,
  not duplicated enum lists and name translators
- no same-layer model pair converts back and forth solely to preserve migration
  shape
- rejected commands preserve authored state and revision while publishing one
  stable typed reason
- feature-marker label and description edits use the same typed command path as
  other authored semantic edits

### Delete

- duplicate Editor tool, view-mode, overlay, cell, edge, and selection
  representations that have no boundary-specific purpose
- enum `name()`/`valueOf()` round trips between Dungeon layers
- placeholder operation feedback rules and generic no-change status as the only
  rejection explanation

## M3: Patch Commands And Exact History

### Goal

Make one accepted command describe exactly what changed before replacing the
storage path.

### Deliver

- let each authored command return either `Rejected` or an accepted
  `DungeonPatch` with expected revision, changed entities, touched chunks,
  published result facts, and an inverse patch
- represent cross-map transition links as one `DungeonCompoundPatch`
- apply accepted patches to the in-memory workset and publish the resulting
  Editor state without rebuilding an unrelated full-map presentation snapshot
- store forward and inverse patches in per-session history
- measure history by encoded patch bytes or another demonstrated upper bound;
  retain the requirements-owned command and byte limits
- make undo and redo normal committed commands that validate the current
  revision and advance revisions monotonically

### Exit Gate

- no ordinary commit or history entry carries complete before and after maps
- a bidirectional transition-link command undoes and redoes both maps atomically
- a rejected, preview-only, camera, selection, or tool command creates no
  history entry
- retained history cannot exceed its byte budget under the qualification
  dataset

### Delete

- `DungeonChangeSet(before, after)` as the ordinary persistence contract
- full-map snapshot history and structural-object memory estimation
- single-map-only assumptions in committed command history

## M4: Window Store And Incremental Unit Of Work

### Goal

Make sparse access and local writes real at the persistence boundary.

### Deliver

- separate `DungeonCatalogStore`, `DungeonWindowStore`, and
  `DungeonUnitOfWork` application ports
- load explicit chunk keys as window facts with stable headers and continuation
  refs, then load full stable-identity closure only for commands that require it
- persist each entity once and maintain source-local entity-to-chunk membership
  for every chunk the entity intersects
- replace room-anchor and cluster-floor compatibility tables with canonical
  room-cell rows and cluster-boundary rows
- commit `DungeonPatch` or `DungeonCompoundPatch` against expected map
  revisions in one SQLite transaction
- update only affected authored rows, membership rows, chunk inventory, and map
  revisions
- return committed patch results directly; do not reload the whole map after a
  successful write
- reject malformed or incomplete identity closure instead of cloning or
  synthesizing authored entities

### Target Model And Chosen Strategy

M4 replaces the umbrella repository by responsibility and in dependency order:

- `DungeonCatalogStore` owns metadata-only map headers and catalog mutations.
  Its values contain map id, normalized name, and committed revision only.
- `DungeonWindowStore` owns explicit chunk reads and command-specific identity
  closure. A window result contains its map header, requested chunk content
  revisions, each intersecting stable entity once, and explicit continuation
  refs for geometry outside the loaded set. A closure result is revision-bound
  and either complete for every requested stable identity or rejected as
  incomplete/malformed; it never manufactures a partial `DungeonMap` that can
  be mistaken for the whole aggregate.
- `DungeonUnitOfWork` accepts `DungeonPatch` or `DungeonCompoundPatch`, validates
  every expected map revision, and returns committed map/chunk revisions plus
  the patch result facts already known by the command. Single-map and compound
  writes share the same row-level mutation machinery and transaction owner.

The SQLite adapter remains one implementation package but is split internally
by these ports. Canonical entity rows remain the only authored owner;
`dungeon_entity_chunks` and `dungeon_chunks` are replaceable source-local
indexes. Command planning consumes a loaded window plus explicit closure, while
preview consumes only that in-memory workset. Successful commit publication
uses the returned patch facts and does not reload the map.

Rejected alternatives:

- keeping `DungeonMapRepository` and placing three target facades in front of
  it would preserve the same hidden full-map dependency and is rejected
- persisting patches by diffing two mapped full records would retain the
  ordinary whole-map writer under a new name and is rejected
- representing a loaded window as an unmarked partial `DungeonMap` would allow
  commands to infer unseen truth and is rejected
- replacing schema, reads, writes, and every consumer in one slice would make
  rollback and operation-count failures hard to localize and is rejected

### Surface Disposition

| Surface | Decision | M4 consequence |
| --- | --- | --- |
| `DungeonPatch`, `DungeonCompoundPatch`, stable entity refs, chunk keys | Adopt | direct UoW input and spatial index keys |
| SQLite gateway and entity-specific persistence helpers | Adapt | split into catalog, window/closure, and row-level commit paths |
| `DungeonMapRepository`, `DungeonMapRecord`, full-record mapper/writer | Reject | temporary only; delete after the last consumer moves |
| room anchors, duplicated cluster floor/vertices, inventory-only chunks | Reject | destructive Dungeon-only schema replacement in M4.2 |
| command-specific closure requirements | Investigate | bounded M4.3 implementation inventory; every command family must name required refs before it moves |

### Migration Slices

1. **Catalog store:** publish `DungeonCatalogStore`, move real catalog CRUD and
   search, prove metadata-only SQL and revision behavior, and delete catalog
   methods from the umbrella repository.
2. **Canonical schema and membership:** install one destructive Dungeon-only
   schema migration with room-cell, cluster-boundary, chunk revision, and
   entity-membership rows. Adapt the temporary full-map bridge to those rows so
   production remains runnable, prove Party/Hex tables untouched, and delete
   room-anchor plus duplicated cluster geometry tables and mappers.
3. **Window and closure reads:** publish immutable window/header/continuation
   and revision-bound closure values, query only explicit chunks through entity
   membership, and move the Editor cold viewport/load path. Prove cross-chunk
   identity uniqueness, negative chunks, stable ordering, no catalog hydration,
   and typed malformed/incomplete closure rejection.
4. **Single-map unit of work:** implement row-level insert/update/remove for
   every patch change kind, entity membership, affected chunk revisions, and
   map revision in one transaction. Move ordinary commits and undo/redo,
   publish returned result facts without readback, and delete `DungeonChangeSet`
   plus the single-map full-record writer.
5. **Compound unit of work:** commit all map patches through the same row-level
   machinery in one SQLite transaction. Move transition-link commit and shared
   history replay, prove rollback from every failure point, and delete the
   multi-map compatibility writer.
6. **Read-path closure:** move remaining Editor command hydration and Dungeon
   travel reads to windows/closures, delete full-map repository methods,
   `DungeonMapRecord` and its full-record loader/mapper, then tighten the M4
   architecture gate before M5 or M6 starts.

Slice order follows the dependency chain: catalog has no geometry dependency;
window and incremental write correctness require canonical rows and membership;
compound writes reuse proven single-map mutations; the final read deletion is
safe only after Editor and travel consumers both have window routes. A schema
proof failure stops M4.2, and an entity family whose closure cannot be stated
becomes a bounded M4.3 blocker rather than permission to load the whole map.

### Milestone Verification Thesis

- Catalog proof demonstrates zero authored-content hydration, not merely equal
  catalog output.
- Schema proof demonstrates canonical stored truth and Dungeon-only destructive
  scope on the real SQLite migration path.
- Window proof measures requested chunks, returned unique identities,
  continuations, and repository round trips on the shared sparse datasets.
- UoW proof observes exact affected rows, membership, chunk revisions, map
  revisions, returned result facts, and transaction rollback; green aggregate
  equality alone is insufficient.
- Production Editor and travel routes remain the behavior oracle throughout;
  focused adapter tests support but do not replace them.

### Exit Gate

- a cold viewport load issues no full-map authored-content read
- loading a window returns one identity for a cross-chunk corridor, stair,
  transition, label, or room region
- a one-cell edit writes only affected entities and index rows
- stale revision, constraint failure, or storage failure rolls back authored
  rows, membership, chunk inventory, and every involved map revision
- multi-map transition commits use the same unit-of-work path as single-map
  edits

### Delete

- cold-load full-map repository methods from editor and travel production paths
- full-record write mapper and multi-map compatibility writer
- chunk inventory that cannot locate chunk content
- room-anchor, duplicated cluster-floor, and cluster-vertex geometry tables
- unconditional whole-map readback after commit

## M5: Viewport Runtime And Performance Qualification

### Goal

Make runtime work proportional to visible primitives and touched chunks.

### Deliver

- dispatch viewport requests from camera and resize changes using request
  generation and expected map revision
- maintain a bounded weighted workset cache keyed by per-chunk content revision
  that protects visible and actively edited chunks and invalidates only touched
  chunk content
- expose off-window continuations without scanning every authored entity
- derive authored bounds from indexed content rather than fixed map dimensions
- independently invalidate base authored content and dynamic interaction or
  actor layers
- record latency distributions and operation counts for cold load, camera,
  hover, preview, commit, undo, and travel refresh
- qualify the requirements-owned p95 budgets on the agreed sparse datasets

### Exit Gate

- camera-only and hover-only work meets the `16 ms` p95 budget
- preview over a loaded workset meets the `50 ms` p95 budget and performs zero
  repository I/O
- cold-load, render, hit, and commit operation counts grow with requested or
  touched chunks rather than total map size
- a new revision invalidates only affected cached content while preserving
  correct continuations and bounds

### Delete

- fixed authored width, height, and global room-anchor fields
- full-map viewport projection and revision-wide chunk-cache invalidation
- no-op redraw measurement hooks and aggregate-only timing that cannot produce
  percentiles

## M6: Travel Completion And Global Context

### Goal

Complete the documented runtime workflow without giving Dungeon or Hex
ownership of the global travel surface.

### Deliver

- replace action-row addressing with stable `TravelActionId`
- add typed `moveTo(Cell)` for direct movement to a reachable loaded tile
- resolve button actions and token drag through the same travel command and
  typed rejection path
- wait for the Party position mutation result before publishing the resolved
  travel state
- make Dungeon travel read through `DungeonWindowStore`
- introduce a feature-neutral Travel capability that consumes Party position
  plus Dungeon and Hex travel readbacks and owns the single global `Reise`
  state contribution
- keep Dungeon and Hex responsible for their movement semantics and detailed
  interactive workspaces; the global Travel capability selects and publishes
  compact read-only context only

### Exit Gate

- listed actions and direct token drag update the same party-owned position
  through stable typed commands
- invalid and unreachable targets publish a specific outcome and do not
  partially update Party or Dungeon state
- the global `Reise` tab shows Dungeon, Hex, or explicit no-context state from
  one contribution
- Dungeon and Hex no longer own competing global `travel` contribution keys
- travel refresh and movement perform no whole-map Dungeon read

### Delete

- row-index travel commands
- Dungeon map input that can only pan or zoom in travel mode
- Hex-owned global `TravelStateContribution`
- static placeholder ownership outside the feature-neutral Travel capability

## M7: Legacy Deletion And Final Acceptance

### Goal

Prove the target as the only production path and remove the migration itself.

### Deliver

- remove every compatibility adapter and legacy model named by earlier
  milestones
- strengthen architecture rules so target boundaries are permanent
- remove current-state prose that described the retired implementation
- run full functional, persistence, architecture, performance, and repeated UI
  stability qualification
- close the project travel-tracking issue with links to accepted production
  proof

### Exit Gate

- `./gradlew check` is green with no skipped required task
- Editor JavaFX depends only on Dungeon APIs and platform UI mechanisms
- editor and travel use window reads and patch commits exclusively
- no full-map repository, full-record writer, prepared application render frame,
  fixed authored bounds, duplicate global travel contribution, or full-snapshot
  history remains reachable in production
- requirements-owned observable behavior and p95 budgets have production-route
  proof

### Delete

- this roadmap file and the empty `docs/dungeon/delivery/` directory
- migration-only architecture exceptions, compatibility tests, and temporary
  terminology

## Risks And Controls

### Cross-Chunk Identity Closure

An intersecting entity may extend outside the requested window. Window reads
must return the entity once with complete command-relevant closure and separate
continuation evidence. Tests cover entities spanning several chunks and levels.

### Aggregate Consistency With Partial Hydration

Commands declare the closure they require. A command is rejected as
insufficiently loaded rather than guessing about unseen authored truth. The
application may request more chunks or identities and retry with the same
intent generation.

### UI Behavior Drift

M1 changes integration shape before domain meaning. Production-route tests
remain the acceptance owner for selection, preview, focus, canvas output,
persistence readback, and travel outcomes.

### Cache And History Memory

Budgets use encoded or measured retained size, not object-count heuristics.
Oversized single entries remain executable but evict older unprotected entries
and report their measured weight.

### Destructive Dungeon Schema Change

Only Dungeon development rows are disposable. The migration must not touch
Party, Hex, or other feature data, and schema qualification proves that scope
before the automatic migration is enabled.

## References

- [Dungeon Architecture](../architecture/architecture-dungeon-domain.md)
- [Dungeon Domain Model](../domain/domain-dungeon.md)
- [Dungeon Editor Requirements](../requirements/requirements-dungeon-editor.md)
- [Dungeon Travel Requirements](../requirements/requirements-dungeon-travel.md)
- [Dungeon Persistence Contract](../contract/contract-dungeon-persistence.md)
- [Dungeon Map Adoption Architecture](../../maps/architecture/architecture-maps-dungeon-adoption.md)
- [Global Travel State Requirements](../../project/requirements/requirements-travel-state-tab.md)
- [Quality Platforms](../../project/verification/quality-platforms.md)
