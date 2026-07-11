Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-10
Source of Truth: M4.2 diagnostic baseline metrics for the Dungeon editor
session/runtime architecture migration sub-slice before target design.

# Dungeon Editor Session Runtime Migration Baseline

## Purpose

This document records the M4.2 baseline metrics for
`dungeon-editor-session-runtime` after harness closure and before any target
design, wiring port, or implementation. The numbers are diagnostic. They make
the current structure measurable for the next reviewed design, but do not
approve a design or prescribe implementation.

## Scope

The roadmap names M4.2 Editor session/runtime as
`domain/dungeon/model/runtime/**` plus `features/dungeon/runtime/**`. M4.3
separately owns `runtime/travel/**` and the travel published surface. To keep
that boundary explicit, this baseline records three related measurements:

- The reproducible M4.2 product root: `src/features/dungeon/runtime` plus
  `src/domain/dungeon/model/runtime` excluding the `runtime/travel` directory.
- The travel bridge leakage still inside the non-`runtime/travel` runtime root:
  ten `*Travel*.java` repository/usecase files. They remain counted in the
  reproducible M4.2 root unless the target design explicitly marks them as
  untouched M4.3-owned seams.
- Adjacent service and published seams: top-level `src/domain/dungeon/*.java`
  and `src/domain/dungeon/published`. These are design-visible because M4.2
  routes through them, but they are not automatic M4.2 deletion targets.

`src/domain/dungeon/model/runtime/travel` is counted separately as the M4.3
adjacent slice. `src/view/leftbartabs/dungeoneditor` is referenced only for
intent-source call-chain evidence; M4.5 owns the view/input refactor.

## Reproduction

Feature runtime file count and LOC:

```bash
find src/features/dungeon/runtime -type f -name '*.java' | wc -l
# 150

find src/features/dungeon/runtime -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 15286 total

find src/features/dungeon/runtime -type f -name '*.java' -print0 \
  | sort -z | xargs -0 sed '/^[[:space:]]*$/d' | wc -l
# 13671
```

Domain runtime count excluding the M4.3 `runtime/travel` directory:

```bash
find src/domain/dungeon/model/runtime \
  -path src/domain/dungeon/model/runtime/travel -prune \
  -o -type f -name '*.java' -print | wc -l
# 61

find src/domain/dungeon/model/runtime \
  -path src/domain/dungeon/model/runtime/travel -prune \
  -o -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 6091 total

find src/domain/dungeon/model/runtime \
  -path src/domain/dungeon/model/runtime/travel -prune \
  -o -type f -name '*.java' -print0 \
  | sort -z | xargs -0 sed '/^[[:space:]]*$/d' | wc -l
# 5370
```

Travel bridge files inside the non-`runtime/travel` runtime root:

```bash
find src/domain/dungeon/model/runtime \
  -path src/domain/dungeon/model/runtime/travel -prune \
  -o -type f -name '*Travel*.java' -print | sort
# 10 files

find src/domain/dungeon/model/runtime \
  -path src/domain/dungeon/model/runtime/travel -prune \
  -o -type f -name '*Travel*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 889 total
```

Adjacent seam counts:

```bash
find src/domain/dungeon/model/runtime/travel -type f -name '*.java' | wc -l
# 30

find src/domain/dungeon -maxdepth 1 -type f -name '*.java' | wc -l
# 25

find src/domain/dungeon/published -type f -name '*.java' | wc -l
# 52
```

LOC means physical Java file lines from `wc -l`, including blank lines and
comments. Secondary nonblank count uses the same file set with blank lines
removed. The measured-set sums below are arithmetic sums of the reproduced
root counts.

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/features/dungeon/runtime` | 150 | 15,286 | 13,671 | Primary feature runtime |
| `src/domain/dungeon/model/runtime`, excluding `runtime/travel` | 61 | 6,091 | 5,370 | Primary roadmap runtime root; includes ten travel bridge files |
| Primary reproducible M4.2 product root | 211 | 21,377 | 19,041 | Baseline denominator before target-design exclusions |
| Travel bridge files in non-travel runtime root | 10 | 889 | 774 | M4.3 behavior leakage inside the M4.2 reproducible root |
| Clean editor/session subset excluding travel directory and `*Travel*.java` | 201 | 20,488 | 18,267 | Diagnostic lower-bound candidate only; not automatically approved |
| `src/domain/dungeon/model/runtime/travel` | 30 | 2,758 | 2,358 | Adjacent M4.3 travel runtime |
| Top-level `src/domain/dungeon/*.java` | 25 | 4,123 | 3,710 | Adjacent service/published composition seams |
| Top-level non-travel `src/domain/dungeon/*.java` | 18 | 3,592 | 3,236 | M4.2-adjacent non-travel composition seams |
| `src/domain/dungeon/published` | 52 | 1,538 | 1,317 | Shared published seam |
| Non-travel `src/domain/dungeon/published` | 40 | 1,266 | 1,085 | M4.2-adjacent published seam |
| M4.2 root plus non-travel adjacent seams | 269 | 26,235 | 23,362 | Design-visible non-travel surface, with travel bridges still counted |
| Full runtime/service/published set including M4.3 travel | 318 | 29,796 | 26,426 | Diagnostic only; spans M4.2 and M4.3 |

## Intent-To-Runtime Chains

Counting rule: count meaningful class-boundary hops from editor intent or
runtime control entry to the first domain published-state update. Feature
runtime frame fanout is noted as a tail when it materially lengthens the route.
Value construction, records, and same-class private helpers are not counted.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Pointer room paint or delete | `DungeonEditorIntentHandler.consumePointerToolInput` -> `DungeonEditorRuntimePointerPort` -> `DungeonEditorInteractionService.applyPointerInteraction` -> `DungeonEditorPointerOperationDispatcher.applyPointer` -> `DungeonEditorAuthoredRuntimeOperations.applyRoomPaint` -> `DungeonEditorRoomPaintRuntimeOperation.apply` -> `ApplyDungeonEditorSessionEffectUseCase.applyEffect` -> `DungeonEditorPreviewLifecycleUseCase` -> `DungeonAuthoredApplicationService.applyRoomRectangle` -> `PublishDungeonEditorSnapshotUseCase.execute` -> `DungeonEditorPublishedStateServiceAssembly.publish` | 11 to domain publication; 13 including runtime frame publish and binder application | `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:479`, `src/features/dungeon/runtime/DungeonEditorRuntimePointerPort.java:13-20`, `src/features/dungeon/runtime/DungeonEditorInteractionService.java:23-69`, `src/features/dungeon/runtime/DungeonEditorPointerOperationDispatcher.java:85-97`, `src/features/dungeon/runtime/DungeonEditorRoomPaintRuntimeOperation.java:85`, `src/domain/dungeon/model/runtime/usecase/ApplyDungeonEditorSessionEffectUseCase.java:55-60`, `src/domain/dungeon/DungeonAuthoredApplicationService.java:141`, `src/domain/dungeon/DungeonEditorPublishedStateServiceAssembly.java:43`, `src/features/dungeon/runtime/DungeonEditorRuntimeFramePublisher.java:55-60` |
| Selection or handle preview and commit | view pointer route -> `DungeonEditorRuntimePointerPort` -> `DungeonEditorInteractionService` -> dispatcher selection branch -> `DungeonEditorSelectedHandleRuntimeOperation` -> main-view interpreter selection -> `ApplyDungeonEditorSessionEffectUseCase.applyEffect` -> authored move callback (`moveClusterHandle`, `moveDoorHandle`, `moveCorridorHandle`, or `moveStairHandle`) -> snapshot publication | 10 to domain publication | `src/features/dungeon/runtime/DungeonEditorPointerOperationDispatcher.java:101-110`, `src/features/dungeon/runtime/DungeonEditorSelectedHandleRuntimeOperation.java:134`, `src/features/dungeon/runtime/DungeonEditorSelectedHandleRuntimeOperation.java:160`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorSessionWorkflow.java:71-92` |
| Corridor create or delete draft | view pointer route -> `DungeonEditorRuntimePointerPort` -> `DungeonEditorInteractionService` -> dispatcher draft branch -> `DungeonEditorAuthoredRuntimeOperations.applyCorridorDraft` -> `DungeonEditorCorridorDraftRuntimeOperation` -> `DungeonEditorDraftRuntimeContext.corridor` -> `ApplyDungeonEditorSessionEffectUseCase` -> `DungeonEditorDraftAuthoredCommitter` -> `DungeonAuthoredApplicationService.createCorridor` or `deleteCorridor` -> publication | 11 | `src/features/dungeon/runtime/DungeonEditorPointerOperationDispatcher.java:43-74`, `src/features/dungeon/runtime/DungeonEditorCorridorDraftRuntimeOperation.java:42`, `src/features/dungeon/runtime/DungeonEditorDraftRuntimeContext.java:43`, `src/features/dungeon/runtime/DungeonEditorDraftAuthoredCommitter.java:31-61`, `src/domain/dungeon/DungeonAuthoredApplicationService.java:586` |
| Stair create pointer flow | view pointer route -> `DungeonEditorRuntimePointerPort` -> `DungeonEditorInteractionService` -> dispatcher stair branch -> `DungeonEditorStairDraftRuntimeOperation` -> stair draft derivation -> `ApplyDungeonEditorSessionEffectUseCase.applyEffect` -> `DungeonAuthoredApplicationService.createStair` -> publication | 9 | `src/features/dungeon/runtime/DungeonEditorPointerOperationDispatcher.java:67`, `src/features/dungeon/runtime/DungeonEditorStairDraftRuntimeOperation.java:73`, `src/features/dungeon/runtime/DungeonEditorStairDraftRuntimeOperation.java:124`, `src/domain/dungeon/DungeonAuthoredApplicationService.java:647` |
| Tool/control switch | `DungeonEditorRuntimeControlPort.setTool` -> `DungeonEditorRuntimeControlController.selectTool` -> `DungeonEditorStore.dispatch` -> `DungeonEditorRuntimeOperationPublisher.apply` -> `DungeonEditorAuthoredRuntimeOperations.setTool` -> `DungeonEditorProjectionRuntimeOperations.setTool` -> `DungeonEditorRuntimeInputTranslator.tool` -> `SetDungeonEditorToolUseCase.execute` -> `DungeonEditorSessionWorkflow.setTool` -> `PublishDungeonEditorSnapshotUseCase.execute` -> runtime frame publication | 10 to published session update; 11 including frame tail | `src/features/dungeon/runtime/DungeonEditorRuntimeControlPort.java:14-42`, `src/features/dungeon/runtime/DungeonEditorRuntimeControlController.java:47-70`, `src/features/dungeon/runtime/DungeonEditorStore.java:20-55`, `src/features/dungeon/runtime/DungeonEditorRuntimeOperationPublisher.java:11-52`, `src/features/dungeon/runtime/DungeonEditorProjectionRuntimeOperations.java:32-65`, `src/domain/dungeon/model/runtime/usecase/SetDungeonEditorToolUseCase.java:23-40`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorSessionWorkflow.java:39-68` |
| State-panel transition or stair save | `DungeonEditorStateView` event -> `DungeonEditorIntentHandler` -> draft update through `DungeonEditorRuntimeStatePanelDraftPort` or save through `DungeonEditorRuntimeTransitionStairPort` -> `DungeonEditorAuthoredRuntimeOperations` -> `DungeonEditorDetailSaveRuntimeOperations` -> `DungeonAuthoredApplicationService.RuntimeCommands` -> authored command operation -> publication | 8 to 9 | `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:338`, `src/features/dungeon/runtime/DungeonEditorRuntimeStatePanelDraftPort.java:70`, `src/features/dungeon/runtime/DungeonEditorRuntimeTransitionStairPort.java:55`, `src/features/dungeon/runtime/DungeonEditorDetailSaveRuntimeOperations.java:75`, `src/domain/dungeon/DungeonAuthoredApplicationService.java:1550` |
| Runtime render-frame readback | state model subscription -> `DungeonEditorRuntimeFramePublisher.currentFrame` -> `DungeonEditorRuntimeReadbackFrameInputs.from` -> `DungeonEditorRuntimeDraftSession.draftFrame` -> `DungeonEditorRuntimeFrameFactsAssembler.preparedFacts` -> `DungeonEditorRenderFrame` | 5 readback hops after publication | `src/features/dungeon/runtime/DungeonEditorRuntimeFramePublisher.java:25-37`, `src/features/dungeon/runtime/DungeonEditorRuntimeFramePublisher.java:98-109` |

The dominant editor/session runtime baseline is 11 meaningful hops from
pointer intent to domain publication, with a 13-hop end-to-end route when the
runtime frame and binder tail are included. Control and state-panel routes are
shorter but still carry multiple feature-runtime adapter hops before reaching
the session workflow or authored application service.

## Forwarding And Proxy Baseline

Forwarding/proxy candidate means a concrete production class whose current
behavior is primarily unpacking, delegating, translating, registering, or
publishing another object's result. Interfaces are seam overhead but are not
counted as forwarding/proxy classes. This is a baseline inventory, not a
deletion list.

| Group | Candidate classes | Baseline classification |
| --- | --- | --- |
| Feature runtime ports and adapters | `DungeonEditorRuntimeMapCatalogPort`, `DungeonEditorRuntimeControlPort`, `DungeonEditorRuntimePointerPort`, `DungeonEditorAuthoredRuntimeOperations`, `DungeonEditorMapCatalogRuntimeOperations`, `DungeonEditorProjectionRuntimeOperations`, `DungeonEditorRuntimeResultTranslator`, `DungeonEditorDraftRuntimeContext`, `DungeonEditorDraftAuthoredCommitter` | Main M4.2 feature-runtime forwarding/adapter candidates |
| Domain runtime session usecases | `PublishDungeonEditorSnapshotUseCase`, `SetDungeonEditorViewModeUseCase`, `SetDungeonEditorToolUseCase`, `SetDungeonEditorOverlayUseCase`, `ShiftDungeonEditorProjectionLevelUseCase` | Domain session-publication and control wrappers |
| Adjacent service/published seams | `DungeonServiceContribution`, `DungeonServiceAssembly`, `DungeonEditorControlsModel`, `DungeonEditorMapSurfaceModel`, `DungeonEditorStateModel`, `DungeonAuthoredReadModel`, `DungeonAuthoredMutationModel` | Byte-compatible seams visible to M4.2, but not automatic deletion targets |

Baseline count: 21 editor/session/runtime forwarding or proxy candidates.

Adjacent travel candidates are counted separately: ten `*Travel*.java`
bridge/usecase files outside `runtime/travel`, seven top-level
`DungeonTravel*.java` files, and twelve travel published files. M4.2 target
design must either leave these untouched for M4.3 or justify an explicit,
reviewed seam adaptation. They are not silent M4.2 deletion targets.

Structural overhead intentionally not counted as pure forwarding:
`DungeonEditorFeatureRuntimeRoot` wires store, frame publisher, draft session,
subscriptions, and runtime ports; `DungeonEditorRuntimeStatePanelDraftPort`,
`DungeonEditorRuntimeInlineLabelPort`, and
`DungeonEditorRuntimeTransitionStairPort` mutate draft state and choose
publication behavior. The target design may still simplify them, but they are
not baseline pure proxies.

## String Boundary Round-Trips

String round-trip means a typed, finite-domain, or selected reference value is
carried as a String across an internal Dungeon editor/runtime boundary and
later parsed, normalized, or matched back into the same finite-domain meaning.
Free-form labels, narration, visible status text, and user-authored
descriptions do not count.

| Family | Baseline round-trip | Evidence |
| --- | --- | --- |
| Tool keys | View/runtime routes carry selected tool keys as Strings, then parse them back to `DungeonEditorTool` through `parseToolKey`, `DungeonEditorToolDefinition`, or `DungeonEditorToolRegistry`. | `src/features/dungeon/runtime/DungeonEditorControlOperations.java:31-40`, `src/features/dungeon/runtime/PointerInteractionRequest.java:3-12`, `src/features/dungeon/runtime/DungeonEditorToolDefinition.java:12-75`, `src/features/dungeon/runtime/DungeonEditorToolRegistry.java:26-47` |
| View mode keys | UI keys such as `Grid` and `Graph` round-trip through `parseViewModeKey` before re-entering published `DungeonEditorViewMode`. | `src/features/dungeon/runtime/DungeonEditorControlOperations.java:20-29`, `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:814` |
| Overlay mode keys | Overlay mode names are carried as Strings through view/session state and parsed with enum-name semantics. | `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:933`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorSessionValues.java:149-151`, `src/features/dungeon/runtime/DungeonEditorRuntimeInputTranslator.java:76-86` |
| Topology element kinds | Published topology refs carry kind as String and runtime pointer targets parse it back into runtime/domain topology meaning. | `src/domain/dungeon/published/DungeonEditorTopologyElementRef.java:3`, `src/features/dungeon/runtime/DungeonEditorRuntimePointerTarget.java:540`, `src/features/dungeon/runtime/DungeonEditorRuntimeInputValues.java:26` |
| Handle kind and direction | Handle kind enum names and movement direction Strings are converted back into runtime handle/direction types. | `src/domain/dungeon/published/DungeonEditorHandleRef.java:5`, `src/domain/dungeon/model/runtime/editor/interaction/DungeonEditorHandleType.java:18`, `src/domain/dungeon/model/runtime/editor/session/DungeonEditorWorkspaceHandleMovement.java:11-21`, `src/domain/dungeon/model/core/geometry/Direction.java:38` |
| Transition destination refs | Destination type external name plus map/tile/transition identifiers are carried as Strings and parsed into typed destination and numeric runtime values. | `src/features/dungeon/runtime/TransitionDestinationDraftInput.java:25-32`, `src/features/dungeon/runtime/TransitionDestinationDraftInput.java:47-79`, `src/domain/dungeon/model/core/structure/transition/TransitionDestinationType.java:19`, `src/features/dungeon/runtime/TransitionDestination.java:29` |
| Stair geometry shape, direction, and dimensions | Stair geometry draft input stores shape, direction, and dimensions as Strings before save routes parse dimensions and forward shape/direction to authored save handling. | `src/features/dungeon/runtime/StairGeometryDraftInput.java:5-33`, `src/features/dungeon/runtime/DungeonEditorDetailSaveRuntimeOperations.java:75-85`, `src/domain/dungeon/DungeonAuthoredApplicationService.java:1572` |

Baseline count: 7 product String boundary families.

Diagnostic non-counts:

- Labels, narration, descriptions, status text, and command reaction messages
  are display or authored text in this baseline.
- Persistence text columns are data-layer concerns unless an approved design
  names a gateway signature adaptation.
- View-only layout strings remain M4.5 view/input scope.

## Harness Inventory

M4.2 harness check/closure is already done on branch in the ledger. Frozen
inventory covers:

- `dungeonEditorCoreBehaviorHarness`
- `dungeonEditorBehaviorHarness`
- `dungeonEditorRouteBehaviorHarness`
- `dungeonEditorDoorBehaviorHarness`
- `dungeonEditorWallBehaviorHarness`
- `dungeonEditorRoomBehaviorHarness`
- `dungeonEditorClusterBehaviorHarness`
- `dungeonEditorCorridorBehaviorHarness`
- `dungeonEditorStairBehaviorHarness`
- `dungeonEditorTransitionBehaviorHarness`
- `dungeonEditorFeatureBehaviorHarness`
- `dungeonTravelProjectionLevelHarness`
- `dungeonMapRenderParityHarness`
- `checkBehaviorHarnessTopology`
- `checkHarnessMapConsistency`
- focused handoff for `src/domain/dungeon`, area
  `dungeon-editor-session-runtime`

Recorded proof counts are: core 72, editor aggregate 206, route 187, door 58,
wall 33, room 64, cluster 84, corridor 68, stair 63, transition 62, feature
59, travel projection 3, and render parity 3. Harness scenarios and
assertions are frozen; this baseline does not change wiring.

## Residual Notes For Design

- The M4.2 target design must use the 211-file / 21,377-LOC reproducible root
  as its primary starting denominator, or explicitly justify why the ten
  travel bridge files are untouched M4.3-owned seams.
- Published seams consumed by M4.1, M4.3, M4.4, and M4.5 stay byte-compatible
  unless the approved design migrates both sides in the same reviewed step.
- The design must name concrete target classes, representative call chains,
  deletion list, seam statement, frozen parity inventory, and metric targets
  or individually justified exceptions.
- This baseline does not authorize wiring or implementation. The next step is
  a judge-approved M4.2 target design.
