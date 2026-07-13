Status: Active
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.4 diagnostic baseline metrics for the Dungeon rendering
pipeline architecture migration sub-slice before target design.

# Dungeon Rendering Pipeline Migration Baseline

## Purpose

This document records the M4.4 baseline metrics for
`dungeon-rendering-pipeline` after harness closure and before any target
design, wiring port, or implementation. The numbers are diagnostic. They make
the current render path measurable for the next reviewed design, but do not
approve a design or prescribe implementation.

## Scope

The primary M4.4 render surface is:

- `src/view/slotcontent/main/dungeonmap`

The design-visible editor render producer is the runtime frame/publication
subset that builds `DungeonEditorRenderFrame` and `DungeonEditorPreparedFrameFacts`.
It is counted separately because M4.2 owns the runtime structure, while M4.4
owns the render pipeline that consumes the frame:

- `src/features/dungeon/runtime/*Render*.java`
- `src/features/dungeon/runtime/*Frame*.java`
- `src/features/dungeon/runtime/*Prepared*.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimePublication.java`

The current hit-ref and pointer-target protocol is design-visible because
`DungeonMapContentModel` exposes hit refs and prepared pointer frames back to
the editor intent handler. It remains a separate project-health residual under
`PH-20260711-001`; this baseline counts it so the target design can make an
explicit ownership decision instead of hiding it:

- `src/features/dungeon/runtime/*HitRef*.java`
- `src/features/dungeon/runtime/*PointerTarget*.java`

The direct editor/travel render consumers are counted as a focused adjacent
set:

- `src/view/leftbartabs/dungeoneditor/DungeonEditorBinder.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java`
- `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java`
- `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java`
- `src/view/leftbartabs/dungeontravel/DungeonTravelContributionModel.java`
- `src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java`
- `src/features/dungeon/shell/DungeonEditorFeatureShellBinding.java`

The complete editor/travel left-bar packages are counted separately as a
diagnostic full visible-route set. They are not automatic M4.4 deletion
targets. M4.5 owns the editor view/input slice, and M4.3 already owns Travel.

## Reproduction

Counts use Java files only. LOC means physical Java file lines from `wc -l`,
including blank lines and comments. Secondary nonblank count uses the same file
set with blank lines removed.

Primary map package:

```bash
find src/view/slotcontent/main/dungeonmap -type f -name '*.java' | wc -l
# 13

find src/view/slotcontent/main/dungeonmap -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 7484 total

find src/view/slotcontent/main/dungeonmap -type f -name '*.java' -print0 \
  | sort -z | xargs -0 sed '/^[[:space:]]*$/d' | wc -l
# 6743
```

Runtime frame/publication subset:

```bash
find src/features/dungeon/runtime -maxdepth 1 -type f -name '*.java' \
  | rg '(Render|Frame|Prepared)' | sort | wc -l
# 9

find src/features/dungeon/runtime -maxdepth 1 -type f -name '*.java' \
  | rg '(Render|Frame|Prepared)' | sort | xargs wc -l | tail -1
# 1703 total

wc -l src/features/dungeon/runtime/DungeonEditorRuntimePublication.java
# 13
```

Runtime hit-ref and pointer-target protocol subset:

```bash
find src/features/dungeon/runtime -maxdepth 1 -type f -name '*.java' \
  | rg '(HitRef|PointerTarget)' | sort | wc -l
# 16

find src/features/dungeon/runtime -maxdepth 1 -type f -name '*.java' \
  | rg '(HitRef|PointerTarget)' | sort | xargs wc -l | tail -1
# 1597 total

find src/features/dungeon/runtime -maxdepth 1 -type f -name '*.java' \
  | rg '(HitRef|PointerTarget)' | sort \
  | xargs sed '/^[[:space:]]*$/d' | wc -l
# 1413
```

Direct adjacent render consumers:

```bash
wc -l \
  src/view/leftbartabs/dungeoneditor/DungeonEditorBinder.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java \
  src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java \
  src/view/leftbartabs/dungeontravel/DungeonTravelContributionModel.java \
  src/view/leftbartabs/dungeontravel/DungeonTravelIntentHandler.java \
  src/features/dungeon/shell/DungeonEditorFeatureShellBinding.java
# 2032 total
```

Full adjacent editor/travel left-bar route:

```bash
find src/view/leftbartabs/dungeoneditor src/view/leftbartabs/dungeontravel \
  -maxdepth 1 -type f -name '*.java' | wc -l
# 27

find src/view/leftbartabs/dungeoneditor src/view/leftbartabs/dungeontravel \
  -maxdepth 1 -type f -name '*.java' -print0 \
  | sort -z | xargs -0 wc -l | tail -1
# 7192 total
```

## File And LOC Baseline

| Root | Files | Physical LOC | Nonblank LOC | Migration ownership |
| --- | ---: | ---: | ---: | --- |
| `src/view/slotcontent/main/dungeonmap` | 13 | 7,484 | 6,743 | Primary M4.4 render package |
| Runtime frame/publication subset | 10 | 1,716 | 1,570 | Design-visible producer; M4.2-owned runtime structure |
| Primary map plus runtime frame/publication subset | 23 | 9,200 | 8,313 | Main M4.4 render-readback measurement |
| Runtime hit-ref and pointer-target protocol subset | 16 | 1,597 | 1,413 | Design-visible residual; active PH-20260711-001 owner remains runtime/editor |
| Map plus frame plus hit-ref protocol | 39 | 10,797 | 9,726 | Diagnostic render-plus-selection protocol set |
| Direct adjacent render consumers | 7 | 2,032 | 1,847 | Editor/travel binders, contribution models, intent handlers, and shell delivery |
| Direct product render route | 46 | 12,829 | 11,573 | Diagnostic set for design-visible render consumers |
| Full adjacent editor/travel left-bar packages | 27 | 7,192 | 6,462 | Full visible route, not automatic M4.4 ownership |
| Full visible route plus map/frame/hit-ref/shell | 67 | 18,075 | 16,261 | Diagnostic only; spans M4.2, M4.3, M4.4, and M4.5 |

The primary target-design denominator must at least account for the
13-file / 7,484-LOC map package and the 10-file / 1,716-LOC frame/publication
producer subset. If the design excludes the hit-ref protocol or adjacent
binders, it must say so explicitly in the seam and untouched lists.

## Snapshot/Facts/Frame/ContentModel Chains

Counting rule: count meaningful class-boundary hops in the render-readback
pipeline. Data records are listed when they are stable boundary objects, but
simple field access and same-class private helpers are not counted as separate
hops.

| Interaction | Baseline chain | Hop count | Evidence |
| --- | --- | ---: | --- |
| Editor publication to rendered canvas | `DungeonEditorRuntimeFramePublisher.publishCurrentToSubscribers/currentFrame` -> `DungeonEditorRuntimeReadbackFrameInputs.from` -> `DungeonEditorRuntimeDraftSession.draftFrame` -> `DungeonEditorRuntimeFrameFactsAssembler.preparedFacts` -> `DungeonEditorPreparedFrameFacts.MapInteractionFrame.from` -> `DungeonEditorMapInteractionFrameAssembler.from` -> `DungeonEditorRuntimePublication` -> `DungeonEditorFeatureShellBinding.JavaFxPublicationDelivery` -> `DungeonEditorBinder.applyFrame` -> `DungeonMapContentModel.applyEditorRenderFrame` -> `DungeonMapFrameConsumptionContentPartModel.consumeEditorSurfaceFrame` -> `DungeonMapSnapshotProjectionContentPartModel.mapEditorSurface` -> `DungeonMapRenderSceneContentPartModel.toSceneProjection` -> `DungeonMapHitGeometryContentPartModel.update` -> `DungeonMapView.redraw/CanvasRenderer.render` | 13 to `RenderScene`; 15 including hit-index rebuild and canvas draw | `src/features/dungeon/runtime/DungeonEditorRuntimeFramePublisher.java:58`, `src/features/dungeon/runtime/DungeonEditorRuntimeFramePublisher.java:99`, `src/features/dungeon/runtime/DungeonEditorRuntimeFrameFactsAssembler.java:17`, `src/features/dungeon/runtime/DungeonEditorRuntimeFrameFactsAssembler.java:109`, `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:609`, `src/features/dungeon/runtime/DungeonEditorMapInteractionFrameAssembler.java:15`, `src/features/dungeon/shell/DungeonEditorFeatureShellBinding.java:29`, `src/view/leftbartabs/dungeoneditor/DungeonEditorBinder.java:64`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:159`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:381`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:396`, `src/view/slotcontent/main/dungeonmap/DungeonMapView.java:143` |
| Travel snapshot to rendered canvas | `TravelDungeonModel.subscribe/current` -> `DungeonTravelBinder.applySnapshot` -> `DungeonMapContentModel.applyTravelSnapshot` -> `DungeonMapSnapshotProjectionContentPartModel.mapTravel` -> `DungeonMapRenderSceneContentPartModel.toSceneProjection` -> `DungeonMapHitGeometryContentPartModel.update` -> `DungeonMapView.redraw/CanvasRenderer.render` | 5 to `RenderScene`; 7 including hit-index rebuild and canvas draw | `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java:59`, `src/view/leftbartabs/dungeontravel/DungeonTravelBinder.java:75`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:213`, `src/view/slotcontent/main/dungeonmap/DungeonMapSnapshotProjectionContentPartModel.java:62`, `src/view/slotcontent/main/dungeonmap/DungeonMapRenderSceneContentPartModel.java:38`, `src/view/slotcontent/main/dungeonmap/DungeonMapHitGeometryContentPartModel.java:29`, `src/view/slotcontent/main/dungeonmap/DungeonMapView.java:143` |
| Editor pointer hit selection | `DungeonMapView` emits `DungeonMapViewInputEvent` -> `DungeonEditorIntentHandler.pointerInteractionTargets` -> `DungeonMapContentModel.pointerHitRefsAt/currentPointerTargetFrames` -> `DungeonMapHitGeometryContentPartModel.hitsAt` -> `PointerInteractionTargets.fromHitTargets` -> `DungeonEditorRuntimePointerTarget.fromPreparedFrame` priority selection | 6 to runtime target selection | `src/view/slotcontent/main/dungeonmap/DungeonMapView.java:456`, `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:514`, `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:524`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:124`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:130`, `src/features/dungeon/runtime/PointerInteractionTargets.java:36`, `src/features/dungeon/runtime/PointerInteractionTargets.java:64` |
| Hover overlay redraw | `DungeonEditorIntentHandler` sends hover display target -> `DungeonMapContentModel.updateRuntimeHoverDisplayTarget` -> `DungeonMapFrameConsumptionContentPartModel.updateHoverTarget` -> `DungeonMapRenderSceneContentPartModel.toHoverOverlay` -> `CanvasState.withHoverOverlay` -> `DungeonMapView.redraw` | 6 | `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:498`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:141`, `src/view/slotcontent/main/dungeonmap/DungeonMapFrameConsumptionContentPartModel.java:68`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:411`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:417`, `src/view/slotcontent/main/dungeonmap/DungeonMapView.java:143` |

The dominant render-readback chain is the editor publication route:
15 meaningful class-boundary hops when the rendered canvas and hit-index
rebuild are included.

## Forwarding, Proxy, And Ceremony Baseline

Forwarding/proxy candidate means a concrete production class whose current
behavior is primarily wrapping, forwarding, registering, or delivering another
object's result. Mapper and assembler classes are ceremony candidates when
they reshape data for the render pipeline; they are not counted as strict
forwarding-only unless they mostly delegate.

| Class or group | Baseline classification | Evidence |
| --- | --- | --- |
| `DungeonEditorRuntimePublication` | Strict publication wrapper | One-field record wrapping `DungeonEditorRenderFrame` with a factory method. |
| `DungeonEditorFeatureShellBinding` | Shell and JavaFX delivery wrapper | Creates runtime root, forwards `operations()`, wraps subscribe/current-publication delivery, and gates callbacks through JavaFX. |
| `DungeonMapStairPreviewLevelLabelContentPartModel` | One-method render helper | Adds a stair preview level label to a caller-owned list. |
| `DungeonMapContentModel` | Central render coordinator, not strict forwarding-only | Owns `CanvasState`, `DungeonMapRenderState`, hover target retention, current pointer-target frames, editor/travel frame application, and nested render records. |
| Map content-part models | Design-visible ceremony | Projection, frame-consumption, hit geometry, inline label UI state, preview diff, scene assembly, room-label placement, snapshot projection, and viewport state are split across ten helper files. |
| Runtime frame/facts assemblers | Design-visible ceremony | `DungeonEditorRuntimeFramePublisher`, `DungeonEditorRuntimeFrameFactsAssembler`, `DungeonEditorPreparedFrameProjection`, `DungeonEditorMapInteractionFrameAssembler`, and `DungeonEditorPreviewRenderDiffAssembler` reshape published snapshots into prepared frame records. |
| Adjacent editor/travel binders and contribution models | Consumer ceremony, not automatic deletion targets | They bind `DungeonMapContentModel` and `DungeonMapView`, apply editor/travel snapshots, and keep other tab content models synchronized. |

Strict forwarding/proxy count: 2 concrete product classes.
One-method helper count: 1 concrete product class.
Design-visible render ceremony inventory: 17 concrete classes or class groups
listed above, including the strict wrappers.

Structural overhead intentionally not counted as pure forwarding:
`DungeonMapRenderSceneContentPartModel` builds grid/graph primitives,
`DungeonMapHitGeometryContentPartModel` owns hit-index geometry, and
`DungeonMapFrameConsumptionContentPartModel` owns render-relevant frame
comparison plus hover-target retention.

## String Boundary Protocols

String boundary protocol means a finite-domain or target identity value crosses
an internal render boundary as a String and is later parsed, normalized, or
matched back into a finite-domain or target meaning. Display labels, free-form
descriptions, German status text, CSS classes, and authored map names are not
counted.

| Family | Baseline protocol | Evidence |
| --- | --- | --- |
| View mode and selected tool keys | Runtime frame facts convert `DungeonEditorViewMode` and `DungeonEditorTool` to `.name()` strings, then `MapSurfaceFrame.from` maps the strings back to enums with `normalizeViewModeKey` and `DungeonEditorTool.valueOf`. | `src/features/dungeon/runtime/DungeonEditorRuntimeFrameFactsAssembler.java:101`, `src/features/dungeon/runtime/DungeonEditorRuntimeFrameFactsAssembler.java:102`, `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:188`, `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:208`, `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:214` |
| Overlay mode key | `DungeonOverlaySettings.modeKey()` remains a String through prepared facts and is mapped into `DungeonMapRenderState.OverlayMode.fromKey`. | `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:109`, `src/features/dungeon/runtime/DungeonEditorPreparedFrameFacts.java:133`, `src/view/slotcontent/main/dungeonmap/DungeonMapSnapshotProjectionContentPartModel.java:83`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:1906` |
| Hit-ref target protocol | Render primitives and hit geometry emit String hit refs; the editor intent handler passes those refs plus a `Map<String, PreparedPointerTargetFrame>` back into runtime target selection. | `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:124`, `src/view/slotcontent/main/dungeonmap/DungeonMapHitGeometryContentPartModel.java:71`, `src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java:524`, `src/features/dungeon/runtime/PointerInteractionTargets.java:36`, `src/features/dungeon/runtime/PointerInteractionTargets.java:64` |
| Exact cell and boundary keys | Cell and boundary hit refs are parsed or compared as Strings to recover exact cell/boundary target identity for hover retention and selection. | `src/view/slotcontent/main/dungeonmap/DungeonMapFrameConsumptionContentPartModel.java:198`, `src/view/slotcontent/main/dungeonmap/DungeonMapFrameConsumptionContentPartModel.java:213`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:1412`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:1455` |
| Render topology and label kind strings | Published/render topology refs and label kinds still cross the map render state as Strings, then map back into `PreparedTopologyKind` and `PreparedLabelKind` for inline-label and pointer-target matching. | `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:427`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:434`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:713`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:818`, `src/view/slotcontent/main/dungeonmap/DungeonMapContentModel.java:2026` |

Baseline count: 5 product String boundary protocol families.

Diagnostic non-counts:

- Map titles, labels, narration, feature descriptions, destination labels, and
  visible status text are authored or display text.
- CSS style classes, font names, color labels, and JavaFX control text are
  presentation constants, not finite-domain protocol values.
- The broader runtime/editor hit-ref owner is active under PH-20260711-001.
  M4.4 may keep it byte-compatible and untouched if the approved target design
  names the seam and leaves the runtime/editor target-owner repair to that
  debt entry.

## Render-State Representations

The current pipeline reshapes the same map state through these representations:

1. Published snapshots: `DungeonEditorMapSurfaceSnapshot`, `DungeonEditorStateSnapshot`,
   `DungeonEditorControlsSnapshot`, and `TravelDungeonSnapshot`.
2. Runtime frame facts: `DungeonEditorPreparedFrameFacts`, `MapSurfaceFrame`,
   `MapInteractionFrame`, `PreviewRenderFrame`, `PreviewRenderDiffFrame`,
   and `PreparedPointerTargetFrame`.
3. Map content state: `DungeonMapContentModel.DungeonMapRenderState`,
   including cells, edges, labels, markers, graph nodes, overlay settings,
   topology, and selected-tool metadata.
4. Render scene primitives: `RenderScene`, `MapCanvasPolygonPrimitive`,
   `BoundaryPrimitive`, `GlyphPrimitive`, `TextPrimitive`, `RelationPrimitive`,
   and actor polygons.
5. Hit geometry index: `CanvasHit`, `HitArea`, `HitIndex`, and hit-ref buckets.
6. JavaFX canvas state: `CanvasState`, `Viewport`, and the `DungeonMapView`
   canvas renderer.

Baseline representation count: 6 render-state layers. The approved design
must name which of these representations remain and why.

## Harness Inventory

M4.4 harness check/closure is already done on branch in the ledger. Frozen
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
- focused handoff for `src/view/slotcontent/main/dungeonmap`, area
  `dungeon-rendering-pipeline`

Recorded proof counts are: core 72, editor aggregate 206, route 187, door 58,
wall 33, room 64, cluster 84, corridor 68, stair 63, transition 62, feature
59, travel projection 5, render parity 3, topology, and map consistency.
Render parity proof IDs are `DE-IMG-001`, `DE-IMG-002`, and `DT-IMG-001`.
Harness scenarios and assertions are frozen; this baseline does not change
wiring.

## Residual Notes For Design

- The M4.4 target design must use the 23-file / 9,200-LOC primary
  map-plus-frame measurement as its minimum starting denominator, or explicitly
  justify a narrower primary denominator.
- If the design touches the hit-ref/target protocol, it must coordinate with
  active project-health debt PH-20260711-001. If it does not, the design must
  name the hit-ref protocol as an untouched byte-compatible seam.
- Editor, Travel, shell, and runtime published seams consumed by M4.2, M4.3,
  and M4.5 stay byte-compatible unless the approved design migrates both sides
  in the same reviewed step.
- The next step is a judge-approved M4.4 target design with concrete target
  classes, representative call chains, deletion list, seam statement, untouched
  list, frozen parity inventory, and metric targets or individually justified
  exceptions.
- This baseline does not authorize wiring or implementation.
