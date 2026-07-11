Status: Draft
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.4 target design for the Dungeon rendering-pipeline
architecture migration sub-slice before any wiring-port or implementation
commit.

# Dungeon Rendering Pipeline Migration Target Design

## Scope

This design covers M4.4 `dungeon-rendering-pipeline`:

- primary render package: `src/view/slotcontent/main/dungeonmap`
- design-visible editor render producer files in `src/features/dungeon/runtime`
  that build or deliver `DungeonEditorRenderFrame` and
  `DungeonEditorPreparedFrameFacts`
- `src/features/dungeon/shell/DungeonEditorFeatureShellBinding` only where it
  currently unwraps the render publication for the shell
- direct editor/travel render consumers only as byte-compatible seams:
  `src/view/leftbartabs/dungeoneditor/DungeonEditorBinder.java`,
  `DungeonEditorContributionModel.java`, `DungeonEditorIntentHandler.java`,
  `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java`,
  `DungeonTravelContributionModel.java`, and
  `DungeonTravelIntentHandler.java`

The baseline records the primary map package as 13 Java files and 7,484
physical LOC. The primary map plus runtime frame/publication subset is 23 Java
files and 9,200 physical LOC. The direct product render route is 46 Java files
and 12,829 physical LOC
(`docs/project/architecture/architecture-migration-dungeon-rendering-pipeline-baseline.md`).

This artifact is the step-3 design required by the roadmap. It does not permit
implementation or harness scenario/assertion changes. The M4.4 wiring-port
step may only introduce compatibility seams and port direct references needed
to run the frozen harness inventory against old behavior before the deletion
list is executed.

## Non-Negotiable Constraints

- Behavior parity is absolute. Any visible behavior change in a migration pass is a defect. Pre-existing bugs are preserved and filed as separate R2 issues.
- No questions to the owner. Never wait on the owner; the acceptance window never blocks the pipeline. Decide yourself, journal the reasoning.
- No security analysis. No pause/throttle/stop mechanisms. Git history plus revert is the safety model.
- Harness scenarios and assertions are frozen; only wiring may be ported, in a separate prior commit.

## Current Defect

The render state and canvas primitives are not the defect. The map view must
still preserve visible topology refs, hover overlays, pointer hit refs,
inline-label placement, room labels, graph edges, actor tokens, projection
levels, overlay modes, and image parity.

The defect is the Snapshot -> Facts -> Frame -> ContentPartModel cascade around
that behavior. The baseline measured the dominant editor publication-to-canvas
path at 15 meaningful class-boundary hops including hit-index rebuild and
canvas draw. The primary map package has a 2,239-line `DungeonMapContentModel`,
ten content-part helper files, six render-state representations, five product
String boundary protocol families, two strict forwarding/proxy classes, and
one one-method render helper.

M4.4 collapses that ceremony into one direct frame publication channel and a
small render model with named responsibilities: frame projection, scene
assembly, hit indexing, inline-label state, and viewport state. It keeps the
published frames and map view API byte-compatible. The existing hit-ref and
pointer-target String protocol remains untouched under `PH-20260711-001`;
this design does not disguise it by renaming or rephrasing helper code.

## Target Class List

| Class | Target responsibility |
| --- | --- |
| `src.features.dungeon.runtime.DungeonEditorRenderFrame` | Stay the byte-compatible render-frame record consumed by editor view and map content. Empty/default behavior, record components, and accessor semantics remain unchanged. |
| `src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts` | Stay the byte-compatible prepared-surface record family. `MapSurfaceFrame`, `MapInteractionFrame`, `StatePanelFrame`, `PreparedPointerTargetFrame`, and the nested prepared enums/records remain stable for M4.4/M4.5 consumers. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeReadbackFrameInputs` | Stay the readback input collector from editor published models. It remains a small frame-producer helper because it owns null/default readback normalization at the publication edge. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeDraftSession` | Stay the M4.2 draft-session owner. M4.4 reads its byte-compatible `DungeonEditorRuntimeDraftFrame` for inline-label, corridor, room, transition, and stair preview state; it does not redesign draft behavior. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeFrameFactsAssembler` | Become the single package-private facts assembler for M4.4-owned readback. It absorbs `DungeonEditorPreparedFrameProjection` and `DungeonEditorMapInteractionFrameAssembler` so map-surface and interaction facts are assembled in one place before `DungeonEditorRenderFrame` construction. |
| `src.features.dungeon.runtime.DungeonEditorPreviewRenderDiffAssembler` | Stay the preview diff owner used by `DungeonEditorRuntimeFrameFactsAssembler`; it owns real comparison behavior and is not a forwarding wrapper. |
| `src.features.dungeon.runtime.DungeonEditorRuntimeFramePublisher` | Stay the runtime-frame fanout owner, but publish `DungeonEditorRenderFrame` directly. It deletes the one-field `DungeonEditorRuntimePublication` wrapper, keeps current subscriber order, keeps caller-affine synchronous runtime callbacks, and leaves JavaFX delivery to the shell binding. |
| `src.features.dungeon.runtime.DungeonEditorFeatureRuntimeRoot` | Keep the feature runtime entrypoint and operation surfaces. Its current-frame and subscription internals move from `DungeonEditorRuntimePublication` to direct `DungeonEditorRenderFrame` delivery for `DungeonEditorFeatureShellBinding`; no editor operation API changes are authorized. |
| `src.features.dungeon.shell.DungeonEditorFeatureShellBinding` | Keep the byte-compatible shell seam: public constructor, `operations()`, `subscribe(PublicationSink)`, `publishCurrent(PublicationSink)`, `PublicationSink.apply(DungeonEditorRenderFrame)`, unsubscribe behavior, and JavaFX delivery semantics. Internally it consumes direct render frames instead of unwrapping `DungeonEditorRuntimePublication`. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapContentModel` | Stay the public map presentation model. It becomes a slim coordinator over typed render state, frame projection, scene assembly, hit indexing, inline-label state, and viewport state. Its public constructor, public methods, properties, and public nested render primitive records used by harnesses remain byte-compatible. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapRenderState` | New package-private typed render state extracted from `DungeonMapContentModel`. It owns cells, boundaries, labels, markers, graph edges, party token, selected tool/status metadata, overlay/view mode, and typed render-owned topology and label refs where no harness-public seam requires Strings. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapFrameProjector` | New package-private projection owner. It replaces editor snapshot, travel snapshot, preview diff, stair preview label, and room-label placement content-part orchestration by turning editor frames or travel snapshots into `DungeonMapRenderState`. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapSceneAssembler` | New package-private scene primitive builder. It replaces the render-scene content part and owns grid cells, boundaries, graph overlays, markers, actors, labels, hover overlay, style selection, and `CanvasState.RenderScene` creation. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapHitIndex` | New package-private derived hit-index owner. It replaces hit-geometry content-part state, rebuilds from the current scene/render state, and answers `hitsAt` without becoming a second source of render truth. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapInlineLabelState` | New package-private inline-label edit state and presentation owner. It replaces the inline-label UI content part while keeping the same public `InlineLabelEditState`, candidate, and editor presentation behavior exposed by `DungeonMapContentModel`. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapViewportState` | New package-private camera/zoom owner. It replaces the viewport content part and keeps reset, pan, zoom-around, property, and initial viewport behavior stable. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapView` | Stay the JavaFX canvas and input view. It continues to render `DungeonMapContentModel.CanvasState`, emit the same `DungeonMapViewInputEvent` records, and preserve existing redraw, selection, hover, inline-label, and viewport behavior. |
| `src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent` | Stay the byte-compatible view input event surface consumed by editor/travel intent handlers and harnesses. |

## Target Call Chains

Counting rule: count named production class boundaries in the render/readback
path. Same-class private helpers, record construction, and field access are not
separate hops. Package-private source-shape helper files added by the
implementation amendment are counted in the expanded source-shape chain below
when they own behavior. The metric table separately counts them as helper
groups so conformance can judge file-count exceptions without hiding class
boundaries. The map view canvas draw is listed because M4.4 owns render parity.

| Interaction | Target chain | Target |
| --- | --- | --- |
| Editor frame to rendered canvas | `DungeonEditorRuntimeFramePublisher.publishCurrentToSubscribers/currentFrame` -> `DungeonEditorRuntimeReadbackFrameInputs.from` -> `DungeonEditorRuntimeDraftSession.draftFrame` -> `DungeonEditorRuntimeFrameFactsAssembler.preparedFacts` -> `DungeonEditorFeatureShellBinding` -> `DungeonEditorBinder.applyFrame` -> `DungeonMapContentModel.applyEditorRenderFrame` -> `DungeonMapFrameProjector.editorFrame` -> `DungeonMapEditorRenderProjector.project` -> `DungeonMapSceneAssembler.scene` -> `DungeonMapGridSceneAssembler` or `DungeonMapGraphSceneAssembler` -> `DungeonMapHitIndex.rebuild` -> `DungeonMapHitAreaIndex` -> `DungeonMapView.redraw/CanvasRenderer.render` | At most 11 hops to `RenderScene`; at most 14 including hit-index rebuild and canvas draw. The accepted source-shape exception still removes the content-part cascade and improves the baseline 13/15 editor chain by deleting wrapper and forwarding boundaries. |
| Travel snapshot to rendered canvas | `TravelDungeonModel.subscribe/current` -> `DungeonTravelBinder.applySnapshot` -> `DungeonMapContentModel.applyTravelSnapshot` -> `DungeonMapFrameProjector.travelSnapshot` -> `DungeonMapTravelRenderProjector.project` -> `DungeonMapSceneAssembler.scene` -> `DungeonMapGridSceneAssembler` or `DungeonMapGraphSceneAssembler` -> `DungeonMapHitIndex.rebuild` -> `DungeonMapHitAreaIndex` -> `DungeonMapView.redraw/CanvasRenderer.render` | At most 7 hops to `RenderScene`; at most 10 including hit-index rebuild and canvas draw. This is an accepted source-shape exception to the original 5/7 target: travel keeps parity, deletes the content-part cascade, and pays one package-private projector boundary plus one scene-helper boundary to satisfy PMD/CKJM. |
| Editor pointer hit selection | `DungeonMapView` emits `DungeonMapViewInputEvent` -> `DungeonEditorIntentHandler.pointerInteractionTargets` -> `DungeonMapContentModel.pointerHitRefsAt/currentPointerTargetFrames` -> `DungeonMapHitIndex.hitsAt` -> `DungeonMapHitAreaIndex` -> `PointerInteractionTargets.fromHitTargets` -> `DungeonEditorRuntimePointerTarget.fromPreparedFrame` priority selection | At most 7 hops. The added hit-index helper is the source-shape split of the old hit-geometry content part; the `PH-20260711-001` hit-ref protocol stays byte-compatible and is not repaired in M4.4. |
| Hover overlay redraw | `DungeonEditorIntentHandler` sends hover display target -> `DungeonMapContentModel.updateRuntimeHoverDisplayTarget` -> `DungeonMapFrameConsumption` hover retention -> `DungeonMapSceneAssembler.hoverOverlay` -> `DungeonMapGridSceneAssembler` or `DungeonMapGraphSceneAssembler` -> `DungeonMapView.redraw/CanvasRenderer.render` | At most 6 hops. Hover target retention stays behavior-compatible; only the content-part routing is removed. |

## Frozen Parity Inventory

The selected M4.4 parity inventory is the ledger inventory closed in step 1.
The retained proof logs are:

- `build/gradle-run-logs/20260711T102409913332200-pid342857-dungeonEditorCoreBehaviorHarness__dungeonEditorBehaviorHarness__dungeonEditorRouteBehaviorHarness.log`
- `build/gradle-run-logs/20260711T102930915605008-pid343634-dungeonEditorDoorBehaviorHarness__dungeonEditorWallBehaviorHarness__dungeonEditorRoomBehaviorHarness__dungeonEditorClusterBehaviorHarness.log`
- `build/gradle-run-logs/20260711T103240332324938-pid344222-dungeonEditorCorridorBehaviorHarness__dungeonEditorStairBehaviorHarness__dungeonEditorTransitionBehaviorHarness__dungeonEditorFeatureBehaviorHarness.log`
- `build/gradle-run-logs/20260711T103559335558219-pid344931-dungeonTravelProjectionLevelHarness__dungeonMapRenderParityHarness__checkBehaviorHarnessTopology__checkHarnessMapConsistency.log`
- `build/gradle-run-logs/20260711T084509Z-staged-focused-handoff.log`
- `build/gradle-run-logs/20260711T104510163615436-pid348411-focused-handoff.log`

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
  topology oracle; the task emits no per-row proof IDs.
- `checkHarnessMapConsistency`: task success with the retained harness-map
  consistency oracle; the task emits no per-row proof IDs.
- focused handoff for `src/view/slotcontent/main/dungeonmap` and area
  `dungeon-rendering-pipeline`: wrapper and observable log success as recorded
  above; no per-row proof IDs are emitted.

M4.4 wiring and implementation may port imports, constructors, callbacks, and
direct frame delivery references. They MUST NOT add, remove, rename, split,
merge, weaken, or reinterpret harness scenarios, assertion labels, fixture
values, image snapshots, visible text, rendered geometry, ordering rules, or
pass/fail oracles.

## Deletion List

The implementation step is incomplete until these files no longer exist:

- `src/features/dungeon/runtime/DungeonEditorRuntimePublication.java`
- `src/features/dungeon/runtime/DungeonEditorMapInteractionFrameAssembler.java`
- `src/features/dungeon/runtime/DungeonEditorPreparedFrameProjection.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorProjectionContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapFrameConsumptionContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapHitGeometryContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapInlineLabelUiStateContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewDiffContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderSceneContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapRoomLabelPlacementContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapSnapshotProjectionContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapStairPreviewLevelLabelContentPartModel.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapViewportContentPartModel.java`

In-file removal requirements:

- `DungeonEditorFeatureRuntimeRoot.currentPublication()`
- `DungeonEditorFeatureRuntimeRoot.subscribe(Consumer<DungeonEditorRuntimePublication>)`
- `DungeonEditorRuntimeFramePublisher.currentPublication()`
- `DungeonEditorRuntimeFramePublisher.subscribe(Consumer<DungeonEditorRuntimePublication>)`
- `DungeonMapContentModel` fields whose sole role is storing the deleted
  `*ContentPartModel` instances.
- Nested render-state type block in `DungeonMapContentModel`:
  `DungeonMapContentModel.DungeonMapRenderState` and its render-state-owned
  nested `Topology`, `ViewMode`, `OverlayMode`, `CellKind`, `EdgeKind`,
  `MarkerKind`, `Heading`, `LevelOverlaySettings`, `TopologyRef`,
  `MarkerHandle`, `Cell`, `Edge`, `Label`, `Marker`, `GraphNode`, `GraphLink`,
  and `PartyToken` definitions. Their behavior moves to the new top-level
  `DungeonMapRenderState.java` unless a listed type is required as a public
  `DungeonMapContentModel` seam, in which case the implementation must keep a
  byte-compatible public alias and name that alias in the conformance review.

Core target files allowed by the initial step-3 design:

- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderState.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapFrameProjector.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapSceneAssembler.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapHitIndex.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapInlineLabelState.java`
- `src/view/slotcontent/main/dungeonmap/DungeonMapViewportState.java`

The implementation amendment below names the additional package-private helper
files permitted only to keep the moved behavior cohesive and PMD/CKJM/CPD-clean.

Deleting comments, compressing lines, cosmetically renaming wrappers, or
rephrasing duplicated helpers without executing this deletion list is Rework.
The wrapper deletion is structural: `DungeonEditorRuntimePublication` is
removed because all current references are internal to
`DungeonEditorFeatureRuntimeRoot`, `DungeonEditorRuntimeFramePublisher`, and
`DungeonEditorFeatureShellBinding`; the public shell sink already receives
`DungeonEditorRenderFrame` directly.

## Seam Statement

These surfaces stay byte-compatible in M4.4 until their consumer sides migrate:

- `DungeonEditorRenderFrame`: package, record name, record components,
  canonical constructor behavior, `empty()`, and accessor semantics.
- `DungeonEditorPreparedFrameFacts`, `MapSurfaceFrame`, `MapInteractionFrame`,
  `StatePanelFrame`, `PreviewRenderFrame`, `PreviewRenderDiffFrame`,
  `PreparedPointerTargetFrame`, prepared target/boundary/topology/label enums,
  and nested prepared records: package, names, record components, null/default
  behavior, `empty()` behavior, and current accessor semantics.
- `DungeonEditorRuntimeReadbackFrameInputs` and
  `DungeonEditorPreviewRenderDiffAssembler`: current package-private runtime
  behavior remains available to the frame producer; no foreign published API is
  created or removed.
- `DungeonEditorFeatureShellBinding`: public constructor, `operations()`,
  `subscribe(PublicationSink)`, `publishCurrent(PublicationSink)`,
  `PublicationSink.apply(DungeonEditorRenderFrame)`, unsubscribe behavior,
  listener ordering, and JavaFX delivery semantics.
- `DungeonMapContentModel`: public constructor, public read properties,
  camera methods, `pointerHitRefsAt`, `currentPointerTargetFrames`,
  `updateHoverTarget`, `updateRuntimeHoverDisplayTarget`, `clearHoverTarget`,
  `currentInlineLabelEditState`, `inlineLabelEditCandidate`,
  `applyEditorRenderFrame`, `applyTravelSnapshot`, and the public nested
  canvas/render primitive records used by harnesses.
- `DungeonMapView` and `DungeonMapViewInputEvent`: class names, packages,
  public construction/use from editor and travel binders, emitted input event
  shapes, redraw behavior, and input semantics.
- Domain editor and travel published models and snapshots consumed by the
  render pipeline: package, class/record names, components, service-registry
  keys, default behavior, and listener semantics.
- `PH-20260711-001` hit-ref and pointer-target protocol: String hit refs,
  `Map<String, PreparedPointerTargetFrame>`, `PointerInteractionTargets`, and
  runtime pointer-target records stay byte-compatible and untouched in M4.4.

`DungeonEditorRuntimePublication` is not a foreign seam. Its only purpose is a
one-field internal wrapper around `DungeonEditorRenderFrame`, and deleting it
does not authorize any change to the frame or shell sink APIs listed above.

## Untouched Surfaces

- M4.5 editor view/input behavior under
  `src/view/leftbartabs/dungeoneditor/**` stays behavior-compatible and may
  change only where direct frame delivery or map-content public API wiring
  requires it.
- M4.3 Travel behavior under `src/domain/dungeon/model/runtime/travel/**`,
  `src/domain/dungeon/published/*Travel*`, and
  `src/view/leftbartabs/dungeontravel/**` stays behavior-compatible and may
  change only where `DungeonMapContentModel` keeps the same public surface.
- M4.1/M4.2 authored-core/editor runtime operations, Party, persistence, and
  data-layer behavior stay untouched.
- Harness scenarios, assertion labels, fixtures, image snapshots, and owner
  smoke oracles stay untouched except for a separately committed wiring port
  that performs mechanical reference changes only.
- `PH-20260711-001` remains the runtime/editor repair target for the broader
  hit-ref and pointer-target String protocol. M4.4 may preserve that protocol
  and count it as an accepted seam exception; it must not hide it by changing
  names or formatting.

## Wiring-Port Boundary

The separate M4.4 wiring-port commit may:

- introduce the new package-private target classes with compatibility routing
  while the old content-part files still exist;
- route `DungeonEditorRuntimeFramePublisher`,
  `DungeonEditorFeatureRuntimeRoot`, and `DungeonEditorFeatureShellBinding`
  from `DungeonEditorRuntimePublication` to direct `DungeonEditorRenderFrame`
  delivery without changing `DungeonEditorFeatureShellBinding` public API;
- port constructor calls, private field names, private method calls, package
  imports, and direct references needed to keep the frozen harness inventory
  running against old behavior;
- add temporary private adapters inside M4.4-owned files only when they are
  deleted or collapsed during the implementation commit.

The wiring-port commit may not delete the content-part files, change rendered
geometry, alter harness scenarios or assertions, change visible text, change
image snapshots, weaken or replace pass/fail oracles, or start the target
implementation before the design is approved.

## Implementation Amendment: Source-Shape Split

During step-5 implementation, `pmdStrictMain`, `cpdMain`, and clean
`compileJava` exposed that the old `*ContentPartModel` suffix had been a
metric-carrier exception. Removing that suffix while placing all moved logic
into `DungeonMapFrameProjector`, `DungeonMapSceneAssembler`,
`DungeonMapHitIndex`, and `DungeonMapViewportState` preserves behavior but
creates new PMD/CKJM hotspots and CPD-visible duplicate responsibilities.
M4.4 therefore adds a source-shape split to the target design instead of
suppressing checks, rephrasing duplicate blocks, or renaming files into
another excluded surface.

The approved top-level target classes remain the external design landmarks:

- `DungeonMapRenderState`
- `DungeonMapFrameProjector`
- `DungeonMapSceneAssembler`
- `DungeonMapHitIndex`
- `DungeonMapInlineLabelState`
- `DungeonMapViewportState`

The implementation may add only these package-private helper files to keep each
target class cohesive and PMD/CKJM/CPD-green:

- `src/features/dungeon/runtime/DungeonEditorPreparedMapEntries.java`: map
  list and status-text preparation for
  `DungeonEditorRuntimeFrameFactsAssembler`.
- `src/features/dungeon/runtime/DungeonEditorMapInteractionFrames.java`:
  map-surface pointer-target facts for the byte-compatible
  `DungeonEditorPreparedFrameFacts.MapInteractionFrame.from(...)` factory.
- `src/view/slotcontent/main/dungeonmap/DungeonMapFrameConsumption.java`:
  render-frame change detection, hover-target retention, and exact-cell
  enrichment previously hidden in `DungeonMapFrameConsumptionContentPartModel`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorRenderProjector.java`:
  editor-surface to render-state projection from `DungeonEditorMapSnapshot`,
  selection, prepared preview, and interaction facts.
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorProjectionAccumulator.java`:
  editor projection list ownership before render-state construction.
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorAreaProjector.java`:
  editor area, graph-node, room-label, and cluster-label projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorFeatureProjector.java`:
  editor feature cell and marker projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapEditorHandleProjector.java`:
  runtime-prepared editor handle marker projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreparedPreviewProjector.java`:
  prepared stair and boundary preview projection from
  `PreviewRenderFrame`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapTravelRenderProjector.java`:
  travel-snapshot to render-state projection from `DungeonMapSnapshot` and
  `DungeonTravelSurfaceSnapshot`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapTravelMarkerProjector.java`:
  travel feature marker and travel marker-handle projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderElementFactory.java`:
  room-label, topology-ref, and shared render-element construction.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderCells.java`: typed
  render-cell construction and feature/area kind normalization.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderEdges.java`: typed
  render-edge construction and boundary kind normalization.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderMarkers.java`: typed
  render-marker construction.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderMarkerPlacement.java`:
  shared feature marker placement, level, anchor-edge, and cell-center
  decisions for editor, travel, and preview markers.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderMarkerHandles.java`:
  typed marker-handle construction.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderMarkerKinds.java`:
  typed marker kind and display-token decisions.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRenderSelection.java`:
  typed render selection checks for areas, handles, boundaries, features, and
  clusters.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewDiffProjector.java`:
  prepared preview-diff projection into typed render cells, edges, labels, and
  markers.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewAreaDiffProjector.java`:
  preview area-diff cell and room-label projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewBoundaryDiffProjector.java`:
  preview boundary-diff edge projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewHandleDiffProjector.java`:
  preview handle-diff marker projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapPreviewFeatureDiffProjector.java`:
  preview feature-diff cell, label, marker, and stair-level projection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapRoomLabelPlanner.java`:
  room-label placement and wall-run selection.
- `src/view/slotcontent/main/dungeonmap/DungeonMapGridSceneAssembler.java`:
  grid scene bucket assembly used only by `DungeonMapSceneAssembler`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapGraphSceneAssembler.java`:
  graph scene bucket assembly used only by `DungeonMapSceneAssembler`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapSceneGeometry.java`: scene
  geometry shared by scene assembly and hit indexing.
- `src/view/slotcontent/main/dungeonmap/DungeonMapSceneIdentity.java`: hit-ref
  identity and selection-ref construction under `PH-20260711-001`.
- `src/view/slotcontent/main/dungeonmap/DungeonMapSceneStyles.java`: surface,
  edge, marker, label, hover, and palette style decisions.
- `src/view/slotcontent/main/dungeonmap/DungeonMapHitAreaIndex.java`: hit-area
  bucketing and hit ordering.
- `src/view/slotcontent/main/dungeonmap/DungeonMapHitAreaProjector.java`:
  scene primitive to hit-area projection plus polygon/polyline math.
- `src/view/slotcontent/main/dungeonmap/DungeonMapViewportScale.java`:
  viewport scale constants and zoom clamping used by `DungeonMapViewportState`,
  render geometry, and hit tolerance.

These helpers are not replacement wrappers. Each must own real behavior moved
from the deleted files or from the oversized target classes. They must not use
the retired `ContentPartModel` suffix, must not reintroduce the deleted class
names, and must not preserve duplicate methods by rephrasing them. The
deletion list remains binding, and the helper split is accepted only if the
PMD/CKJM/CPD/source-shape gates pass without new suppressions, checker
weakening, or duplicate-helper rephrasing.

Metric impact is explicit:

- The 31 map helper files above plus the six map target classes,
  `DungeonMapContentModel`, `DungeonMapView`, and
  `DungeonMapViewInputEvent` raise the primary map package file cap to
  **at most 40 Java files / 8,050 physical LOC**. The clean-compile snapshot
  after the split is 40 Java files / 7,915 physical LOC. This is a reviewed exception
  to the original 10-file / 6,000-LOC target because the old content-part
  suffix was a view metric-carrier exception and the replacement must be
  PMD/CKJM/CPD-green without reusing that suffix.
- The runtime frame/publication subset deletes
  `DungeonEditorRuntimePublication`, `DungeonEditorMapInteractionFrameAssembler`,
  and `DungeonEditorPreparedFrameProjection`, adds the two runtime helper files
  above, and measures 9 Java files / 1,693 physical LOC by the baseline
  `(Render|Frame|Prepared)` formula. The primary map plus runtime
  frame/publication subset cap becomes
  **at most 49 Java files / 9,750 physical LOC**.
- The direct product render route cap becomes
  **at most 72 Java files / 13,400 physical LOC** by the baseline formula:
  primary map package, runtime frame/publication subset, the unchanged 16-file
  hit-ref and pointer-target protocol seam, and the seven direct adjacent
  render consumers. The exception is limited to implementation helper files in
  the exact paths above; no editor/travel/domain behavior surface may be added
  to satisfy the file cap.
- Design-visible render ceremony counts the helpers as these nine groups:
  runtime frame publication/facts; content model coordinator; render state;
  frame projection helpers; scene assembly helpers; hit-index helpers;
  inline-label state; viewport state/scale; and map view/input.

## Metric Targets And Exceptions

The conformance review re-runs the baseline measurements against these binding
targets:

| Metric | Baseline | Target |
| --- | ---: | ---: |
| Primary map package | 13 files / 7,484 LOC | Source-shape exception: at most 40 files / 8,050 LOC, using only the helper files named in the amendment. |
| Primary map plus runtime frame/publication subset | 23 files / 9,200 LOC | Source-shape exception: at most 49 files / 9,750 LOC, using only the helper files named in the amendment. |
| Direct product render route | 46 files / 12,829 LOC | Source-shape exception: at most 72 files / 13,400 LOC, using only the helper files named in the amendment. |
| Strict forwarding/proxy classes in M4.4-owned route | 2 | 0. `DungeonEditorRuntimePublication` is deleted. `DungeonEditorFeatureShellBinding` may remain only as the byte-compatible shell seam, not as an M4.4-owned proxy. |
| One-method render helper classes | 1 | 0. `DungeonMapStairPreviewLevelLabelContentPartModel` is deleted and its behavior moves into `DungeonMapFrameProjector` or `DungeonMapSceneAssembler`. |
| Design-visible render ceremony classes/groups | 17 | At most 9 target groups, counted by the amendment grouping rule. |
| Editor publication to canvas chain | 13 to scene / 15 to canvas | Source-shape exception: at most 11 to scene / 14 to canvas. This target counts the retained `DungeonEditorRuntimeReadbackFrameInputs`, `DungeonEditorRuntimeDraftSession.draftFrame`, and real helper boundaries; M4.4's reduction comes from deleting the publication wrapper and content-part cascade, not from hiding retained runtime work. |
| Travel snapshot to canvas chain | 5 to scene / 7 to canvas | Source-shape exception: at most 7 to scene / 10 to canvas, with the content-part cascade removed and helper boundaries counted. |
| Pointer hit selection chain | 6 | Source-shape exception: at most 7. Accepted M4.4 exception because `PH-20260711-001` keeps the hit-ref protocol byte-compatible for M4.5/runtime consumers and `DungeonMapHitAreaIndex` is counted as a real helper boundary. |
| Product String boundary protocol families | 5 | At most 4 outside the accepted `PH-20260711-001` hit-ref/pointer-target seam. Render-owned topology and label-kind refs become typed inside `DungeonMapRenderState` where no public/harness seam requires Strings. |
| Render-state representations | 6 | At most 5. `DungeonMapHitIndex` is a derived cache, not a separate source of render truth. `DungeonEditorPreparedFrameFacts` remains as a byte-compatible M4.5-consumed seam exception. |

Missed targets require an individually justified judge-accepted exception in
the conformance review. Hitting a target through line compression, comment
deletion, cosmetic renames, unrelated merges, or duplicate-helper rephrasing is
Rework.

## Design Authority

This design does not authorize wiring or implementation until it is approved by
the required Phase 1 and Phase 2 design review path. Any implementation
deviation must be preceded by a design amendment commit that names the reason
and receives the same review standard before deviating code lands.
