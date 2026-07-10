Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M4.1 target design for the Dungeon authored-core
architecture migration sub-slice before any wiring-port or implementation
commit.

# Dungeon Authored Core Migration Target Design

## Scope

This design covers M4.1 `dungeon-authored-core`:

- primary product subset: `src/domain/dungeon/model/core`
- adjacent authored-core ceremony in top-level `src/domain/dungeon/*.java`
- adjacent authored published models in `src/domain/dungeon/published`
- authored-core-facing wrappers in `src/domain/dungeon/model/runtime/usecase`
  only where this design names them in the deletion list, including the
  current map and detail editor wrappers that would otherwise hide the target
  service boundary

The baseline primary authored-core subset is 209 Java files and 18,689
physical LOC. The design-visible core plus top-level/published ceremony set is
284 Java files and 22,108 physical LOC. `src/data/dungeon` remains counted
separately at 62 Java files and 4,888 LOC and is not a normal M4.1 migration
surface unless a named gateway signature adaptation is required. This design
requires no data gateway signature adaptation.

This artifact is the step-3 design required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M4.1 wiring-port
commit may only introduce compatibility seams and port references needed to
run the frozen harness inventory against old behavior before the deletion list
is executed.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Current Defect

The authored Dungeon map model is not the defect. `DungeonMap` and its
structure owners hold real map invariants: room topology, corridor binding,
door movement, stair geometry, transition catalogs, feature markers, derived
state, and operation feedback. That logic survives M4.1 largely intact.

The defect is the ceremony around that model. Current authored interactions
route through feature-runtime operations, authored runtime usecase wrappers,
core usecase wrappers, publication wrappers, and then the `DungeonMap` owner.
The baseline measured dominant authored-core chains at 7 meaningful hops to a
concrete core mutation, with map creation reaching durable save in 6 hops. It
also identified 13 product/published forwarding or proxy candidates plus 2
data candidates, and 5 product String boundary families
(`docs/project/architecture/architecture-migration-dungeon-authored-core-baseline.md`).

M4.1 removes the extra authored-core application and publication stack while
preserving the feature-runtime interpretation layer for M4.2. Pointer
workflow, draft sessions, render-frame assembly, travel runtime, editor view,
and data persistence stay in their later roadmap slices.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.dungeon.DungeonServiceContribution` | Keep the byte-compatible service-registry entrypoint. |
| `src.domain.dungeon.DungeonServiceAssembly` | Stay the Dungeon composition root and register the new authored application service, the three authored published models, existing editor published models, and travel runtime services without changing external service keys. |
| `src.domain.dungeon.DungeonAuthoredApplicationService` | New public authored-core application boundary consumed by feature runtime. Owns map search/create/rename/delete, authored map load/readback, preview/apply mutation pipeline, operation feedback, repository save/delete, next-id reservation, derived-state rebuild, inspector/snapshot projection trigger, and authored publication. It also owns the request/result records that replace nested command records from deleted map/detail wrapper usecases. |
| `src.domain.dungeon.DungeonAuthoredPublication` | New package-private carrier owner replacing the nested carrier values currently owned by `DungeonAuthoredPublishedStateRepository`: `Snapshot`, `Inspector`, `StatePanelFacts`, `StairGeometry`, `TransitionDestination`, `Mutation`, `Catalog`, `MapMutation`, `MapSummary`, `RoomNarration`, and `RoomExitNarration`. |
| `src.domain.dungeon.DungeonAuthoredPublishedState` | New package-private state owner for `DungeonAuthoredReadModel`, `DungeonAuthoredMutationModel`, and `DungeonMapCatalogModel`, backed by `src.domain.shared.published.PublishedState`; it accepts `DungeonAuthoredPublication` carriers and delegates conversion to the retained projection helpers. |
| `src.domain.dungeon.DungeonAuthoredReadProjectionServiceAssembly` | Keep as authored read projection helper from `DungeonAuthoredPublication` snapshot/inspector carriers to byte-compatible `DungeonAuthoredReadResult`. |
| `src.domain.dungeon.DungeonAuthoredMutationProjectionServiceAssembly` | Keep as authored mutation projection helper from `DungeonAuthoredPublication.Mutation` to byte-compatible `DungeonAuthoredMutationResult`. |
| `src.domain.dungeon.DungeonAuthoredCatalogProjectionServiceAssembly` | Keep as authored map-catalog projection helper from `DungeonAuthoredPublication.Catalog` and `MapMutation` carriers. |
| `src.domain.dungeon.DungeonPublishedMapProjectionServiceAssembly` | Keep the core `DungeonDerivedState`/handle projection to `DungeonMapSnapshot` and published refs. |
| `src.domain.dungeon.published.DungeonAuthoredReadModel` | Become a stateful model using `PublishedState` while keeping `current()`, `subscribe(...)`, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.published.DungeonAuthoredMutationModel` | Become a stateful model using `PublishedState` while keeping `current()`, `subscribe(...)`, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.published.DungeonMapCatalogModel` | Become a stateful model using `PublishedState` while keeping `current()`, `subscribe(...)`, and the existing supplier/subscribe constructor. |
| `src.domain.dungeon.model.core.repository.DungeonMapRepository` | Stay the unchanged data gateway seam for `src/data/dungeon/repository/SqliteDungeonMapRepository`. |
| `src.domain.dungeon.model.core.structure.DungeonMap` | Stay the authored aggregate facade for room, corridor, stair, transition, marker, label, narration, and metadata mutations. Add typed stair-geometry entrypoints so core authoring no longer parses editor string shape/direction values. |
| `src.domain.dungeon.model.core.structure.DungeonMapAuthoring` | Stay the authored map factory/rename owner. |
| `src.domain.dungeon.model.core.structure.DungeonMapRoomAuthoring` and `src.domain.dungeon.model.core.structure.room.RoomTopologyAuthoring` | Stay the concrete room topology mutation owners. |
| `src.domain.dungeon.model.core.structure.DungeonMapConnectionAuthoring` and `src.domain.dungeon.model.core.structure.corridor.CorridorMapAuthoring` | Stay the concrete corridor mutation owners. |
| `src.domain.dungeon.model.core.structure.DungeonMapStairAuthoring`, `src.domain.dungeon.model.core.structure.stair.StairMapAuthoring`, `src.domain.dungeon.model.core.structure.stair.StairCollection`, and `src.domain.dungeon.model.core.structure.stair.StairGeometrySpec` | Stay the stair mutation owners; typed `StairGeometrySpec` is the core boundary for create/save/can-save. |
| `src.domain.dungeon.model.core.structure.transition.TransitionCatalog`, `TransitionDestination`, `TransitionDestinationType`, and `TransitionDestinationTarget` | Stay the transition mutation/value owners; string destination keys are normalized at the authored application boundary before core mutation. |
| `src.domain.dungeon.model.core.projection.DungeonDerivedStateProjection` | Stay the derived-state rebuild owner; the one-line `BuildDungeonDerivedStateUseCase` wrapper is deleted. |
| `src.features.dungeon.runtime.DungeonEditorAuthoredRuntimeAssembly` | Stay the M4.1 feature-runtime composition point, but depend on `DungeonAuthoredApplicationService` instead of constructing the authored-core usecase graph. Its broad runtime ownership is still the M4.2 target. |
| `src.features.dungeon.runtime.DungeonEditorAuthoredRuntimeOperations` and operation-family classes | Stay as the feature-runtime interaction dispatch layer for M4.2. They call the new authored application service in M4.1 rather than old authored usecase wrappers. |

## Target Call Chains

Counting rule: count named production class boundaries from the feature-runtime
operation source to the concrete authored-core mutation owner or durable
authored map write. Feature-runtime interpretation remains M4.2 and is not
collapsed in M4.1. Core owner chains are counted when they represent real
authored map logic, not ceremony.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Create dungeon map from catalog route | `DungeonEditorMapCatalogRuntimeOperations.createMap` -> `DungeonAuthoredApplicationService.createMap` -> `DungeonMapAuthoring.empty` -> `DungeonMapRepository.save`; the same service publishes catalog and snapshot readback | 4 hops to durable authored-map save and publication. |
| Paint or delete a room rectangle | `DungeonEditorRoomPaintRuntimeOperation.apply` -> `DungeonAuthoredApplicationService.applyRoomRectangle` -> `DungeonMap.paintRoomRectangle` or `deleteRoomRectangle` -> `DungeonMapRoomAuthoring` -> `RoomTopologyAuthoring`; the service owns derive/save/publish tail | 5 hops to concrete room topology mutation; no core-usecase or authored-wrapper hop remains. |
| Create a corridor | `DungeonEditorCorridorDraftRuntimeOperation.apply` -> `DungeonAuthoredApplicationService.createCorridor` -> `DungeonMap.createCorridor` -> `DungeonMapConnectionAuthoring.createCorridor` -> `CorridorMapAuthoring.createCorridor`; the service owns derive/save/publish tail | 5 hops to concrete corridor mutation; no core-usecase or authored-wrapper hop remains. |
| Create or save stair geometry | `DungeonEditorStairDraftRuntimeOperation.apply` or `DungeonEditorDetailSaveRuntimeOperations.saveStairGeometry` -> `DungeonAuthoredApplicationService.createStair` or `saveStairGeometry` -> `DungeonMap.createStair` or `saveStairGeometry` with `StairGeometrySpec` -> `DungeonMapStairAuthoring` -> `StairMapAuthoring` -> `StairCollection` | 6 hops to concrete stair collection mutation; the remaining depth is real stair geometry logic and the old string parse boundary is gone from core. |
| Create or update transition link | `DungeonEditorTransitionRuntimeOperation.apply` or `DungeonEditorDetailSaveRuntimeOperations.saveTransitionLink` -> `DungeonAuthoredApplicationService.createTransition` or `saveTransitionLink` -> `DungeonMap.withTransitionCatalog` -> `TransitionCatalog.withCreated` or linked-destination replacement | 4 hops to concrete transition catalog mutation; string destination keys are normalized before core mutation. |
| Move selected authored handle | `DungeonEditorSelectedHandleRuntimeOperation` -> `DungeonAuthoredApplicationService.moveSelectedHandle` -> `DungeonMap.moveCluster` / `moveDoorBinding` / `moveCorridorAnchor` / `moveCorridorWaypoint` / `moveStairAnchor` -> the existing room, door, corridor, or stair owner | At most 5 hops before the relevant concrete core owner; handle-direction strings are normalized at the application boundary. |

Successful mutation routes share one tail inside `DungeonAuthoredApplicationService`:
load current map, apply typed mutation, compare operation feedback, rebuild
`DungeonDerivedStateProjection`, save only changed maps, assemble snapshot,
update authored read/mutation/catalog state, and publish through the three
byte-compatible authored models.

## Frozen Parity Inventory

The selected M4.1 parity inventory is the ledger inventory closed in step 1:

- `./gradlew dungeonEditorCoreBehaviorHarness --console=plain`
- `./gradlew dungeonEditorBehaviorHarness --console=plain`
- `./gradlew dungeonEditorRouteBehaviorHarness --console=plain`
- `./gradlew dungeonEditorDoorBehaviorHarness --console=plain`
- `./gradlew dungeonEditorWallBehaviorHarness --console=plain`
- `./gradlew dungeonEditorRoomBehaviorHarness --console=plain`
- `./gradlew dungeonEditorClusterBehaviorHarness --console=plain`
- `./gradlew dungeonEditorCorridorBehaviorHarness --console=plain`
- `./gradlew dungeonEditorStairBehaviorHarness --console=plain`
- `./gradlew dungeonEditorTransitionBehaviorHarness --console=plain`
- `./gradlew dungeonEditorFeatureBehaviorHarness --console=plain`
- `./gradlew dungeonMapRenderParityHarness --console=plain`
- `./gradlew checkBehaviorHarnessTopology checkHarnessMapConsistency --console=plain`
- `tools/gradle/run-staged-verification.sh focused-handoff --path src/domain/dungeon --area dungeon-authored-core`

M4.1 wiring and implementation may port references, direct constructors, and
callbacks. They MUST NOT add, remove, rename, split, merge, weaken, or
reinterpret the scenarios, assertion labels, fixture values, image snapshots,
or pass/fail oracles.

## Deletion List

The implementation step is incomplete until these classes no longer exist:

- `src/domain/dungeon/model/core/usecase/ApplyDungeonMapCatalogUseCase.java`
- `src/domain/dungeon/model/core/usecase/BuildDungeonDerivedStateUseCase.java`
- `src/domain/dungeon/model/core/usecase/CreateDungeonMapUseCase.java`
- `src/domain/dungeon/model/core/usecase/DeleteDungeonMapUseCase.java`
- `src/domain/dungeon/model/core/usecase/LoadDungeonMapUseCase.java`
- `src/domain/dungeon/model/core/usecase/RenameDungeonMapUseCase.java`
- `src/domain/dungeon/model/core/usecase/SearchDungeonMapsUseCase.java`
- `src/domain/dungeon/DungeonAuthoredPublishedStateServiceAssembly.java`
- `src/domain/dungeon/model/runtime/repository/DungeonAuthoredPublishedStateRepository.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonAuthoredMutationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorAuthoredOperationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorCorridorMutationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorHandleMutationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorHandleOperationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorOperationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorTransitionLinkOperationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyDungeonRoomWallMutationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredFeatureMarkerUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredStairUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorAuthoredTransitionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorMapCatalogUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/CreateDungeonEditorMapUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DeleteDungeonEditorMapUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DeleteDungeonEditorAuthoredFeatureMarkerUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DeleteDungeonEditorAuthoredStairUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DeleteDungeonEditorAuthoredTransitionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DeleteDungeonEditorMapCatalogUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/DungeonEditorAuthoredPublicationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/LoadDungeonEditorAuthoredMapUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PreviewDungeonEditorAuthoredOperationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PublishDungeonEditorAuthoredInspectorUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PublishDungeonEditorAuthoredMutationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PublishDungeonEditorAuthoredSnapshotUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/RenameDungeonEditorMapCatalogUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/RenameDungeonEditorMapUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredLabelNameUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredRoomNarrationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredStairGeometryUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredTransitionDescriptionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorAuthoredTransitionLinkUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorLabelNameUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorRoomNarrationUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorStairGeometryUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorTransitionDescriptionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SaveDungeonEditorTransitionLinkUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SearchDungeonEditorMapCatalogUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/SelectDungeonEditorMapUseCase.java`

`src/domain/dungeon/model/core/usecase/` must be empty or gone after M4.1
implementation. Deleting comments, compressing lines, or keeping the same
wrappers under new names is not migration.

## Seam Statement

These surfaces stay byte-compatible in M4.1 until their consumer sides migrate:

- Every record, enum, sealed result, id wrapper, snapshot, and command-like
  published value under `src/domain/dungeon/published/**`: record component
  order, component types, accessor names, enum constants, static factories, and
  default/empty behavior.
- `DungeonAuthoredReadModel`, `DungeonAuthoredMutationModel`, and
  `DungeonMapCatalogModel`: class names, packages, `current()`,
  `subscribe(...)`, existing supplier/subscribe constructors, listener
  delivery semantics, and empty defaults.
- `DungeonEditorControlsModel`, `DungeonEditorMapSurfaceModel`,
  `DungeonEditorStateModel`, `TravelDungeonModel`, and all travel/editor
  published snapshots not named in the deletion list.
- `DungeonServiceContribution`: public contribution class and service-registry
  participation.
- `DungeonMapRepository`: method names, signatures, value types, and SQLite
  gateway expectations.
- `DungeonMap`, `DungeonMapIdentity`, geometry values, topology refs, room,
  corridor, door, stair, transition, and feature-marker domain value semantics
  used by `src/data/dungeon`, travel runtime, render pipeline, and harnesses.
- `src/features/dungeon/runtime/**`, `src/view/leftbartabs/dungeoneditor/**`,
  `src/view/slotcontent/main/dungeonmap/**`, shell APIs, Party APIs, and
  SQLite schema/persistence semantics except for the narrow wiring references
  needed to consume `DungeonAuthoredApplicationService`.

M4.1 may add typed internal methods on `DungeonMap` and related core classes.
It must not change the published records or visible strings that current views
and harnesses consume.

## Wiring-Port Boundary

M4.1 step 4 MUST introduce the new authored service and stateful published
models as compatibility facades while the old usecases still exist. It MUST
then port these direct consumers before implementation deletes the old files:

- `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeAssembly.java`
- `src/features/dungeon/runtime/DungeonEditorAuthoredRuntimeOperationUseCases.java`
- `src/features/dungeon/runtime/DungeonEditorMapCatalogRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorDetailSaveRuntimeOperations.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeInputTranslator.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeDependencies.java`
- `src/features/dungeon/shell/DungeonEditorFeatureShellBinding.java`
- authored operation-family classes under `src/features/dungeon/runtime/**`
  that currently import `*DungeonEditorAuthored*UseCase`,
  `ApplyDungeonEditor*UseCase`, or `Create/DeleteDungeonEditorAuthored*UseCase`
- retained authored snapshot/readback helpers under
  `src/domain/dungeon/model/runtime/usecase/**`, including
  `LoadDungeonSnapshotUseCase`, `AssembleDungeonSnapshotUseCase`,
  `InspectDungeonSelectionUseCase`, `BuildDungeonEditorSnapshotUseCase`, and
  `ApplyDungeonEditorSessionEffectUseCase`
- `src/domain/dungeon/DungeonTravelRuntimeServiceAssembly.java`
- travel read/projection usecases that currently construct or import
  `LoadDungeonMapUseCase` or `BuildDungeonDerivedStateUseCase`
- `test/src/view/leftbartabs/dungeoneditor/DungeonTransitionInvariantHarness.java`
- `test/src/view/leftbartabs/dungeoneditor/DungeonRuntimeProjectionInvariantHarness.java`

The replacement dependencies are concrete:

- Feature-runtime map/detail operation classes call
  `DungeonAuthoredApplicationService` directly and use its request/result
  records instead of the deleted `Select/Create/Rename/DeleteDungeonEditorMapUseCase`
  and `SaveDungeonEditor*UseCase` nested command records.
- `DungeonEditorRuntimeInputTranslator` returns the new
  `DungeonAuthoredApplicationService.RoomNarrationExitInput` carrier, or a
  feature-runtime-local value adapted immediately at the service call, instead
  of importing `SaveDungeonEditorRoomNarrationUseCase.ExitInput`.
- `DungeonEditorRuntimeDependencies` and `DungeonEditorFeatureShellBinding`
  carry `DungeonAuthoredApplicationService` and the existing editor snapshot
  published repository; they no longer expose
  `DungeonAuthoredPublishedStateRepository`.
- Retained snapshot/readback helpers receive `DungeonAuthoredApplicationService`
  readback/preview results or `DungeonDerivedStateProjection` directly; they
  do not import the deleted `LoadDungeonMapUseCase`,
  `BuildDungeonDerivedStateUseCase`, or authored operation wrappers.
- Travel read/projection construction uses the new authored service's
  read-only map/derived-state methods or direct `DungeonDerivedStateProjection`
  where travel still owns projection-level behavior for M4.3.

Step 4 may change imports, constructors, callbacks, and package-visible
factory methods needed to keep the frozen proof route running. Step 4 MUST NOT
delete the old usecases, alter harness assertions, or move feature-runtime
ownership into the new service. Step 5 then replaces the compatibility facade
internals with the target service shape and executes the deletion list.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| LOC and files | Primary `model/core` subset falls from 209 files / 18,689 LOC to 202 files or fewer / 18,100 LOC or fewer by deleting `model/core/usecase`. The design-visible core plus top-level/published set falls from 284 files / 22,108 LOC to 279 files or fewer after deleting the old top-level authored publication assembly and adding `DungeonAuthoredApplicationService`, `DungeonAuthoredPublication`, and `DungeonAuthoredPublishedState`. The runtime-wrapper deletions are outside that baseline denominator but remain mandatory. | The roadmap explicitly says authored-core real logic survives largely intact. The 40 percent LOC target is not applied to room/corridor/stair/transition/derived-state logic. Reducing that logic to hit a percentage would be gaming the migration. |
| Deletion list | All 47 named files are gone after implementation. | None. Any retained file from the list is Rework unless the design is amended and judge-approved before implementation. |
| Forwarding-only classes | Zero M4.1-owned forwarding-only classes remain in `model/core/usecase`, the authored published-state repository/assembly, or the authored runtime wrapper classes named in the deletion list. | `DungeonPublishedChannelServiceAssembly` may remain for editor/travel published state until M4.2/M4.3 because it owns listener fanout and is not M4.1-only authored ceremony. Feature-runtime operation dispatchers remain for M4.2. |
| Intent-to-mutation chain | Authored map catalog and room/corridor/transition interactions remove all core-usecase and authored-wrapper hops. Target chains are 4-5 hops to durable save or concrete core mutation. Stair geometry and selected-handle paths may remain up to 6 hops because the remaining depth is real stair/handle owner logic. | The core owner chain is not collapsed when it represents actual room/corridor/stair/transition logic. The conformance review must still reject any reintroduced wrapper hop before `DungeonMap`. |
| String round-trips | Core authored mutation methods no longer parse editor string shape/direction or transition destination keys; `DungeonAuthoredApplicationService` normalizes byte-compatible strings at the edge into typed `StairGeometrySpec`, `Direction`, `TransitionDestinationType`, or existing core values before mutation. | Published/view strings remain byte-compatible seams for M4.1: boundary kinds, topology/handle kinds, editor handle direction, corridor endpoint direction, transition destination keys, and visible text. M4.2/M4.5 own later runtime/view typed-model cleanup. |

The exceptions are individually justified by roadmap slice boundaries and
existing consumer seams. They do not permit retaining the named wrappers,
weakening harnesses, or compressing code to manufacture a metric hit.

## Untouched Surfaces

- `src/data/dungeon/**` persistence, schema, mapper, gateway, and repository
  semantics stay unchanged.
- `src/features/dungeon/runtime/**` pointer interpretation, draft session,
  render-frame publication, runtime store, and operation dispatch stay
  behavior-compatible and remain the M4.2 structural target.
- `src/domain/dungeon/model/runtime/travel/**`,
  `DungeonTravelRuntimeApplicationService`, and travel published model behavior
  stay unchanged except for replacing deleted core-usecase construction with
  equivalent authored-map read/derived-state service calls.
- `src/view/slotcontent/main/dungeonmap/**` rendering and
  `src/view/leftbartabs/dungeoneditor/**` editor view code stay unchanged
  except for wiring references required by the new authored service.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or an area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M4.1 step 4 starts.
Reviewers must check that the design names target classes, representative call
chains, the deletion list, seam compatibility, untouched surfaces, frozen
parity inventory, binding metrics, and each exception. "Details during
implementation" is not accepted as design evidence.
