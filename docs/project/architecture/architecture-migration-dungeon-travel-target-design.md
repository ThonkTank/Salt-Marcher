Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.3 target design for the Dungeon Travel architecture
migration sub-slice before any wiring-port or implementation commit.

# Dungeon Travel Migration Target Design

## Scope

This design covers M4.3 `dungeon-travel`:

- primary runtime root: `src/domain/dungeon/model/runtime/travel`
- travel usecase/repository bridge files under
  `src/domain/dungeon/model/runtime/usecase` and
  `src/domain/dungeon/model/runtime/repository`
- top-level `src/domain/dungeon/DungeonTravel*.java` services and composition
- travel published surface under `src/domain/dungeon/published`
- visible left-bar route wiring under `src/view/leftbartabs/dungeontravel`
  only where it currently consumes the deleted command/wrapper surfaces

The baseline primary runtime denominator is 40 Java files and 3,647 physical
LOC. The design-visible domain travel service/published set is 59 Java files
and 4,450 physical LOC. The full product route with the left-bar Travel tab is
69 Java files and 5,893 physical LOC
(`docs/project/architecture/architecture-migration-dungeon-travel-baseline.md`).

This artifact is the step-3 design required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M4.3 wiring-port
step may only introduce compatibility seams and port direct references needed
to run the frozen harness inventory against old behavior before the deletion
list is executed.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Current Defect

The Travel projection model is not the defect. `TravelSurfaceProjection`,
`TraversalActionCatalog`, transition target projection, authored surface
mapping, and party-position persistence own real behavior: level readback,
available traversal actions, transition availability, overworld/dungeon
targets, action labels, party-token persistence, and unchanged authored
geometry.

The defect is the command/usecase/repository/assembly ceremony around that
logic. A visible action currently crosses `DungeonTravelStateView`,
`DungeonTravelIntentHandler`, `DungeonTravelRuntimeApplicationService`,
`PublishTravelDungeonSessionUseCase`, `ApplyTravelDungeonSessionUseCase`,
`ApplyTravelDungeonMovementUseCase`, `MoveDungeonTravelActionUseCase`,
projection mappers, Party repository interfaces, and a published-state
repository before state is visible. The baseline measured 11 meaningful hops
to linked-transition party-position mutation and publication, 6 strict
forwarding/proxy classes, 12 design-visible ceremony classes, 4 true product
String boundary families, and 1 separate primitive action-code diagnostic.

M4.3 collapses the command/usecase/repository ceremony into one Travel runtime
application boundary with direct methods, one navigation owner, one surface
loader, one Party gateway, one published-state owner, and typed runtime travel
values. It preserves visible labels, status text, Party behavior, map render
snapshots, and the published Travel snapshots consumed by M4.4 rendering.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.domain.dungeon.DungeonServiceContribution` | Keep the byte-compatible service-registry entrypoint. |
| `src.domain.dungeon.DungeonServiceAssembly` | Stay the Dungeon composition root. Register `DungeonTravelRuntimeApplicationService` and `TravelDungeonModel` directly from the new Travel runtime objects without the separate `DungeonTravelRuntimeServiceAssembly` wrapper. |
| `src.domain.dungeon.DungeonTravelRuntimeApplicationService` | Public Travel runtime boundary. Own direct methods `refresh()`, `selectMap(long)`, `performAction(int)`, `shiftProjectionLevel(int)`, and `setOverlay(DungeonOverlaySettings)`. Own the `TravelDungeonSession`, call `DungeonTravelSurfaceLoader`, call `DungeonTravelNavigator`, normalize external command/view tokens at the boundary, stabilize projection level, and publish through `DungeonTravelPublishedState`. It keeps `applyDungeonTravelSession(ApplyTravelDungeonSessionCommand)` only during the wiring-port commit and removes that method when the command record is deleted. |
| `src.domain.dungeon.DungeonTravelSurfaceLoader` | New package-private owner for session surface loading and initialization. It replaces `LoadTravelDungeonSessionSurfaceUseCase` and `LoadDungeonTravelSurfaceUseCase`: read active Party travel state, honor overworld state, resolve selected map/current position, load authored maps through `DungeonAuthoredApplicationService`, derive state, project a `TravelSurfaceFacts`, save the initial party dungeon position when old behavior did, and preserve the current failed-save surface/status behavior. |
| `src.domain.dungeon.DungeonTravelNavigator` | New package-private owner for selected action movement. It replaces `ApplyTravelDungeonMovementUseCase` and `MoveDungeonTravelActionUseCase`: validate the selected rendered action row, resolve traversal, dungeon transition, overworld transition, unavailable target, invalid action, and no-map results, call `TravelSurfaceProjection`, and commit Party dungeon/overworld positions through `DungeonTravelPartyGateway`. |
| `src.domain.dungeon.DungeonTravelPartyGateway` | New package-private Party adapter replacing `DungeonTravelPartyStateServiceAssembly`, `DungeonTravelPartyPositionServiceAssembly`, `TravelPartyStateRepository`, and `TravelPartyPositionRepository`. It converts Party published models into typed Travel active-state data, writes Party dungeon/overworld travel positions through `PartyApplicationService`, and owns Party mutation status checks. |
| `src.domain.dungeon.DungeonTravelPublishedState` | New package-private published-state owner backed by `src.domain.shared.published.PublishedState`. It replaces `DungeonTravelRuntimePublishedStateServiceAssembly`, owns the current `TravelDungeonModel`, and publishes typed `TravelDungeonSessionSnapshot.SnapshotData` through `DungeonTravelPublishedProjection`. |
| `src.domain.dungeon.DungeonTravelPublishedProjection` | New package-private mapper from typed Travel session snapshots to byte-compatible `TravelDungeonSnapshot`, `DungeonTravelSurfaceSnapshot`, `TravelDungeonWorkspaceState`, `TravelDungeonAction`, `DungeonTravelActionSnapshot`, and published map snapshots. It replaces `DungeonTravelRuntimeSurfaceProjectionServiceAssembly` and `DungeonTravelRuntimeMapProjectionServiceAssembly` without changing published record shapes. |
| `src.domain.dungeon.published.TravelDungeonModel` | Become a stateful model using shared `PublishedState` while keeping class name, package, `current()`, `subscribe(...)`, existing supplier/subscribe constructor, empty default, and listener behavior. |
| `src.domain.dungeon.published.TravelDungeonSnapshot`, `TravelDungeonWorkspaceState`, `TravelDungeonAction`, `DungeonTravelSurfaceSnapshot`, `DungeonTravelPosition`, `DungeonTravelActionSnapshot`, `DungeonTravelActionKind`, `DungeonTravelLocationKind`, `DungeonTravelHeading`, and `DungeonTravelContextKind` | Stay byte-compatible published read surfaces for Travel view, render pipeline, and harnesses. |
| `src.domain.dungeon.published.ApplyTravelDungeonSessionCommand` | Deleted after the wiring port. It is an M4.3-local command carrier that causes the primitive action-code boundary and is not a foreign area seam. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSession` | Stay the in-memory Travel session owner. Absorb projection-level stabilization from `StabilizeTravelDungeonProjectionUseCase`, own typed overlay state, current surface, projection level, current navigation origin, and snapshot creation. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSnapshot` | Stay the typed session snapshot carrier, but reference the typed overlay state owned by `TravelDungeonSession` instead of `TravelDungeonSessionValues`. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionSurface` | Stay the runtime surface data carrier. It owns nested enums `ContextKind`, `LocationKind`, `TopologyKind`, `AreaKind`, `FeatureKind`, and `OverlayMode`, plus typed `OverlayState` and `OverworldTarget` records. These replace the string-backed wrappers in `TravelDungeonSessionValues` before values reach projection or publication. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonActiveState` | Stay the active Party-location helper and data carrier. It uses the typed `TravelDungeonSessionSurface.PositionData`. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionMovement` | Deleted. Its `MoveResultData` and move status live with `DungeonTravelNavigator`, where movement decisions are made. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionCommand` | Deleted. Direct service methods replace the internal command dispatcher. |
| `src.domain.dungeon.model.runtime.travel.session.TravelDungeonSessionValues` | Deleted. Typed enum/value owners move to `TravelDungeonSessionSurface`, `TravelActionKind`, `TravelHeading`, and the new overlay state. |
| `src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection`, `TraversalActionCatalog`, `TraversalLinkProjection`, `TravelAuthoredSurfaceProjectionMapper`, and related authored-surface projection classes | Stay the concrete Travel projection and action-catalog owners. They may receive typed enum/value signatures but must not change visible action ordering, labels, target resolution, topology refs, or status text. |
| `src.domain.dungeon.model.runtime.travel.projection.TravelActionKind` and `TravelHeading` | Existing files become real enums with the current constants and display behavior. `TravelPositionFacts.LocationKind` is removed; `TravelPositionFacts` uses `TravelDungeonSessionSurface.LocationKind` directly. Published projection is the only place that maps runtime enums to published enum names. |
| `src.view.leftbartabs.dungeontravel.DungeonTravelIntentHandler` | Stay the visible Travel intent adapter. It ports from `ApplyTravelDungeonSessionCommand` to direct service methods and keeps existing camera reset, catalog filtering, selected/open item behavior, overlay parsing, and action-row behavior. |
| `src.view.leftbartabs.dungeontravel.DungeonTravelBinder`, `DungeonTravelContribution`, content models, and views | Stay behavior-compatible Travel UI owners. They may change imports/calls only where the deleted command/service constructor shape requires it. |

## Target Call Chains

Counting rule: count named production class boundaries from visible intent or
service entry to publication or Party mutation. Same-class private helpers,
record construction, and value normalization at the service boundary are not
counted. Published model readback is listed separately where relevant.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Projection level shift | `DungeonTravelControlsView.publish` -> `DungeonTravelIntentHandler.consume(DungeonTravelControlsViewInputEvent)` -> `DungeonTravelRuntimeApplicationService.shiftProjectionLevel` -> `TravelDungeonSession.shiftProjectionLevel`/projection stabilization -> `DungeonTravelPublishedState.publish`; readback then flows through `TravelDungeonModel` -> `DungeonTravelBinder.applySnapshot` -> `DungeonMapContentModel.applyTravelSnapshot` and Travel content models | 5 hops to publication; 8 including visible readback. |
| Overlay mode/range/opacity update | `DungeonTravelControlsView.publish` -> `DungeonTravelIntentHandler.consume(DungeonTravelControlsViewInputEvent)` -> `DungeonTravelRuntimeApplicationService.setOverlay` -> typed `TravelDungeonSession` overlay state -> `DungeonTravelPublishedState.publish` | 5 hops to publication. The generic view `modeKey` string is normalized at the service edge and does not continue through internal Travel commands. |
| Visible linked transition action | `DungeonTravelStateView.ActionRow` -> `DungeonTravelIntentHandler.consume(DungeonTravelStateViewInputEvent)` -> `DungeonTravelRuntimeApplicationService.performAction` -> `DungeonTravelNavigator.move` -> `TravelSurfaceProjection.project`/authored target resolution -> `DungeonTravelPartyGateway.saveDungeonPosition` -> `DungeonTravelPublishedState.publish`; readback then updates state/map models | 7 hops to party-position mutation and publication; 9 including visible readback. The retained projection hop owns real transition resolution and is not ceremony. |
| Visible unlinked transition action | `DungeonTravelStateView.ActionRow` -> `DungeonTravelIntentHandler` -> `DungeonTravelRuntimeApplicationService.performAction` -> `DungeonTravelNavigator.move` -> `TravelSurfaceProjection.project` -> `DungeonTravelPublishedState.publish` | 6 hops to target-unavailable publication; no Party position save. |
| Map selection from Travel catalog | `CatalogCrudControlsView` event -> `DungeonTravelIntentHandler.consume(CatalogCrudControlsViewInputEvent)` -> `DungeonTravelRuntimeApplicationService.selectMap(long)` -> `DungeonTravelSurfaceLoader.loadSelectedMap` -> `TravelSurfaceProjection.project` -> `DungeonTravelPartyGateway.saveDungeonPosition` when old behavior saved initial position -> `DungeonTravelPublishedState.publish` | 7 hops when initial Party position is saved; 6 without the save. The generic catalog string id is parsed once at the view edge. |
| Refresh/current Party position | service startup or harness refresh -> `DungeonTravelRuntimeApplicationService.refresh` -> `DungeonTravelSurfaceLoader.loadCurrentPosition` -> `TravelSurfaceProjection.project` -> `DungeonTravelPublishedState.publish` | 4 hops to publication. |

## Frozen Parity Inventory

The selected M4.3 parity inventory is the ledger inventory closed in step 1.
The retained proof log that freezes proof IDs and their assertion descriptions
is
`build/gradle-run-logs/20260711T072715032998326-pid269538-dungeonTravelProjectionLevelHarness__dungeonEditorCoreBehaviorHarness__dungeonMapRenderParityHarness__checkBehaviorHarnessTopology__checkHarnessMapConsistency.log`.
The focused handoff logs are
`build/gradle-run-logs/20260711T052805Z-staged-focused-handoff.log` and
`build/gradle-run-logs/20260711T072805611416003-pid269974-focused-handoff.log`.

Frozen `dungeonTravelProjectionLevelHarness` proof IDs:

- `DT-LVL-001`
- `DT-LVL-002`
- `DT-ACT-INVALID`
- `DT-ACT-001`
- `DT-ACT-002`

Frozen `dungeonEditorCoreBehaviorHarness` proof IDs:

- `DGI-GEO-001`, `DGI-GEO-002`, `DGI-GEO-003`, `DGI-GEO-004`
- `DGI-CMP-001`, `DGI-CMP-002`, `DGI-CMP-003`
- `DGI-FLOOR-001`, `DGI-FLOOR-002`, `DGI-FLOOR-003`, `DGI-FLOOR-004`, `DGI-FLOOR-005`, `DGI-FLOOR-006`
- `DGI-WALL-001`, `DGI-WALL-002`, `DGI-WALL-003`, `DGI-WALL-004`, `DGI-WALL-005`, `DGI-WALL-006`, `DGI-WALL-007`, `DGI-WALL-008`, `DGI-WALL-009`
- `DGI-DOOR-001`, `DGI-DOOR-002`, `DGI-DOOR-003`, `DGI-DOOR-004`, `DGI-DOOR-006`
- `DGI-PATH-001`, `DGI-PATH-002`, `DGI-PATH-003`, `DGI-PATH-004`, `DGI-PATH-006`, `DGI-PATH-007`
- `DGI-CORRIDOR-001`, `DGI-CORRIDOR-002`, `DGI-CORRIDOR-003`, `DGI-CORRIDOR-004`, `DGI-CORRIDOR-005`
- `DGI-STAIR-004`, `DGI-STAIR-005`
- `DGI-TRANSITION-001`, `DGI-TRANSITION-002`, `DGI-TRANSITION-004`
- `DGI-PATH-005`, `DGI-TRANSITION-005`, `DGI-TRANSITION-006`, `DGI-TRANSITION-007`
- `DGI-DOOR-005`, `DGI-TRANSITION-003`
- `DGI-CLUSTER-001`, `DGI-CLUSTER-002`, `DGI-CLUSTER-003`, `DGI-CLUSTER-004`, `DGI-CLUSTER-005`, `DGI-CLUSTER-006`
- `DGI-ROOM-001`, `DGI-ROOM-002`, `DGI-ROOM-003`, `DGI-ROOM-004`
- `DGI-STR-001`, `DGI-STR-002`, `DGI-STR-003`, `DGI-STR-004`, `DGI-STR-005`, `DGI-STR-006`, `DGI-STR-007`, `DGI-STR-008`, `DGI-STR-009`, `DGI-STR-010`, `DGI-STR-011`, `DGI-STR-012`, `DGI-STR-013`

Frozen `dungeonMapRenderParityHarness` proof IDs:

- `DE-IMG-001`
- `DE-IMG-002`
- `DT-IMG-001`

Frozen topology/map consistency and focused handoff oracles:

- `checkBehaviorHarnessTopology`: task success with the retained harness-map
  topology oracle; the task emits no per-row proof IDs.
- `checkHarnessMapConsistency`: task success with the retained harness-map
  consistency oracle; the task emits no per-row proof IDs.
- focused handoff for `src/domain/dungeon` plus
  `src/view/leftbartabs/dungeontravel`: wrapper and observable log success as
  recorded above; no per-row proof IDs are emitted.

M4.3 wiring and implementation may port imports, constructors, callbacks, and
direct service method calls. They MUST NOT add, remove, rename, split, merge,
weaken, or reinterpret harness scenarios, assertion labels, fixture values,
render snapshots, visible text, or pass/fail oracles.

## Deletion List

The implementation step is incomplete until these files no longer exist:

- `src/domain/dungeon/DungeonTravelPartyPositionServiceAssembly.java`
- `src/domain/dungeon/DungeonTravelPartyStateServiceAssembly.java`
- `src/domain/dungeon/DungeonTravelRuntimeMapProjectionServiceAssembly.java`
- `src/domain/dungeon/DungeonTravelRuntimePublishedStateServiceAssembly.java`
- `src/domain/dungeon/DungeonTravelRuntimeServiceAssembly.java`
- `src/domain/dungeon/DungeonTravelRuntimeSurfaceProjectionServiceAssembly.java`
- `src/domain/dungeon/model/runtime/repository/TravelDungeonSessionPublishedStateRepository.java`
- `src/domain/dungeon/model/runtime/repository/TravelPartyPositionRepository.java`
- `src/domain/dungeon/model/runtime/repository/TravelPartyStateRepository.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonMovementUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/ApplyTravelDungeonSessionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/LoadDungeonTravelSurfaceUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/LoadTravelDungeonSessionSurfaceUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/MoveDungeonTravelActionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/PublishTravelDungeonSessionUseCase.java`
- `src/domain/dungeon/model/runtime/usecase/StabilizeTravelDungeonProjectionUseCase.java`
- `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionCommand.java`
- `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionMovement.java`
- `src/domain/dungeon/model/runtime/travel/session/TravelDungeonSessionValues.java`
- `src/domain/dungeon/published/ApplyTravelDungeonSessionCommand.java`

In-file removal requirements:

- `DungeonTravelRuntimeApplicationService.applyDungeonTravelSession(ApplyTravelDungeonSessionCommand)`
- `TravelPositionFacts.LocationKind`
- string-backed final-class implementations in `TravelActionKind` and
  `TravelHeading`; both files become enums with the same finite values

New files allowed by this design:

- `src/domain/dungeon/DungeonTravelSurfaceLoader.java`
- `src/domain/dungeon/DungeonTravelNavigator.java`
- `src/domain/dungeon/DungeonTravelPartyGateway.java`
- `src/domain/dungeon/DungeonTravelPublishedState.java`
- `src/domain/dungeon/DungeonTravelPublishedProjection.java`

Deleting comments, compressing lines, cosmetically renaming wrappers, or
keeping the same command/usecase/repository chain under new names is Rework.

## Seam Statement

These surfaces stay byte-compatible in M4.3 until their consumer sides migrate:

- `TravelDungeonModel`: service-registry key, class name, package,
  `current()`, `subscribe(...)`, existing supplier/subscribe constructor,
  empty default, and listener behavior.
- `TravelDungeonSnapshot`, `TravelDungeonWorkspaceState`,
  `TravelDungeonAction`, `DungeonTravelSurfaceSnapshot`,
  `DungeonTravelPosition`, `DungeonTravelActionSnapshot`,
  `DungeonTravelActionKind`, `DungeonTravelLocationKind`,
  `DungeonTravelHeading`, and `DungeonTravelContextKind`: record component
  order, component types, accessor names, enum constants, static factories,
  empty/default behavior, and visible text semantics.
- `DungeonTravelRuntimeApplicationService`: service-registry key and class
  name stay. New direct methods are allowed; `applyDungeonTravelSession(...)`
  and `ApplyTravelDungeonSessionCommand` are M4.3-local compatibility surfaces
  and are removed only after the wiring port updates Travel view and frozen
  harness references.
- M4.1 authored-core seams: `DungeonAuthoredApplicationService`, `loadMap`,
  `findMap`, `derive`, `DungeonMap`, `DungeonMapIdentity`, topology refs,
  and authored map behavior.
- M4.2 editor-runtime seams and M4.5 editor-view seams stay unchanged. Travel
  must not change editor controls, editor state snapshots, editor runtime
  operations, or editor visible behavior.
- M4.4 rendering seams stay byte-compatible: `DungeonMapContentModel`,
  `DungeonMapSnapshotProjectionContentPartModel`,
  `DungeonTravelSurfaceSnapshot`, `DungeonTravelPosition`, heading/location
  enums, actor rendering, projection-level behavior, and render parity images.
- Party seams stay byte-compatible: `PartyApplicationService`,
  `ActivePartyModel`, `PartyTravelPositionsModel`, `PartyMutationModel`,
  `MovePartyCharactersCommand`, `PartyDungeonTravelLocationSnapshot`,
  `PartyOverworldTravelLocationSnapshot`, `PartyTravelHeading`, and
  mutation/read status behavior.
- Generic catalog controls and shell APIs stay unchanged. The catalog item id
  remains a generic control string at the view edge; Travel may parse it once
  before calling `DungeonTravelRuntimeApplicationService.selectMap(long)`.
- SQLite schema/persistence semantics stay unchanged. M4.3 does not edit
  `src/data/**`.

## Wiring-Port Boundary

M4.3 step 4 MUST introduce the direct Travel API and published-state
compatibility before deleting the old files:

- add the new direct methods on `DungeonTravelRuntimeApplicationService` while
  keeping `applyDungeonTravelSession(ApplyTravelDungeonSessionCommand)` as a
  temporary compatibility method;
- introduce `DungeonTravelPublishedState`, `DungeonTravelPublishedProjection`,
  `DungeonTravelSurfaceLoader`, `DungeonTravelNavigator`, and
  `DungeonTravelPartyGateway` while the old usecase/repository/assembly files
  still exist;
- register `DungeonTravelRuntimeApplicationService` and `TravelDungeonModel`
  from `DungeonServiceAssembly` without changing service keys;
- port `DungeonTravelIntentHandler` to direct service methods without changing
  UI event semantics, visible text, camera reset, catalog filtering, action-row
  index behavior, or overlay parsing;
- port `DungeonTravelProjectionLevelHarness` and
  `DungeonMapRenderParitySnapshotHarness` away from
  `ApplyTravelDungeonSessionCommand` without changing scenarios or assertions;
- port `test/src/view/leftbartabs/dungeoneditor/DungeonRuntimeProjectionInvariantHarness.java`
  away from deletion-list types including `TravelDungeonSessionCommand`,
  `TravelDungeonSessionMovement.MoveResultData`, `TravelDungeonSessionValues`,
  `TravelPartyStateRepository`, `TravelPartyPositionRepository`,
  `ApplyTravelDungeonMovementUseCase`, `ApplyTravelDungeonSessionUseCase`,
  `LoadDungeonTravelSurfaceUseCase`, `LoadTravelDungeonSessionSurfaceUseCase`,
  `MoveDungeonTravelActionUseCase`, and
  `StabilizeTravelDungeonProjectionUseCase`; the port preserves proof IDs
  `DGI-PATH-005`, `DGI-TRANSITION-005`, `DGI-TRANSITION-006`, and
  `DGI-TRANSITION-007`, their fixtures, selected-action rows, movement/status
  assertions, and target-resolution assertions;
- port `test/src/view/leftbartabs/dungeoneditor/DungeonEditorHarnessPersistenceSupport.java`
  and its nested empty Travel party state/position adapters away from deleted
  `TravelPartyStateRepository` and `TravelPartyPositionRepository`
  registrations while preserving the current default no-party/no-save harness
  behavior and all existing fixture data;
- keep all deletion-list files until step 5 executes the approved
  implementation.

Step 4 may change imports, constructors, callbacks, and direct method calls
needed to keep the frozen proof route running. Step 4 MUST NOT delete the old
implementation, alter harness assertions, change visible behavior, or reshape
published snapshots.

M4.3 step 5 then removes the temporary compatibility command, executes the
deletion list, and makes the new direct Travel runtime owners the only
production route.

## Metric Targets And Exceptions

| Metric | Target for implementation | Design exception |
| --- | --- | --- |
| Primary runtime files and LOC | Primary runtime denominator falls from 40 files / 3,647 physical LOC to 30 files or fewer / 3,200 physical LOC or fewer after adding the new loader/navigator/gateway/state/projection owners. | Real projection/action-catalog classes under `runtime/travel/projection` stay because they own behavior. The target does not chase a 40% LOC drop by flattening projection logic into a god service. |
| Product route with leftbar Travel | Product-route set falls from 69 files / 5,893 physical LOC to 60 files or fewer / 5,400 physical LOC or fewer. | The left-bar view and M4.4 render consumers remain largely untouched for parity and later slice boundaries. |
| Deletion list | All 20 named files are gone. | None. Retaining any deletion-list file or recreating the same chain under a new name is Rework unless this design is amended and judge-approved before implementation. |
| Strict forwarding/proxy classes | Strict forwarding/proxy count falls from 6 to 2 or fewer. | `DungeonServiceContribution` and `DungeonServiceAssembly` are retained service-registry seams and do not count as forwarding-only classes when they do not add behavior hops. |
| Intent-to-publication chains | Projection/overlay routes are at most 5 hops to publication; refresh is at most 4; map selection is at most 7 when initial Party save occurs; linked action is at most 7 to Party mutation and publication; unlinked action is at most 6. | `TravelSurfaceProjection` and authored-surface mappers count as real projection/transition behavior and are not collapsed solely to hit a lower hop number. |
| String boundary round-trips | True product String boundary families fall from 4 to 1 or fewer. The remaining allowed family is the generic catalog control item id string at the view edge, parsed once before service entry. | `DungeonOverlaySettings.modeKey` may remain byte-compatible at the published/view edge, but it must be normalized into a typed overlay mode before entering `TravelDungeonSession`. Published enum-name mapping for render snapshots remains at `DungeonTravelPublishedProjection` only. |
| Primitive typed-boundary diagnostic | The primitive `int actionCode` boundary falls from 1 to 0 by deleting `ApplyTravelDungeonSessionCommand` and calling direct service methods. | None. Keeping `actionCode()` after implementation is Rework. |

The exceptions are individually justified by roadmap slice boundaries and
published seams. They do not permit retaining named wrappers, weakening
harnesses, duplicating helper logic to satisfy CPD, or manufacturing a metric
hit through code compression, comment deletion, cosmetic renaming, or
unrelated merges.

## Untouched Surfaces

- Travel visible text, status labels, action labels, action ordering, catalog
  display behavior, overlay control behavior, projection-level behavior, Party
  token rendering, and authored-geometry immutability stay unchanged.
- `src/view/slotcontent/main/dungeonmap/**` rendering code and image parity
  expectations stay unchanged except for import compatibility if published
  constructors remain byte-compatible.
- `src/view/leftbartabs/dungeontravel/**` layout, JavaFX controls, accessible
  text, camera reset behavior, and content-model bindings stay unchanged
  except for direct service calls replacing the deleted command carrier.
- `src/domain/dungeon/model/core/**`, M4.1 authored-core behavior, and M4.2
  editor-runtime behavior stay unchanged.
- `src/data/**` persistence, schema, mapper, gateway, and repository semantics
  stay unchanged.
- Party domain behavior stays unchanged. Travel only adapts to the existing
  Party application and published model seams.
- Harness scenarios and assertions stay frozen. Any behavior anomaly found
  during implementation is an R2 issue or an area revert, not an in-pass fix.

## Required Reviews

Phase 1 and Phase 2 must approve this artifact before M4.3 step 4 starts.
Reviewers must check that the design names target classes, representative call
chains, the deletion list, seam compatibility, untouched surfaces, frozen
parity inventory, binding metrics, and each exception. "Details during
implementation" is not accepted as design evidence.
