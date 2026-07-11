Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.5 target design for the Dungeon editor-view architecture
migration sub-slice before any wiring-port or implementation commit.

# Dungeon Editor View Migration Target Design

## Scope

This design covers M4.5 `dungeon-editor-view`:

- primary package: `src/view/leftbartabs/dungeoneditor`
- direct map-canvas consumer seam:
  `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel`,
  `DungeonMapHitIndex`, and `DungeonMapHitAreaIndex` only where the active
  `PH-20260711-001` pointer-target residual requires typed hit selection
- direct runtime target-selection seam:
  `src/features/dungeon/runtime/PointerInteractionTargets`
- `src/features/dungeon/runtime/DungeonEditorMapHitRefs` only as a retained
  render-hit identity helper, not as a runtime/editor selection seam

The baseline records the primary editor-view package as 17 Java files, 5,752
physical LOC, and 5,230 nonblank LOC. The primary package plus the active PH
runtime files is 19 Java files, 6,058 physical LOC, and 5,509 nonblank LOC
(`docs/project/architecture/architecture-migration-dungeon-editor-view-baseline.md`).
The broader pointer-selection target metric adds the three current map
hit-selection files named in scope:
`DungeonMapContentModel.java`, `DungeonMapHitIndex.java`, and
`DungeonMapHitAreaIndex.java`. That unique set is 22 files and 8,006 physical
LOC before design.

This artifact is the step-3 design required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M4.5 wiring-port
step may only introduce compatibility seams and port direct references needed
to run the frozen harness inventory against old behavior before the deletion
list is executed.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Current Defect

The editor controls, state panel, and map canvas behavior are not the defect.
M4.5 must preserve map selection and CRUD controls, projection controls,
overlay controls, tool selection and wall single-click memory, state narration,
label-name editing, corridor point movement, transition destination editing,
transition descriptions, stair geometry editing, local camera controls, inline
label editing, pointer workflows, hover behavior, and all visible German text.

The defect is the current view orchestration shape:

- `DungeonEditorIntentHandler` mixes JavaFX input routing, local camera state,
  inline-label boundaries, map catalog editor state, String parsing, runtime
  operation selection, state-panel draft conversion, and pointer-target
  resolution in one 1,041-line class.
- `DungeonEditorContributionModel` is a projection adapter that fans one
  runtime frame into controls, map catalog, state panel, and interaction state.
- `DungeonEditorControlsContentModel` plus
  `DungeonEditorMapCatalogContentPartModel`,
  `DungeonEditorProjectionOverlayContentPartModel`, and
  `DungeonEditorToolPaletteContentPartModel` are a content-part cascade around
  one controls panel.
- `DungeonEditorStateContentModel` plus four state content-part models are a
  content-part cascade around one state panel.
- `DungeonEditorControlsViewInputEvent` and
  `DungeonEditorStateViewInputEvent` carry finite-domain kind values as
  Strings, then `DungeonEditorIntentHandler` parses them back to runtime/domain
  types.
- `PH-20260711-001` keeps runtime pointer selection dependent on map hit-ref
  strings plus prepared pointer-target lookup.

M4.5 replaces the view ceremony with one editor view model, two focused panel
models, typed view-input records, and typed pointer-target selection. It does
not solve CPD/PMD/CKJM by rephrasing duplicate code or weakening checks.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorContribution` | Stay the public shell contribution and navigation-icon owner. `registrationSpec()` and `bind(ShellRuntimeContext)` behavior stay byte-compatible. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorBinder` | Stay the package-private assembly boundary. It instantiates the feature shell, shared catalog controls, `DungeonMapContentModel`, `DungeonEditorViewModel`, `DungeonEditorControlsPanelModel`, `DungeonEditorStatePanelModel`, `DungeonEditorControlsView`, `DungeonEditorStateView`, and `DungeonMapView`; it wires callbacks and shell slots only. It no longer owns frame projection or intent decisions. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorViewModel` | New package-private root view model. It replaces `DungeonEditorContributionModel` and `DungeonEditorIntentHandler`, owns current interaction readback, local camera drag state, inline-edit outside-press state, frame application, map-catalog command handling, controls input handling, state-panel input handling, and map-canvas input handling. It delegates presentation state to the two panel models and delegates runtime changes through the existing runtime operation interfaces. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorControlsPanelModel` | New package-private controls model. It replaces `DungeonEditorControlsContentModel`, `DungeonEditorMapCatalogContentPartModel`, `DungeonEditorProjectionOverlayContentPartModel`, and `DungeonEditorToolPaletteContentPartModel`. It owns map catalog editor state, projection state, overlay state, tool-family state, wall single-click memory, and display labels while storing finite choices as `DungeonEditorTool`, `DungeonEditorViewMode`, and `DungeonEditorOverlaySettings.Mode`. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorStatePanelModel` | New package-private state-panel model. It replaces `DungeonEditorStateContentModel`, `DungeonEditorStateNarrationContentPartModel`, `DungeonEditorStateSelectionPreviewContentPartModel`, `DungeonEditorStateStairGeometryContentPartModel`, and `DungeonEditorStateTransitionContentPartModel`. It owns state projection records, narration cards, label targets, corridor point projection, transition destination projection, transition description projection, and stair geometry projection. Finite destination, stair shape, and stair direction choices are typed model values with external text only at the view edge. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorControlsInput` | New package-private typed controls input record family emitted by `DungeonEditorControlsView`. Nested records cover map-editor command, selected map, projection-level shift, `DungeonEditorViewMode`, `DungeonEditorTool` tool selection, tool-family option memory, tool-dismiss, and typed overlay input. Raw text is retained only for user-entered names or selected-level lists before validation. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorStateInput` | New package-private typed state-panel input record family emitted by `DungeonEditorStateView`. Nested records cover room narration, label name, corridor point draft, transition destination, transition description, and stair geometry. View-local `TransitionDestinationOption`, `StairShapeOption`, and `DirectionOption` replace finite String kind constants; raw text remains only for free-form descriptions or numeric draft fields that must preserve incomplete typing. The view package must not gain a direct `src.domain.dungeon.model.core` dependency. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorControlsView` | Stay the public JavaFX controls view. Its public constructor, visible text, accessible text, CSS style-class behavior, keyboard behavior, and user workflow stay unchanged. It binds to `DungeonEditorControlsPanelModel` and emits `DungeonEditorControlsInput` instead of `DungeonEditorControlsViewInputEvent`. |
| `src.view.leftbartabs.dungeoneditor.DungeonEditorStateView` | Stay the public JavaFX state view. Its public constructor, visible text, accessible text, focus-retention behavior, card order, input filters, and user workflow stay unchanged. It binds to `DungeonEditorStatePanelModel` and emits `DungeonEditorStateInput` instead of `DungeonEditorStateViewInputEvent`. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapContentModel` | Keep the M4.4 render/content public seam and add a typed editor-consumer method, `runtimePointerTargetsAt(double sceneX, double sceneY)`, returning the ordered `DungeonEditorRuntimePointerTarget` hits for the current canvas point. The old `pointerHitRefsAt` and `currentPointerTargetFrames` methods are removed after the M4.5 consumer is migrated. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapHitIndex` | Store typed `DungeonEditorRuntimePointerTarget` hits alongside internal canvas hit identity. It still owns hit-area lookup and ordering, but callers receive typed runtime targets rather than hit-ref Strings. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapHitAreaIndex` | Keep geometry bucketing and hit ordering. Its hit candidate payload changes from exposed String hit refs to the typed hit target supplied by `DungeonMapHitIndex`; internal String keys may remain only for deduplication and geometry identity. |
| `src.features.dungeon.runtime.PointerInteractionTargets` | Keep the runtime request target record and priority logic. Replace `fromHitTargets(...)` with `fromRuntimeTargets(...)` that consumes ordered `List<DungeonEditorRuntimePointerTarget>` and no longer imports or receives `PreparedPointerTargetFrame`, `Map<String, ...>`, or `List<String>` hit refs. Remove the `PH-20260711-001` marker when this is true. |
| `src.features.dungeon.runtime.DungeonEditorMapHitRefs` | Stay only if still needed to create stable render hit identity keys for the map scene. It is not a target-selection seam after M4.5 and must not appear in `PointerInteractionTargets` or `DungeonEditorViewModel` call chains. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeOperations` and child operation interfaces | Stay byte-compatible M4.2 operation seams for M4.5. The editor view model may consume them directly; this step does not redesign runtime operation APIs. |

`tools/quality/config/ckjm/baseline.tsv` currently contains a stale
`DungeonEditorViewModel` row from an older shape even though no source file
exists. Implementation may update quality baselines only if the actual CKJM
proof requires it, and the update must match the new class rather than hiding a
metric miss.

## Target Call Chains

Counting rule: count named production class boundaries in the editor-view path.
Same-class private helpers, record construction, and property access are not
separate hops.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Frame to controls/state/map readback | `DungeonEditorFeatureShellBinding` -> `DungeonEditorBinder` -> `DungeonEditorViewModel.applyFrame` -> `DungeonEditorControlsPanelModel.applyFrame` and `DungeonEditorStatePanelModel.applyFrame` -> `DungeonMapContentModel.applyEditorRenderFrame` -> bound JavaFX views | At most 4 hops to panel projection, 5 including map-content render application. Deletes the `ContributionModel` and content-part projection cascade. |
| Tool, view mode, overlay, projection level | `DungeonEditorControlsView` -> `DungeonEditorControlsInput` -> `DungeonEditorViewModel.consumeControls` -> existing `DungeonEditorControlOperations` -> runtime publication | At most 4 hops to runtime operation, with no finite-kind String parse for tool, view mode, or overlay mode. Selected-level free-form text is parsed at the view-input edge and invalid text remains a no-op as today. |
| Map catalog selection/create/rename/delete | `CatalogCrudControlsView` -> shared `CatalogCrudControlsViewInputEvent` -> `DungeonEditorViewModel.consumeCatalog` -> `DungeonEditorControlsPanelModel` for editor state and existing `DungeonEditorMapCatalogOperations` for runtime changes | At most 4 hops. Shared catalog item IDs remain a justified shared-control String edge because M4.5 does not own the reusable catalog control. |
| State narration/name/corridor drafts | `DungeonEditorStateView` -> `DungeonEditorStateInput` -> `DungeonEditorViewModel.consumeState` -> `DungeonEditorStatePanelModel` lookup/conversion -> existing `DungeonEditorStatePanelDraftOperations` or `DungeonEditorTransitionStairOperations` | At most 4 hops. Runtime draft operations still receive free-form text and numeric draft text where incomplete typing must be preserved. |
| Transition destination save | `DungeonEditorStateView` -> `DungeonEditorStateInput.TransitionDestination` with typed view-local destination option -> `DungeonEditorViewModel.consumeState` -> `TransitionDestinationDraftInput` at the runtime edge -> `DungeonEditorTransitionStairOperations.saveTransitionLink` | At most 4 hops. Deletes `transitionDestinationTypeKey(int)` and the view-owned String destination-kind round-trip without adding a direct view dependency on domain core types. |
| Stair geometry save | `DungeonEditorStateView` -> `DungeonEditorStateInput.StairGeometry` with typed stair shape/direction options -> `DungeonEditorViewModel.consumeState` -> `StairGeometryDraftInput` -> `DungeonEditorTransitionStairOperations.saveStairGeometry` | At most 4 hops. The runtime edge keeps the existing draft input shape; finite choices are no longer view-owned String constants. |
| Pointer canvas workflow | `DungeonMapView` -> `DungeonEditorViewModel.consumeMapCanvas` -> `DungeonMapContentModel.runtimePointerTargetsAt` -> `PointerInteractionTargets.fromRuntimeTargets` -> `DungeonEditorPointerInteractionOperations.applyPointerInteraction` | At most 4 hops to runtime operation. Runtime pointer selection consumes typed targets, not map hit-ref Strings or prepared-frame maps. |
| Inline label edit | `DungeonMapView` -> `DungeonEditorViewModel.consumeMapCanvas` -> `DungeonMapContentModel.inlineLabelEditCandidate` -> `DungeonEditorInlineLabelOperations` | At most 4 hops. Inline edit cancel/commit/outside-press behavior stays visible-behavior identical. |

## Frozen Parity Inventory

The selected M4.5 parity inventory is the ledger inventory closed in step 1.
The retained proof logs are:

- `build/gradle-run-logs/20260711T173348826883546-pid501693-dungeonEditorCoreBehaviorHarness__dungeonEditorBehaviorHarness__dungeonEditorRouteBehaviorHarness.log`
- `build/gradle-run-logs/20260711T173850497177855-pid503570-dungeonEditorDoorBehaviorHarness__dungeonEditorWallBehaviorHarness__dungeonEditorRoomBehaviorHarness__dungeonEditorClusterBehaviorHarness.log`
- `build/gradle-run-logs/20260711T174257822813412-pid505310-dungeonEditorCorridorBehaviorHarness__dungeonEditorStairBehaviorHarness__dungeonEditorTransitionBehaviorHarness__dungeonEditorFeatureBehaviorHarness.log`
- `build/gradle-run-logs/20260711T174609605668971-pid506800-dungeonTravelProjectionLevelHarness__dungeonMapRenderParityHarness__checkBehaviorHarnessTopology__checkHarnessMapConsistency.log`

Frozen task and proof-count inventory:

- `dungeonEditorCoreBehaviorHarness`: 72 proof items.
- `dungeonEditorBehaviorHarness`: 206 proof items.
- `dungeonEditorRouteBehaviorHarness`: 187 proof items.
- `dungeonEditorDoorBehaviorHarness`: 58 proof items.
- `dungeonEditorWallBehaviorHarness`: 33 proof items.
- `dungeonEditorRoomBehaviorHarness`: 64 proof items.
- `dungeonEditorClusterBehaviorHarness`: 84 proof items.
- `dungeonEditorCorridorBehaviorHarness`: 68 proof items.
- `dungeonEditorStairBehaviorHarness`: 63 proof items.
- `dungeonEditorTransitionBehaviorHarness`: 62 proof items.
- `dungeonEditorFeatureBehaviorHarness`: 59 proof items.
- `dungeonTravelProjectionLevelHarness`: 5 proof items.
- `dungeonMapRenderParityHarness`: 3 proof items:
  `DE-IMG-001`, `DE-IMG-002`, and `DT-IMG-001`.
- `checkBehaviorHarnessTopology`: task success with the retained harness-map
  topology oracle.
- `checkHarnessMapConsistency`: task success with the retained harness-map
  consistency oracle.

Focused handoff did not run Gradle in step 1 because project-health intake
stopped on active `PH-20260711-001`. That is a real implementation/design
obligation. It is not a documentation-gate failure and not a license to weaken
or suppress intake.

## Deletion List

The implementation step is incomplete until these files no longer exist:

- `src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorControlsContentModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorControlsViewInputEvent.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorMapCatalogContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorProjectionOverlayContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateContentModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateNarrationContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateSelectionPreviewContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateStairGeometryContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateTransitionContentPartModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateViewInputEvent.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorToolPaletteContentPartModel.java`

In-file removal requirements:

- `DungeonEditorBinder` construction of deleted content models,
  `DungeonEditorContributionModel`, and `DungeonEditorIntentHandler`.
- `DungeonEditorControlsView` references to
  `DungeonEditorControlsContentModel` and
  `DungeonEditorControlsViewInputEvent`.
- `DungeonEditorStateView` references to `DungeonEditorStateContentModel` and
  `DungeonEditorStateViewInputEvent`.
- `DungeonMapContentModel.pointerHitRefsAt(...)`.
- `DungeonMapContentModel.currentPointerTargetFrames()`.
- `PointerInteractionTargets.fromHitTargets(...)`.
- The `PH-20260711-001` marker in `PointerInteractionTargets` only after
  runtime pointer selection consumes typed targets and the project-health
  register is updated to `Removed` or to a judge-accepted narrower debt.

Core target files allowed by this design:

- `src/view/leftbartabs/dungeoneditor/DungeonEditorViewModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorControlsPanelModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStatePanelModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorControlsInput.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorStateInput.java`

No additional editor-view helper file is approved by default. If PMD/CKJM
forces a source-shape split, the implementation must name the new helper and
its real responsibility in the conformance review; line compression, comment
deletion, cosmetic wrappers, or duplicate-helper rephrasing are Rework.

## Seam Statement

These surfaces stay byte-compatible in M4.5 until their consumer sides migrate:

- `DungeonEditorContribution`: package, class name, public constructor,
  `registrationSpec()`, `bind(ShellRuntimeContext)`, navigation icon path,
  shell title, and shell slot placement.
- `DungeonEditorFeatureShellBinding`: public constructor, `operations()`,
  `subscribe(PublicationSink)`, `publishCurrent(PublicationSink)`,
  `PublicationSink.apply(DungeonEditorRenderFrame)`, unsubscribe behavior,
  listener ordering, and JavaFX delivery semantics.
- `DungeonEditorRuntimeOperations`, `DungeonEditorMapCatalogOperations`,
  `DungeonEditorControlOperations`, `DungeonEditorPointerInteractionOperations`,
  `DungeonEditorStatePanelDraftOperations`, `DungeonEditorInlineLabelOperations`,
  and `DungeonEditorTransitionStairOperations`: package, interface names,
  method names, parameter types, and behavior.
- `DungeonEditorRenderFrame`, `DungeonEditorPreparedFrameFacts`, and nested
  frame records consumed by editor view and map content: record names,
  components, null/default behavior, empty factories, and accessors.
- `DungeonMapContentModel`: constructor, render-frame application,
  travel-snapshot application, camera/zoom methods, inline-label APIs,
  hover APIs, canvas-state properties, and public nested render primitive
  records used by harnesses. The old pointer-hit String accessors are deleted
  only after `DungeonEditorViewModel` consumes the new typed target method.
- `DungeonMapView` and `DungeonMapViewInputEvent`: class names, packages,
  public construction/use from editor and travel binders, emitted input event
  shapes, redraw behavior, and input semantics.
- `CatalogCrudControlsContentModel`, `CatalogCrudControlsView`, and
  `CatalogCrudControlsViewInputEvent`: shared catalog-control API remains
  unchanged. M4.5 adapts it inside `DungeonEditorViewModel`.
- `DungeonEditorControlsView` and `DungeonEditorStateView`: public class
  names, public constructors, visible text, accessible text, CSS style
  classes, control order, focus-retention behavior, and user workflows.

These surfaces are explicitly not protected as foreign seams for M4.5:

- `DungeonEditorControlsViewInputEvent`
- `DungeonEditorStateViewInputEvent`
- deleted `*ContentPartModel` files
- `DungeonEditorContributionModel`
- `DungeonEditorIntentHandler`
- `DungeonMapContentModel.pointerHitRefsAt(...)`
- `DungeonMapContentModel.currentPointerTargetFrames()`
- `PointerInteractionTargets.fromHitTargets(...)`

## PH-20260711-001 Resolution

M4.5 resolves the active project-health entry by changing the selection owner,
not by rewording String keys:

1. `DungeonMapHitIndex` stores the typed
   `DungeonEditorRuntimePointerTarget` associated with each hit area when the
   scene hit index is rebuilt.
2. `DungeonMapContentModel.runtimePointerTargetsAt(sceneX, sceneY)` returns
   the ordered typed targets for the canvas coordinate. Internal String hit
   identity may remain inside map rendering for deduplication only.
3. `DungeonEditorViewModel.consumeMapCanvas` passes those typed targets to
   `PointerInteractionTargets.fromRuntimeTargets(...)`.
4. `PointerInteractionTargets` no longer imports or consumes
   `PreparedPointerTargetFrame`, `Map<String, PreparedPointerTargetFrame>`, or
   `List<String>` hit refs.
5. `docs/project/architecture/project-health-debt.md` moves
   `PH-20260711-001` to `Removed` only after the marker is gone and focused
   handoff intake no longer stops on the M4.5 path.

If implementation proves that render-hit identity still needs a broader
runtime/editor debt, the implementation must leave a narrower synchronized PH
entry naming the remaining path and must get judge acceptance. Silent marker
removal is Rework.

## Metric Targets

| Metric | Baseline | Target |
| --- | ---: | ---: |
| Primary editor-view package files | 17 | <= 10 |
| Primary editor-view package physical LOC | 5,752 | <= 4,900 |
| Primary plus PH/map pointer-selection code files | 22 | <= 15 |
| Primary plus PH/map pointer-selection physical LOC | 8,006 | <= 7,000 |
| Strict concrete forwarding/proxy classes | 1 | 0, except shell contribution adapter |
| Design-visible assembly/projection ceremony candidates | 10 | <= 3 real model/controller owners |
| Longest editor-view mutation-facing chain | 5 view/runtime-boundary hops | <= 4 hops to runtime operation |
| M4.5-owned finite-kind String boundary families | 6 owned families plus shared catalog IDs | 0 owned finite-kind families; shared catalog IDs only |
| Active `PH-20260711-001` intake | Open / blocking focused handoff | Removed or judge-accepted narrower synchronized debt |

The target does not count free-form German text, map names, descriptions, or
numeric draft text as finite-kind String boundary families. Those are user
input fields and must preserve current incomplete-typing behavior.

## Wiring Port Boundary

The wiring-port step may:

- add the five approved target files as compatibility seams
- port `DungeonEditorBinder`, `DungeonEditorControlsView`, and
  `DungeonEditorStateView` to the typed input/model seams while delegating
  behavior through the old model/handler stack if needed
- add `DungeonMapContentModel.runtimePointerTargetsAt(...)` and
  `PointerInteractionTargets.fromRuntimeTargets(...)` as compatibility methods
  while keeping old methods alive until implementation
- mechanically port harness imports only if a deleted-class reference would
  otherwise block compiling the frozen harness inventory

The wiring-port step must not:

- delete the approved deletion-list files
- change visible text, assertion labels, fixture values, render snapshots, or
  proof labels
- change runtime operation semantics
- suppress project-health intake or CPD/PMD/CKJM findings

## Untouched Surfaces

- M4.1 authored core, M4.2 editor runtime, M4.3 travel, and M4.4 rendering
  behavior stay behavior-compatible. M4.5 may touch map content only for the
  typed pointer-target seam required by `PH-20260711-001`.
- Shared catalog controls stay byte-compatible; their String item IDs are a
  shared-control seam for a later view-surface pass.
- Domain published models and snapshots stay byte-compatible.
- Harness scenarios, assertion labels, fixture values, image snapshots, owner
  smoke oracles, and visible user behavior stay unchanged.
- No documentation gate is required for this migration design because the
  architecture-migration form gates were removed as acceptance evidence.

## Conformance Review Checklist

The conformance review must verify:

- all deletion-list files are absent
- stale deleted-class references are absent from `src`, `test`, and quality
  configuration unless a retained reference is individually justified
- `DungeonEditorControlsViewInputEvent` and
  `DungeonEditorStateViewInputEvent` no longer exist
- `PointerInteractionTargets.fromHitTargets(...)`,
  `DungeonMapContentModel.pointerHitRefsAt(...)`, and
  `DungeonMapContentModel.currentPointerTargetFrames()` no longer exist
- runtime pointer selection consumes typed `DungeonEditorRuntimePointerTarget`
  values
- `PH-20260711-001` is removed or replaced by a narrower judge-accepted debt
- frozen harness groups, render parity, topology, map consistency, focused
  handoff, production handoff, Phase 1 review, and Phase 2 judge are green
- metric targets are met or exceptions are individually justified and accepted
  by the judge
