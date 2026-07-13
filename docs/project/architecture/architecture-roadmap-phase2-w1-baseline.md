Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-13
Source of Truth: Phase 2 W1 diagnostic baseline metrics for splitting
`DungeonAuthoredApplicationService` before target design.

# W1 Baseline - DungeonAuthoredApplicationService

## Purpose

This document records the W1 baseline for
`src/domain/dungeon/DungeonAuthoredApplicationService.java`. It is diagnostic:
it measures the current god-file surface, current responsibility clusters,
chain lengths, forwarding/delegation candidates, typed-boundary residue, and
tripwire violations before any target design, wiring port, or implementation.

This baseline does not approve a design and does not authorize production or
harness implementation changes.

Hard constraints for W1:

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Reproduction

Physical LOC:

```bash
wc -l src/domain/dungeon/DungeonAuthoredApplicationService.java
# 1816 src/domain/dungeon/DungeonAuthoredApplicationService.java
```

Nonblank LOC:

```bash
sed '/^[[:space:]]*$/d' \
  src/domain/dungeon/DungeonAuthoredApplicationService.java | wc -l
# 1650
```

Member count, using ctags as the structured Java inventory:

```bash
ctags -x --language-force=Java \
  src/domain/dungeon/DungeonAuthoredApplicationService.java \
  | awk '$2!="local" && $2!="package" && $2!="enumConstant" {n++} END {print n}'
# 197
```

Member-kind breakdown:

```bash
ctags -x --language-force=Java \
  src/domain/dungeon/DungeonAuthoredApplicationService.java \
  | awk '$2!="local" && $2!="package" && $2!="enumConstant" {count[$2]++}
         END {for (kind in count) print kind, count[kind]}' | sort
# class 13
# enum 1
# field 38
# interface 1
# method 144
```

`ctags` reports Java records as `method`. The W1 member count excludes package
markers and enum constants. Including the three `LabelTargetKind` enum
constants gives 200 tags.

Direct production type references:

```bash
rg -l "DungeonAuthoredApplicationService" \
  src/domain/dungeon src/view shell bootstrap src/features/dungeon/runtime
```

Direct production consumers are the service itself,
`DungeonEditorRuntimeApplicationService`, `DungeonServiceAssembly`,
`DungeonTravelSurfaceLoader`, `DungeonTravelNavigator`,
`DungeonEditorRuntimeContext`, and `DungeonEditorRuntimeInputTranslator`. There
are no direct `src/view`, `shell`, or `bootstrap` references.

## File And Tripwire Baseline

| Surface | Physical LOC | Nonblank LOC | Members | Tripwire status |
| --- | ---: | ---: | ---: | --- |
| `DungeonAuthoredApplicationService.java` | 1,816 | 1,650 | 197 | Violates >500 LOC and >40 members |

Adjacent same-package tripwire context:

| Surface | Physical LOC | W1 ownership |
| --- | ---: | --- |
| `src/domain/dungeon/DungeonEditorRuntimeApplicationService.java` | 847 | Consumer/wiring constraint, not W1 implementation scope unless design and wiring-port steps name a byte-compatible adaptation |

No nested responsibility class inside `DungeonAuthoredApplicationService` is
over 500 LOC by the current line-span measurement; the god-file tripwire is
the outer service aggregation itself.

## Public And Published Seams

Top-level public service entrypoints:

- Session/read: `openSession`, `loadMap`, `findMap`, `derive`.
- Room/cluster/boundary mutation: `applyRoomRectangle`,
  `applyClusterBoundaries`, `applyDoorBoundary`, `applyWallBoundary`.
- Handle and preview commit: `moveClusterHandle`, `moveDoorHandle`,
  `moveCorridorHandle`, `moveStairHandle`, `stretchClusterBoundary`,
  `applyPreview`.
- Authored element lifecycle: `createCorridor`, `deleteCorridor`,
  `createStair`, `canCreateStair`, `deleteStair`, `createTransition`,
  `canCreateTransition`, `deleteTransition`, `createFeatureMarker`,
  `canCreateFeatureMarker`, `deleteFeatureMarker`.

Published seam types in this file:

- `RoomNarrationInput`, `RoomNarrationExitInput`
- `LabelNameInput`, `LabelTargetKind`
- `TransitionLinkInput`, `OperationResult`
- `TransitionDescriptionInput`
- `StairGeometryInput`

Nested `Session` entrypoints:

- Package-local: map create/rename/delete, room narration save, label save,
  transition description save, transition link save, stair geometry save, stair
  geometry validation/spec construction.
- Public: `searchMaps`, `loadMap`, `loadMapWithSelection`,
  `executeAuthoredDragPreview`, `executeInMemoryPreview`, `executePreview`.

These seams are byte-compatible until a later approved design explicitly names
both sides of any change.

## Responsibility Cluster Baseline

| Current cluster | Lines | Physical LOC | Nonblank LOC | Members | Current ownership |
| --- | --- | ---: | ---: | ---: | --- |
| Top-level facade, constants, records, public entrypoints | 68-421 | 354 | 310 | 68 | Wires repository/published collaborators, owns public methods and DTO records, delegates most operations to nested clusters |
| `MutationPipeline` | 423-468 | 46 | 40 | 6 | Load, apply, derive, save, operation feedback, snapshot assembly |
| `PublicationOperations` | 469-542 | 74 | 68 | 7 | Snapshot, inspector, and mutation publication into state and published models |
| `LoadOperations` | 543-575 | 33 | 30 | 3 | Authored map load and load-with-selection publication |
| `CorridorFeatureOperations` | 576-640 | 65 | 59 | 6 | Corridor create/delete and feature-marker create/can/delete |
| `StairTransitionOperations` | 641-716 | 76 | 69 | 7 | Stair create/can/delete and transition create/can/delete |
| `HandleOperations` | 717-877 | 161 | 152 | 9 | Cluster, door, corridor, stair, and boundary-stretch handle movement |
| `CatalogOperations` | 878-993 | 116 | 102 | 14 | Map search/create/rename/delete, catalog publication, catalog sorting |
| `TransitionLinkOperations` | 994-1125 | 132 | 124 | 8 | Cross-map transition-link load, rewrite, save-all, and source-map readback |
| `DetailSaveOperations` | 1126-1247 | 122 | 114 | 8 | Room narration, label, transition description/link, and stair-geometry saves |
| `PreviewOperations` | 1248-1420 | 173 | 163 | 10 | Authored drag preview, in-memory preview, room/wall/corridor/move/stair preview dispatch |
| `Session` | 1421-1548 | 128 | 109 | 24 | Runtime-facing session facade over catalog/load/preview/detail-save operations |
| Result and publication records/interfaces | 1549-1587 | 39 | 33 | 5 | Mutation result and publication tuple records |
| `PublicationAssembler` | 1588-1816 | 229 | 212 | 22 | Workspace and published snapshot/inspector/state-panel value assembly |

Split pressure is not uniform: operation clusters are already named but remain
private nested classes inside one outer class with shared fields and a
pass-through session/facade. W1 target design must decide whether these become
cohesive top-level owners, stay grouped behind a justified facade, or are
collapsed into more direct call chains without forwarding rebirth.

## Intent-To-Mutation Chains

Hop convention: count meaningful class-boundary calls from the production route
object to the first authored domain read/mutation. Same-class private helpers
are not counted as additional class-boundary hops. Persistence and publication
tails are listed separately when they materially extend the path.

| Interaction | Baseline chain | Hop count | Tail |
| --- | --- | ---: | --- |
| Catalog create | `DungeonEditorViewModel.createMap` -> feature runtime root/commands -> `DungeonEditorRuntimeContext.createMap` -> `DungeonEditorRuntimeApplicationService.RuntimeSession.createMap` -> authored `Session.createMapCatalog` -> `CatalogOperations.createMapCatalog` -> `CatalogOperations.createMap` -> `DungeonMapAuthoring.empty` -> `DungeonMapRepository.save` | 8 to durable authored map save | Publishes created map id through `DungeonAuthoredPublishedState`; runtime then publishes the editor snapshot/current state |
| Room rectangle paint/delete | `DungeonEditorRoomPaintRuntimeOperation` -> `DungeonEditorRuntimeContext.applyRoomRectangle` -> runtime session -> `DungeonAuthoredApplicationService.applyRoomRectangle` -> `MutationPipeline.executeOperation` -> `DungeonMap.paintRoomRectangle` or `deleteRoomRectangle` | 5 to authored room mutation | `MutationPipeline` derives, saves if changed, assembles snapshot; `PublicationOperations.publishMutation` updates state and published mutation |
| Corridor create/delete | corridor runtime operation/context -> runtime session -> `DungeonAuthoredApplicationService.createCorridor` or `deleteCorridor` -> `CorridorFeatureOperations` -> `MutationPipeline.executeOperation` -> `DungeonMap.createCorridor` or `CorridorMapAuthoring.deleteCorridor` | 6 to authored corridor mutation | Same derive/save/publish mutation tail |
| Stair create | stair draft runtime operation -> runtime effect/commit pipeline -> `DungeonEditorRuntimeContext.createStair` -> runtime session -> `DungeonAuthoredApplicationService.createStair` -> `StairTransitionOperations.createStair` -> `MutationPipeline.executeOperation` -> `DungeonMap.createStair` | 9 to authored stair mutation | Same derive/save/publish mutation tail |
| Transition create/delete | transition runtime operation/context -> runtime session -> `DungeonAuthoredApplicationService.createTransition` or `deleteTransition` -> `StairTransitionOperations` -> `MutationPipeline.executeOperation` -> `TransitionCatalog.withCreated` or `DungeonMap.deleteTransition` | 6 to authored transition mutation | Same derive/save/publish mutation tail |
| Feature marker create/delete | feature runtime operation -> `DungeonEditorRuntimeContext` -> runtime session -> `DungeonAuthoredApplicationService.createFeatureMarker` or `deleteFeatureMarker` -> `CorridorFeatureOperations` -> `MutationPipeline.executeOperation` -> feature-marker collection mutation | 6 to authored feature mutation | Same derive/save/publish mutation tail |
| Transition link save | state-panel/runtime context -> runtime session -> authored `Session.saveAuthoredTransitionLink` -> `DetailSaveOperations.saveAuthoredTransitionLink` -> `TransitionLinkOperations.transitionLinkOperation` -> repository loads source/target -> `TransitionCatalog.authoredTransitionLinkRewrite` -> `DungeonMapRepository.saveAll` | 7 to durable cross-map save | Source map is re-derived and published as mutation result |
| Detail saves | runtime context -> runtime session -> authored `Session` detail method -> `DetailSaveOperations` -> `MutationPipeline.executeOperation` -> concrete map mutation (`saveRoomNarration`, `saveClusterName`, `saveRoomName`, `saveTransitionDescription`, `saveStairGeometry`) | 5 to authored detail mutation | Same derive/save/publish mutation tail |
| Preview execution | runtime session -> authored `Session.executePreview` or `executeAuthoredDragPreview` -> `PreviewOperations` -> `MutationPipeline.previewOperation` -> concrete in-memory map mutation | 4 to preview mutation | Derive and snapshot assembly only; no repository save |
| Travel read/projection | `DungeonTravelSurfaceLoader` or `DungeonTravelNavigator` -> `DungeonAuthoredApplicationService.loadMap`/`findMap` and `derive` -> `TravelAuthoredSurfaceProjectionMapper` | 2 to authored read/derive | Travel movement saves party position through travel gateway; no authored truth mutation |

Baseline dominant chains are 9 hops for stair create through the preview/effect
commit route, 8 hops for catalog create, and 7 hops for transition-link save.
Most direct mutation routes are 5-6 hops before the common derive/save/publish
tail.

## Forwarding And Delegation Baseline

Internal candidates:

- Top-level public methods from `moveClusterHandle` through
  `deleteFeatureMarker` mostly delegate to one nested operation field.
- `Session` is mostly a pass-through facade over `CatalogOperations`,
  `LoadOperations`, `PreviewOperations`, and `DetailSaveOperations`.
- `PublicationOperations` delegates value assembly to `PublicationAssembler`
  while also mutating state and published channels.
- `MutationPipeline` is shared by nearly every mutation and preview path; it
  owns real load/derive/save/feedback behavior, so it is not pure forwarding.

Adjacent consumers, not W1 implementation targets unless the approved design
names a byte-compatible adaptation:

- `DungeonEditorRuntimeApplicationService.RuntimeSession` forwards many calls
  to the authored service or authored `Session`.
- `DungeonEditorRuntimeContext` wraps runtime-session calls for feature
  runtime operations.
- `DungeonEditorFeatureRuntimeRoot` forwards operation-interface methods to
  commands.

W1 target design must avoid turning the current private-operation split into a
set of top-level forwarding classes. Each target class must own data plus the
logic that changes when its named concept changes.

## Typed Boundary Residue

Product String/enum residue immediately inside or across this service boundary:

| Family | Baseline residue | Evidence |
| --- | --- | --- |
| Stair geometry save | `StairGeometryInput` carries `shapeName` and `directionName` strings; runtime parses them back to `StairShape` and `Direction` before building `StairGeometrySpec`. | `StairGeometryInput`; `DungeonEditorRuntimeApplicationService.saveStairGeometry`; `DetailSaveOperations.stairGeometrySpec`; state-panel/published stair geometry facts |
| Stair create preview | Stair draft/runtime preview carries `shape.name()` and `direction.name()` strings; `PreviewOperations.stairPreview` parses them through `StairShape.supportedEditorShape` and `Direction.supportedCardinal`. | `DungeonEditorStairDraftRuntimeOperation`; `PreviewOperations.stairPreview` |
| Direction strings | Corridor door endpoint and handle movement can carry direction strings that are parsed through `Direction.parse`; room-exit narration publication also converts direction to name for workspace values. | `corridorEndpoint`; `HandleOperations.sourceEdge`; `PublicationAssembler.roomExits`; `DungeonEditorAuthoredOperationHelper.roomNarration` |
| Transition destination type | Core projection emits finite `destinationTypeKey` strings and the authored service republishes them to workspace and published state-panel facts. | `DungeonFeatureFacts.TransitionDestinationPanelFacts`; `PublicationAssembler.transitionDestinationFacts` |
| Enum-name mirror projections | Several dungeon runtime/published seams bridge enum families with `.name()`/`valueOf` instead of a shared typed vocabulary. | Handle kind, topology kind, feature kind, area kind, tool/overlay mappings around authored/editor/travel published seams |

Non-counts for W1:

- Map names, room names, cluster names, labels, narration, transition
  descriptions, visible status text, and diagnostic fact text are free-form or
  user-facing text, not finite-domain protocol round-trips.
- Persistence text columns are data-layer concerns unless an approved W1 design
  explicitly requires a gateway signature adaptation.
- JavaFX control text may remain string-backed where no typed alternative
  exists, but the service boundary should not preserve avoidable finite-domain
  String hops without a design justification.

## Baseline Exception Candidates

No exception is approved by this baseline. Candidate issues that the W1 target
design must either remove or justify:

- The current service violates both Phase-2 tripwires: 1,816 physical LOC and
  197 members.
- A byte-compatible public facade may be temporarily justified if other
  consumers still depend on the exact service/seam while internals split, but
  it must not become a delegation-dominant replacement layer.
- The adjacent 847-LOC `DungeonEditorRuntimeApplicationService` is a consumer
  pressure point. W1 should not refactor it as implementation scope, but the
  design must name any wiring-port adaptation needed to keep W1 byte-compatible.
- Typed-boundary residue that is not removed in W1 must be individually listed
  in the design seam statement with a reason tied to persistence or JavaFX
  interop, not convenience.

## Next Step

The next W1 cycle step is target design. The design must include:

- a complete split map covering every current member exactly once;
- named target classes and which data/operations each owns;
- representative target call chains with real hop targets;
- a deletion/list-or-retention list for private nested classes and facade
  members;
- a seam statement for byte-compatible published consumers and typed-boundary
  residue;
- explicit metric targets or judge-accepted exception requests.
