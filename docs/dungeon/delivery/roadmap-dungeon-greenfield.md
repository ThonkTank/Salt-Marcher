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
  complete through PR #509, M4.2 through PR #510, and M4.3 through PR #518.
  M4.4 is complete through PR #526, M4.5 through PR #527, and M4.6 through
  PR #534. Production Editor commands, inspectors, history, transition
  linking, and Dungeon Travel now use revision-bound Catalog, Window, identity
  closure, and incremental UoW routes. The whole-map repository/record/loader,
  local identity derivation, compatibility writer, and full-record fixture
  families are deleted.
- M4.6 delivery proof is literal green `./gradlew check` plus
  `./gradlew installDesktopApp`. M5.1 is complete through PR #536 and M5.2
  through PR #538. M5.3 is complete in this change with the same literal green
  proof; M5.4 is next. No intermediate review panel runs; the single independent
  cross-roadmap review runs only after all M7 implementation is complete.

### Completed Slice Contract: M5.3 Indexed Bounds And Paged Continuations

#### Goal And Authoritative Index

- Extend the fresh destructive schema-v6 `dungeon_entity_chunks` index with the
  exact cell extent contributed by one stable entity inside one chunk and its
  total entity chunk count. Add level-keyed `dungeon_authored_level_bounds` as
  the sole public authored-bounds source. There is no v5 translation, backfill,
  preservation path, or schema v7.
- Maintain entity extents, level bounds, chunk revisions, and map revision in
  the same patch/UoW transaction. Normal and compound rollback must restore all
  of them. Bounds are recomputed only for old/new affected levels through
  indexed ordered extrema, never through authored hydration or map scans.
- Preserve the M5.2 cache key `(DungeonChunkKey, contentRevision)`, protection,
  and touched-only invalidation. Per-chunk cached content may carry immutable
  entity extents; it must not carry global bounds or viewport-specific pages.

#### Typed Reads And Paging

- Add typed per-chunk entity extent, authored level bounds, continuation cursor,
  page, and page-request values. `DungeonWindowIndex` and `DungeonWindow` carry
  indexed bounds and the first continuation page; the public viewport snapshot
  publishes only the active level's indexed bounds plus that typed page.
- A continuation candidate is a stable entity intersecting at least one of the
  exact requested chunks. Exclude the complete requested chunk set, deduplicate
  by `(entityRef, offWindowChunk)`, and order by
  `(entityKind, entityId, level, chunkR, chunkQ)`.
- Page size is 256; SQLite reads at most 257 ordered rows to determine an
  exclusive next cursor. A cursor is valid only for the same map, expected map
  revision, request generation, and exact ordered requested-chunk set. Stale,
  superseded, or mismatched requests publish nothing and do not mutate cache.
- Command completeness never depends on paging through every continuation.
  When the number of requested extents is below `entityChunkCount`, the command
  loader resolves the stable entity through revision-bound identity closure.

#### Implementation And Proof

1. Change only the fresh v6 schema/create-drop ownership and constraints; add
   extent/extrema indexes and level-bounds storage with cascade deletion.
2. Derive old/new per-chunk extents from the complete patch-bound entity closure
   in `DungeonSqlitePatchSpatialWriter`; update extent rows and affected level
   bounds atomically before committing chunk/map revisions.
3. Add exact indexed bounds and cursor-page queries to the SQLite window source,
   then thread typed values through cached assembly, command completeness, and
   viewport projection without changing M5.2 cache semantics.
4. Prove empty maps/levels, negative coordinates, multiple levels, moving or
   deleting an extremum, compound commit/rollback, multi-chunk stitching, and
   0/1/256/257/>512 continuation rows with no gaps or duplicates. Stale revision,
   generation, and changed chunk sets must reject.
5. On 1k/10k/100k sparse datasets, bounds statement count is constant per
   requested level, continuation results are capped at 257 rows, and content
   work remains proportional to requested chunks.

#### Delete Gate

- Delete full off-window membership materialization, unpaged continuation
  lists, public bounds derived from `workspaceBounds` or loaded render facts,
  and any authored-table/map-wide scan used for bounds or continuations.
- Literal green focused tests, `./gradlew check`, and
  `./gradlew installDesktopApp` are required before the M5.3 PR merges. M5.4
  starts from that merge without a review cycle.

### Completed Slice Contract: M5.2 Per-Chunk Cache And Touched Invalidation

#### Goal And Ownership

- Add one feature-lifetime `DungeonCachedWindowStore` between all Authored,
  command-workset, and Travel consumers and the SQLite window source. JavaFX,
  static state, and per-session cache instances are forbidden.
- Cache immutable chunk content by `(DungeonChunkKey, contentRevision)`. Map
  revision and viewport rectangles are not cache keys, so unchanged content is
  reusable across map revisions.
- Split the persistence boundary into an exact requested-chunk index read and a
  content read for explicit cache misses. Both are revision-bound; a change
  between reads yields stale/retry rather than mixed-revision facts. I/O never
  runs while the cache monitor is held.
- Assemble cache hits and misses deterministically into the existing
  `DungeonWindow`. A cache value owns one chunk's bounded fragments,
  dependencies, and entity extents; it never owns `DungeonMap`, a complete
  window, or map-wide collections. M5.3 will extend extents into indexed bounds
  and paged continuations without changing the cache key.

#### Capacity, Protection, And Invalidation

- Extend `WeightedViewportCache` with atomic batch lookup/put, protected-key
  replacement, targeted invalidation, and eviction immediately after protection
  is released. Use an access-ordered maximum of 262,144 fact weights; weight is
  the saturating sum of one plus contained atomic spatial facts, dependency
  refs, and extent refs.
- Protect the chunks of the latest accepted visible viewport, excluding its
  prefetch-only ring. Change that protected set only after M5.1 latest-request
  acceptance. Protect command workset chunks through a scoped edit lease from
  load/preview until commit, cancel, or context change.
- After a successful commit, undo, redo, or compound commit, invalidate exactly
  the chunk identities named by committed `chunkRevisions()` before refresh and
  publication. Reject/rollback and rename invalidate nothing; map deletion
  removes only that map; read-only Travel refresh invalidates nothing.

#### Implementation Order And Proof

1. Extend the generic weighted cache and focused platform tests for batches,
   leases/protection, temporary overweight, release eviction, and targeted
   invalidation.
2. Add the typed index/content/extent port values, cached store and deterministic
   window assembler; compose exactly one shared instance in `DungeonFeature`.
3. Split SQLite header/index and miss-content queries. Every content query must
   carry explicit chunk identities plus expected map/content revisions; no
   authored query may scan unrequested content.
4. Bind visible protection after accepted viewport publication, edit protection
   to command worksets, and touched-only invalidation to successful UoW results.
5. Prove with counting production-route fakes and SQLite integration: cold nine
   chunks load nine contents; identical warm reads load zero; a one-chunk pan or
   successful touch loads only the entering/touched chunk; undo, redo and
   compound commits behave likewise; rename/reject load or invalidate none;
   negative chunks and stale two-phase reads remain correct; 100k off-window
   cells do not change statement or loaded-fact counts.

#### Delete Gate

- Delete direct injection of the uncached SQLite window store into Authored or
  Travel, revision-wide/full-map invalidation, whole-window cache values, and
  content reads without explicit miss chunks and expected revisions.
- Literal green focused tests, `./gradlew check`, and
  `./gradlew installDesktopApp` are required before the M5.2 PR merges. M5.3
  starts from that merge without a review cycle.

### Completed Slice Contract: M5.1 Viewport Dispatch And Latest Acceptance

#### Goal And Decisions

- Replace the Editor's fixed `0..63` authored load with a real visible-cell
  viewport request emitted on initial binding, canvas resize, camera pan or
  zoom, selected map change, and projection-level change.
- JavaFX supplies only ordered visible cell bounds and the active level. The
  application binds the selected map, expected catalog revision, and a strictly
  increasing request generation; JavaFX must not manufacture authoritative
  identity or revision state.
- Load exactly the visible chunk set plus one ring through
  `DungeonWindowStore`. Accept a result only when map identity, expected map
  revision, and request generation still match the latest application request.
  Late, stale, malformed, or superseded results publish nothing and never clear
  a newer accepted surface.
- Camera state remains presentation-local. Viewport dispatch may coalesce
  duplicate cell bounds, but it must not turn pan or zoom into domain state.
  M5.2 owns weighted caching and touched-chunk invalidation; M5.3 owns indexed
  bounds and continuations; M5.4 owns physical paint layers and qualification.

#### Implementation And Ownership

1. Add one typed Editor API viewport input/intent and route it through
   `DungeonEditorApiFacade`, `DungeonEditorFeatureRuntimeRoot`, runtime commands,
   context, and session without exposing authored internals to JavaFX.
2. Derive ordered integer cell bounds from the current map-canvas viewport and
   actual canvas dimensions. Bind a dedicated viewport-change callback in
   `DungeonEditorBinder`; emit after initial layout, resize, completed camera
   movement, zoom, selected-map publication, and projection-level publication.
3. Replace `LoadOperations.loadInitialWindow(...0, 0, 63, 63...)` with the
   application-owned viewport request path. Preserve the last accepted viewport
   per map/level for command worksets and make selection/commit refresh reuse
   the latest visible bounds rather than restore a fixed window.
4. Prove exact negative and positive chunk requests, one-ring loading, resize,
   pan, zoom and level redispatch, duplicate coalescing, and rejection of late
   generation, wrong-map, and stale-revision results on production routes.

#### Delete Gate And Proof

- Delete the fixed `0..63` Editor request and every `loadInitialWindow` name or
  fallback that recreates it. No production Editor refresh may choose authored
  bounds independently of the latest visible-cell input.
- Focused API/application/JavaFX behavior tests, then literal green
  `./gradlew check` and `./gradlew installDesktopApp` are required before the
  M5.1 PR is merged. The next slice starts from that merge without a review
  cycle.

### Planned M5 Slice Order

1. M5.1 viewport dispatch and latest-result acceptance.
2. M5.2 bounded per-chunk-revision cache with visible/active protection and
   touched-only invalidation.
3. M5.3 indexed authored bounds and off-window continuations without map-wide
   scans.
4. M5.4 independent base/interaction/actor paint invalidation plus deterministic
   operation-count and p95 qualification on 1k/10k/100k sparse datasets.

### Completed Slice Contract: M4.6 Read-Path Closure

#### Goal, Authoritative Facts, And Boundaries

- All remaining production authored reads use `DungeonCatalogStore` plus
  `DungeonWindowStore`. No Editor or Travel route may call a whole-map
  repository, record loader, or hidden equivalent.
- A command may hydrate only an explicitly marked `DungeonCommandWorkset` bound
  to one map revision and one declared `DungeonCommandReadSpec`. A partial
  `DungeonMap` must never be published, cached, passed as a complete map, or
  accepted for commit without a successful completeness check.
- Travel consumes typed window/closure projections and never receives a
  `DungeonMap` or depends on `DungeonAuthoredApplicationService`.
- M4.6 preserves accepted Editor and Travel behavior. M5 owns cache/runtime and
  performance qualification; M6 owns stable travel action identity, direct
  movement, Party completion ordering, and the global `Reise` context.
- There are no Dungeon Bestandsdaten. Schema v6 remains a destructive
  Dungeon-only replacement: no v5 row translation, backfill, compatibility
  loader, or preservation path is permitted.

#### Port And Workset Decisions

- Extend `DungeonCatalogStore` with metadata-only `find(mapId)` and `first()`
  header reads. Selection is catalog-first and never invents map id `1`.
- Add a narrow typed `DungeonIdentityAllocator` that reserves one identity or a
  bounded contiguous range for every map-wide stable authored family created by
  commands, including rooms, clusters, corridors and their stable anchors,
  feature markers, stairs and their stable children, transitions, and topology
  identities where they are not identical to their semantic owner. SQLite owns
  one atomic technical sequence per kind; reservation creates no placeholder
  map, entity, child row, or topology row. The fresh v6 schema initializes the
  sequences directly and does not migrate v5 identities.
- `DungeonCommandReadSpec` names map identity, expected revision, spatial chunk
  keys, stable seed refs, dependency expansion, request generation, and command
  intent. Inputs and outputs use deterministic chunk-key and entity-ref order.
- `DungeonCommandWorkset` owns the header, loaded chunk identities, complete
  entity snapshots, transitive dependency refs, and its internal command-scoped
  aggregate. Only this marked type may expose that aggregate to command
  planning, and only after `containsComplete(spec)` succeeds.
- `DungeonCommandWorksetResult` is either `Complete(workset)` or a typed reject
  for missing map/entity, stale revision, malformed entity, or incomplete
  entity. Incomplete input maps to the stable authored rejection
  `INSUFFICIENT_LOADED_CLOSURE`; it creates no mutation, publication, cache, or
  history change.

#### Revision-Bound Closure

1. Read the map header from Catalog and bind the request to that exact revision.
2. Load the declared chunks plus ring. Merge explicit command refs, window refs,
   continuation refs, and dependency refs in deterministic order.
3. Load identity closure at the same revision and recursively expand snapshot
   dependencies to a fixpoint. Empty ref sets still revision-validate.
4. Reject the complete attempt if any round is stale, missing, malformed, or
   incomplete; never merge facts from different revisions and never guess
   unseen truth.
5. Assemble and validate the marked command workset. A mutating command does not
   retry stale gesture intent automatically. A read-only Travel refresh may
   restart catalog-first once.

Snapshot dependencies must retain every fact required for full command
validation, including cluster members, corridor endpoint/anchor hosts and
referrers, corridor-bound stairs, and linked transition targets. Where reverse
or inbound references cannot be derived from known snapshots, add a typed,
revision-bound discovery request to `DungeonWindowStore`; a map-wide scan or
implicit whole-map closure is forbidden.

#### Command And Travel Hydration

- Semantic edits and inspector reads seed the selected stable ref and its
  dependencies. Spatial room, corridor, stair, transition, and marker commands
  additionally declare the affected chunks plus one ring and every blocker or
  reverse-reference family required by the domain invariant.
- Corridor planning includes endpoints, hosts, anchor referrers, rooms,
  clusters, bound stairs, and both deterministic route candidates. Transition
  linking loads exact source and target transition closures independently at
  their catalog revisions.
- Undo and redo seed the entity refs named by their forward or inverse patches,
  expand their dependencies, rebase only after completeness, and commit through
  the existing UoW. Successful commits update the workset from patch/result
  facts; no post-commit readback is allowed.
- A new `DungeonTravelAuthoredReader` loads the current position chunk plus ring,
  exact stair/transition closure, and target transition plus target-position
  window for cross-map travel. Missing maps, anchors, transitions, or incomplete
  closure produce the existing typed unavailable/rejected outcome.

#### Deletion Gate

Delete the whole-map production surface, including `DungeonMapRepository`,
`DungeonMapRecord`, its mapper and loader chain, whole-map gateway methods,
dummy identity reservation, full-map schema rebuild support, and Authored
`loadMap/findMap/reloadMap` helpers. Split the mixed SQLite repository into a
metadata-only catalog store and the separate identity allocator.

Also delete every legacy create/recompute/materialization overload that still
derives `next*Id` from an aggregate, accepts null or zero child identities, or
silently allocates outside `DungeonIdentityAllocator`. Keeping an unused local
maximum path is not an M4.6 compatibility allowance.

Test setup is not a compatibility exception. Replace full-record fixture
mapping/writing with explicit test map-header setup plus real patch/compound-UoW
inserts. Malformed-source tests may corrupt only the exact target SQL rows after
valid setup. Delete the test-only full-record fixture mapper, writer, and
persistence-helper family; do not create a renamed parallel record model.

Permanent architecture gates prove:

- Authored production depends only on Catalog, Window, UoW, and Identity
  Allocator ports
- Travel depends on neither Authored service nor `DungeonMap`
- no production or test fixture references whole-map repository, record,
  loader, mapper, writer, or compatibility schema rebuild types
- only the marked command workset may own a command-scoped aggregate
- no full-map read or unconditional post-commit readback is reachable

#### Implementation Order And Required Proof

1. Add catalog header reads, identity allocation, dependency-preserving closure,
   the command read spec/workset/result, reverse-reference discovery where
   required, and focused adapter tests.
2. Move ordinary commands, inspector, history, and transition linking to
   worksets; prove exact requests, typed closure failure, no mutation before
   completeness, and no readback after commit.
3. Move Travel to its typed authored reader, rewire composition, delete the
   entire whole-map production and fixture surface, and tighten architecture
   gates.
4. Run focused Editor, Travel, SQLite, and architecture diagnostics, then the
   literal merge-blocking `./gradlew check` and green
   `./gradlew installDesktopApp`. Publish and merge the M4.6 PR after required CI
   is green. Do not run an intermediate review panel.

There is no open architecture decision for an implementation worker. Discovery
that a command invariant cannot be expressed as bounded chunks, stable refs,
dependencies, or typed reverse-reference discovery is an M4.6 planning blocker;
it is not permission to restore a whole-map loader.

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
- only after all M7 implementation changes are complete, run one final
  cross-roadmap review cycle; resolve its findings and repeat the complete proof
  set. M4.5, M4.6, M5, and M6 have delivery proof gates but no intermediate
  review panels
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
