Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M4.1 diagnostic baseline metrics for the Dungeon authored-core
architecture migration sub-slice before target design.

# Dungeon Authored Core Migration Baseline

## Purpose

This document records the M4.1 baseline metrics for `dungeon-authored-core`
before any target design, wiring port, or implementation. The numbers are
diagnostic. They define the baseline for later M4.1 conformance review, but do
not approve a design or prescribe implementation.

## Scope

The roadmap names M4.1 Authored core as `domain/dungeon/model/core/**`: real
logic is expected to survive largely intact while the usecase and published
ceremony around it collapses. The main product denominator is therefore:

- `src/domain/dungeon/model/core`

The adjacent ceremony that must be visible to the design, but is not the
core-logic denominator, is:

- top-level `src/domain/dungeon/*.java`
- `src/domain/dungeon/published`

`src/data/dungeon` is counted separately because it makes the repository and
gateway boundary reproducible, but M5's binding data-layer decision still
applies: data code is not a normal per-area migration target unless the
approved design requires a gateway signature adaptation.

Dungeon editor runtime, dungeon travel runtime, rendering, and editor-view
packages are later M4 slices. They are referenced in call chains only where
they currently route into authored core.

## Reproduction

Core file count and LOC:

```bash
find src/domain/dungeon/model/core -type f -name '*.java' | wc -l
# 209

find src/domain/dungeon/model/core -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 18689 total

find src/domain/dungeon/model/core -type f -name '*.java' -print0 \
  | sort -z | xargs -0 sed '/^[[:space:]]*$/d' | wc -l
# 16699
```

Adjacent ceremony counts:

```bash
find src/domain/dungeon -maxdepth 1 -type f -name '*.java' | wc -l
# 23

find src/domain/dungeon/published -type f -name '*.java' | wc -l
# 52
```

Data count:

```bash
find src/data/dungeon -type f -name '*.java' | wc -l
# 62
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count uses the same file set with blank lines
removed. The measured-set sums below are arithmetic sums of the reproduced
root counts, not a single `find -maxdepth` command.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/domain/dungeon/model/core` | 209 | 18,689 | 16,699 | Main M4.1 authored-core product structure |
| Top-level `src/domain/dungeon/*.java` | 23 | 1,881 | 1,678 | Adjacent service/published composition ceremony |
| `src/domain/dungeon/published` | 52 | 1,538 | 1,317 | Adjacent published seam records/models |
| Core plus adjacent ceremony | 284 | 22,108 | 19,694 | Design-visible M4.1 measurement set |
| `src/data/dungeon` | 62 | 4,888 | 4,418 | Counted separately; not a normal migration target |
| Full reproducible set with data | 346 | 26,996 | 24,112 | Diagnostic only |

## Intent-To-Mutation Chains

Counting rule: count meaningful class-boundary hops from editor/runtime intent
entry to the deepest named authored-core owner before the mutation returns, or
to the durable authored-core write for map creation. Aggregate facade delegates
and the concrete authored-core owner behind them are both counted when both are
explicit class-boundary hops. Command/value construction and same-class private
helpers are not counted. Publication and data tails are recorded separately
when they materially lengthen the path.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Create dungeon map from catalog route | `CreateDungeonEditorMapUseCase.execute` -> `CreateDungeonEditorMapCatalogUseCase.execute` -> `ApplyDungeonMapCatalogUseCase.createMap` -> `CreateDungeonMapUseCase.execute` -> `DungeonMapAuthoring.empty` -> `DungeonMapRepository.save`; after that, runtime applies map lifecycle and publishes catalog/snapshot state | 6 to durable authored map save; 9 including runtime lifecycle and snapshot publication tail | `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorMapUseCase.java:30-40`, `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorMapCatalogUseCase.java:27-30`, `src/domain/dungeon/model/core/usecase/ApplyDungeonMapCatalogUseCase.java:37-39`, `src/domain/dungeon/model/core/usecase/CreateDungeonMapUseCase.java:31-37`, `src/domain/dungeon/model/core/structure/DungeonMapAuthoring.java:16-45` |
| Paint or delete a room rectangle | `ApplyDungeonEditorAuthoredOperationUseCase.executeRoomRectangle` -> `ApplyDungeonRoomWallMutationUseCase.applyRoomRectangle` -> `ApplyDungeonEditorOperationUseCase.execute` -> `LoadDungeonMapUseCase.execute` -> `DungeonMap.paintRoomRectangle` or `deleteRoomRectangle` -> `DungeonMapRoomAuthoring` -> `RoomTopologyAuthoring`; then derived state, repository save, and authored mutation publication run | 7 to concrete authored room topology mutation; 11 including derive/save/publish tail | `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorAuthoredOperationUseCase.java:43-52`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonRoomWallMutationUseCase.java:20-24`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorOperationUseCase.java:55-68`, `src/domain/dungeon/model/core/usecase/LoadDungeonMapUseCase.java:18-31`, `src/domain/dungeon/model/core/structure/DungeonMap.java:355-369`, `src/domain/dungeon/model/core/structure/DungeonMapRoomAuthoring.java:40-44`, `src/domain/dungeon/model/core/structure/room/RoomTopologyAuthoring.java:26-49`, `src/domain/dungeon/model/runtime/usecase/PublishDungeonEditorAuthoredMutationUseCase.java:24-30` |
| Create a corridor | `ApplyDungeonEditorAuthoredOperationUseCase.executeCreateCorridor` -> `ApplyDungeonEditorCorridorMutationUseCase.applyCreate` -> endpoint conversion and optional persistent stair-id reservation -> `ApplyDungeonEditorOperationUseCase.execute` -> `DungeonMap.createCorridor` -> `DungeonMapConnectionAuthoring.createCorridor` -> `CorridorMapAuthoring.createCorridor`; then derive/save/publish tail runs | 7 to concrete authored corridor mutation; 11 including derive/save/publish tail | `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorAuthoredOperationUseCase.java:88-97`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorCorridorMutationUseCase.java:32-45`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorCorridorMutationUseCase.java:80-91`, `src/domain/dungeon/model/core/structure/DungeonMap.java:372-377`, `src/domain/dungeon/model/core/structure/DungeonMapConnectionAuthoring.java:106-112`, `src/domain/dungeon/model/core/structure/corridor/CorridorMapAuthoring.java:30-65` |
| Create or save stair geometry | `CreateDungeonEditorAuthoredStairUseCase.execute` or `SaveDungeonEditorAuthoredStairGeometryUseCase.execute` -> `ApplyDungeonEditorOperationUseCase.execute` -> `DungeonMap.createStair` or `saveStairGeometry` -> `DungeonMapStairAuthoring` -> `StairMapAuthoring` -> `StairCollection`; then derive/save/publish tail runs | 6 to authored stair collection mutation; 10 including derive/save/publish tail | `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredStairUseCase.java:29-41`, `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredStairGeometryUseCase.java:25-41`, `src/domain/dungeon/model/core/structure/DungeonMap.java:311-352`, `src/domain/dungeon/model/core/structure/DungeonMapStairAuthoring.java:11-79`, `src/domain/dungeon/model/core/structure/stair/StairMapAuthoring.java:38-104` |
| Create a transition | `CreateDungeonEditorAuthoredTransitionUseCase.execute` -> persistent transition-id reservation -> `ApplyDungeonEditorOperationUseCase.execute` -> `DungeonMap.withTransitionCatalog` -> `TransitionCatalog.withCreated`; then derive/save/publish tail runs | 5 to authored transition catalog mutation; 9 including derive/save/publish tail | `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredTransitionUseCase.java:30-43`, `src/domain/dungeon/model/core/structure/DungeonMap.java:412-434` |

The dominant authored-core baseline is 7 meaningful hops to concrete core
mutation, while initial map creation reaches durable authored-map save in 6
hops. Successful mutation routes then add the common
derive/save/publication tail:
`BuildDungeonDerivedStateUseCase.execute` -> `DungeonMapRepository.save` ->
`PublishDungeonEditorAuthoredMutationUseCase.execute` ->
`DungeonAuthoredPublishedStateServiceAssembly.publishMutation`.

## Forwarding-Only Baseline

Forwarding-only means a concrete class whose production behavior is primarily
unpacking, delegating, registering, or proxying to another object without
owning meaningful decision logic. Interfaces are noted as seam overhead but not
counted as forwarding-only classes.

| Class | Baseline classification | Evidence |
| --- | --- | --- |
| `src/domain/dungeon/DungeonServiceContribution.java` | Register-only composition candidate | `register` creates a `DungeonServiceAssembly` and delegates registration. |
| `src/domain/dungeon/DungeonServiceAssembly.java` | Composition/register candidate | Registers travel/editor/authored published factories without owning authored-core decisions. |
| `src/domain/dungeon/DungeonAuthoredPublishedStateServiceAssembly.java` | Published-state composition candidate | Holds three channels, registers three models, and forwards authored publications into projection helpers. |
| `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorMapCatalogUseCase.java` | Map-create wrapper candidate | Delegates create to `ApplyDungeonMapCatalogUseCase`, stores the mutation id, and publishes created state. |
| `src/domain/dungeon/model/core/usecase/ApplyDungeonMapCatalogUseCase.java` | Catalog router candidate | Public methods delegate to search/create/rename/delete usecases. |
| `src/domain/dungeon/model/core/usecase/DeleteDungeonMapUseCase.java` | Repository delete wrapper candidate | `execute` delegates to `DungeonMapRepository.delete` and returns the id. |
| `src/domain/dungeon/model/core/usecase/BuildDungeonDerivedStateUseCase.java` | Projection wrapper candidate | `execute` delegates to `DungeonDerivedStateProjection.project`. |
| `src/domain/dungeon/model/runtime/usecase/ApplyDungeonRoomWallMutationUseCase.java` | Room/wall mutation wrapper candidate | Converts command records into lambdas and delegates execution to `ApplyDungeonEditorOperationUseCase`. |
| `src/domain/dungeon/model/runtime/usecase/ApplyDungeonAuthoredMutationUseCase.java` | Handle/boundary mutation wrapper candidate | Converts handle/boundary inputs into `ApplyDungeonEditorOperationUseCase` lambdas. |
| `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorAuthoredOperationUseCase.java` | Authored operation dispatcher candidate | Routes specific editor operations to mutation usecases and then publishes the result. |
| `src/domain/dungeon/published/DungeonAuthoredReadModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a default snapshot. |
| `src/domain/dungeon/published/DungeonAuthoredMutationModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with a default mutation result. |
| `src/domain/dungeon/published/DungeonMapCatalogModel.java` | Published seam proxy | `current()` and `subscribe()` proxy supplied functions with an empty catalog default. |
| `src/data/dungeon/DungeonServiceContribution.java` | Data-layer register wrapper, counted separately | Registers the data assembly only. |
| `src/data/dungeon/repository/SqliteDungeonMapRepository.java` | Data-layer adapter forwarding candidate, counted separately | Repository methods delegate to SQLite gateways and mappers. |

Baseline count: 13 product/published forwarding or proxy candidates plus 2
data-layer candidates counted separately.

Structural overhead that is intentionally not counted as pure forwarding:
`CreateDungeonMapUseCase`, `RenameDungeonMapUseCase`,
`SearchDungeonMapsUseCase`, `LoadDungeonMapUseCase`,
`ApplyDungeonEditorCorridorMutationUseCase`,
`CreateDungeonEditorAuthoredStairUseCase`, and
`CreateDungeonEditorAuthoredTransitionUseCase` own defaults, validation,
identity reservation, endpoint conversion, fallback loading, sorting, or
domain-object construction. They remain design targets if the target design can
collapse them without changing behavior, but they are not pure proxy classes.
`DungeonPublishedChannelServiceAssembly` owns current-state and listener
fanout, so it is not counted as pure forwarding.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Dungeon authored-core boundary and later
parsed, normalized, or matched back into the same finite-domain meaning.
Free-form map names, labels, narration, descriptions, and visible status text
do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Stair shape and direction | Core stair geometry is typed as `StairShape` and `Direction`, but create/save routes publish and accept `shapeName`/`directionName` strings through state-panel and runtime surfaces; `DungeonMap` and `StairMapAuthoring` carry those strings back into `StairCollection`, where shape/direction are parsed and validated. | `src/domain/dungeon/model/core/projection/DungeonFeatureFacts.java:106-139`, `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredStairUseCase.java:35-40`, `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredStairGeometryUseCase.java:25-41`, `src/domain/dungeon/model/core/structure/stair/StairCollection.java:259-265`, `src/domain/dungeon/model/core/structure/stair/StairShape.java:16-29`, `src/domain/dungeon/model/core/geometry/Direction.java:38` |
| Boundary kind | Room boundary materialization owns `BoundaryKind`, but projection and published records expose boundary `kind` as strings such as `wall`, `door`, and `open`; core projection derives topology meaning back from those strings. | `src/domain/dungeon/model/core/structure/room/RoomClusterBoundaryMaterialization.java:44-70`, `src/domain/dungeon/model/core/projection/DungeonBoundaryFacts.java:12-58`, `src/domain/dungeon/DungeonEditorMapProjectionServiceAssembly.java:100`, `src/domain/dungeon/DungeonPublishedMapProjectionServiceAssembly.java:39` |
| Topology and handle kinds | Core topology refs use `DungeonTopologyElementKind`, but published projections convert kind names through `valueOf(ref.kind().name())` and handle kind `valueOf(handle.kind().name())`, creating duplicate finite-domain vocabularies. | `src/domain/dungeon/model/core/graph/DungeonTopologyElementKind.java:4-34`, `src/domain/dungeon/DungeonPublishedMapProjectionServiceAssembly.java:126-143`, `src/domain/dungeon/published/DungeonTopologyElementKind.java`, `src/domain/dungeon/published/DungeonEditorHandleKind.java` |
| Editor handle and corridor endpoint direction | Core authored operations use typed `Direction`, but editor handle publication, workspace handle refs, and corridor door endpoints carry direction strings that are parsed back before handle movement or corridor mutation. | `src/domain/dungeon/DungeonPublishedMapProjectionServiceAssembly.java:134`, `src/domain/dungeon/model/runtime/helper/DungeonEditorWorkspaceHandleProjectionHelper.java:33`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorWorkspaceHandleMovement.java:21`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorHandleOperationUseCase.java:93`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorWorkspaceValues.java:629-640`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorCorridorMutationUseCase.java:104-108` |
| Transition destination type | Transition destination type is typed in core, but selection/publication and state-panel facts carry `destinationTypeKey` strings that the view and runtime draft layer preserve and send back through transition-save routes. | `src/domain/dungeon/model/core/projection/DungeonFeatureFacts.java:150-184`, `src/domain/dungeon/published/DungeonInspectorSnapshot.java:77-95`, `src/view/leftbartabs/dungeoneditor/DungeonEditorStateTransitionContentPartModel.java:248-288`, `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredTransitionLinkUseCase.java:25-43` |

Baseline count: 5 product String boundary families.

Diagnostic non-counts:

- Map names, room names, cluster names, labels, narration, and transition
  descriptions are authored/display text and are not parsed back into finite
  protocol values.
- Persistence text columns are data-layer concerns unless the M4.1 target
  design requires a gateway signature change.
- Renderer CSS/style text and user-facing status messages are outside
  authored-core protocol.

## Residual Notes For Design

- The M4.1 target design must use the 209-file `model/core` product subset as
  the primary structural denominator and explicitly name any top-level
  published or data seam adaptations it includes.
- Published seams consumed by M4.2-M4.5 remain byte-compatible unless the
  approved design migrates both sides in the same reviewed step.
- The frozen M4.1 harness set is the ledger inventory from M4.1 step 1:
  `dungeonEditorCoreBehaviorHarness`, mapped dungeon editor route/family
  harnesses, `dungeonMapRenderParityHarness`, topology/map consistency, and
  focused handoff.
- M4.1 baseline does not authorize wiring or implementation. The next step is
  a judge-approved target design with target classes, representative call
  chains, deletion list, seam statement, frozen parity inventory, and metric
  targets or explicitly justified exceptions.
