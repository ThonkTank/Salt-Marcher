Status: Baseline
Owner: SaltMarcher Team
Last Reviewed: 2026-07-11
Source of Truth: M4.5 `dungeon-editor-view` baseline metrics for
`architecture-migration-roadmap.md` and `migration-ledger.md`.

# Dungeon Editor View Baseline

## Scope

This baseline measures M4.5 before target design. It is diagnostic only and
does not approve wiring, deletion, or implementation.

Primary scope:

- `src/view/leftbartabs/dungeoneditor/**`

Design-visible adjacent seams:

- `src/features/dungeon/runtime/DungeonEditorControlOperations.java`
- `src/features/dungeon/runtime/DungeonEditorRuntimeOperations.java`
- `src/features/dungeon/runtime/PointerInteractionTargets.java`
- `src/features/dungeon/runtime/DungeonEditorMapHitRefs.java`

`PH-20260711-001` is active project-health debt in the hit-ref to
pointer-target protocol. The target design must either resolve it by moving
the protocol to a typed runtime target-owner seam or narrow it with a new,
specific debt record accepted by review. The baseline does not treat it as a
harness gap.

## Reproduction

The measurements were taken in detached clean worktree
`/tmp/saltmarcher-m45-baseline` at commit `d74835508`.

```bash
find src/view/leftbartabs/dungeoneditor -name '*.java' | sort | wc -l
find src/view/leftbartabs/dungeoneditor -name '*.java' -print0 \
  | xargs -0 wc -l
find src/view/leftbartabs/dungeoneditor -name '*State*.java' -print0 \
  | xargs -0 wc -l
find src/view/leftbartabs/dungeoneditor \
  \( -name '*Controls*.java' -o -name '*ToolPalette*.java' \
     -o -name '*ProjectionOverlay*.java' -o -name '*MapCatalog*.java' \) \
  -print0 | xargs -0 wc -l
wc -l \
  src/view/leftbartabs/dungeoneditor/DungeonEditorContribution.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorContributionModel.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorBinder.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java
wc -l \
  src/features/dungeon/runtime/PointerInteractionTargets.java \
  src/features/dungeon/runtime/DungeonEditorMapHitRefs.java \
  src/view/leftbartabs/dungeoneditor/DungeonEditorIntentHandler.java
```

Nonblank LOC was measured from the same file sets with:

```bash
awk 'NF {count++} END {print count}' <file>
```

## File And LOC Baseline

| Set | Files | Physical LOC | Nonblank LOC |
| --- | ---: | ---: | ---: |
| Primary editor view package | 17 | 5,752 | 5,230 |
| State panel subset | 7 | 2,612 | 2,398 |
| Controls, catalog, overlay, and tool-palette subset | 6 | 1,707 | 1,513 |
| Contribution, binder, and intent subset | 4 | 1,433 | 1,319 |
| `PH-20260711-001` hit-ref subset | 3 | 1,347 | 1,242 |
| Primary editor view package plus PH runtime files | 19 | 6,058 | 5,509 |

The subset rows overlap. The final row is the unique primary M4.5 package plus
the two runtime files that currently own the active hit-ref residual.

Primary files:

- `DungeonEditorBinder.java`
- `DungeonEditorContribution.java`
- `DungeonEditorContributionModel.java`
- `DungeonEditorControlsContentModel.java`
- `DungeonEditorControlsView.java`
- `DungeonEditorControlsViewInputEvent.java`
- `DungeonEditorIntentHandler.java`
- `DungeonEditorMapCatalogContentPartModel.java`
- `DungeonEditorProjectionOverlayContentPartModel.java`
- `DungeonEditorStateContentModel.java`
- `DungeonEditorStateNarrationContentPartModel.java`
- `DungeonEditorStateSelectionPreviewContentPartModel.java`
- `DungeonEditorStateStairGeometryContentPartModel.java`
- `DungeonEditorStateTransitionContentPartModel.java`
- `DungeonEditorStateView.java`
- `DungeonEditorStateViewInputEvent.java`
- `DungeonEditorToolPaletteContentPartModel.java`

## Longest Intent-To-Mutation Chains

The view layer still owns several multi-hop intent paths before runtime or
domain mutation is reached.

1. Pointer canvas tool route, 5 view/runtime-boundary hops before runtime
   workflow mutation:
   `DungeonMapView` emits `DungeonMapViewInputEvent` ->
   `DungeonEditorIntentHandler.consumeMapCanvas` ->
   `consumePointerToolInput` ->
   `PointerInteractionTargets.fromHitTargets` ->
   `DungeonEditorPointerInteractionOperations.applyPointerInteraction` ->
   runtime pointer workflow and authored/runtime publication.

2. State transition destination save, 5 view-owned hops before the runtime
   seam:
   `DungeonEditorStateView` emits `DungeonEditorStateViewInputEvent` ->
   `DungeonEditorIntentHandler.consume` ->
   `consumeTransitionDestinationWhenPresent` ->
   `TransitionDestinationDraftInput.fromExternalName` using
   `DungeonEditorStateContentModel.transitionDestinationTypeKey` ->
   `transitionStairOperations.saveTransitionLink`.

3. Controls view/tool/overlay route, 4 to 5 hops before the runtime seam:
   `DungeonEditorControlsView` emits `DungeonEditorControlsViewInputEvent` ->
   `DungeonEditorIntentHandler.consume` ->
   `handleToolInput`, `handleViewMode`, or `handleOverlayInput` ->
   `DungeonEditorControlOperations.parseToolKey`,
   `DungeonEditorControlOperations.parseViewModeKey`, or local overlay parsing
   ->
   `DungeonEditorControlOperations`.

4. Frame publication to readback route, 5 to 6 hops to UI projection:
   `DungeonEditorFeatureShellBinding` delivers a frame ->
   `DungeonEditorBinder.applyFrame` ->
   `DungeonEditorContributionModel.applyFrame` ->
   `DungeonEditorControlsContentModel.showControls` or
   `DungeonEditorStateContentModel.apply` ->
   content-part projection models ->
   JavaFX views. This route is readback projection, not a mutation path.

Evidence anchors:

- `DungeonEditorIntentHandler` consumes controls, catalog, state input, and map
  canvas events and still performs parsing plus operation selection.
- `DungeonEditorControlsView` emits string-based view, tool, overlay, catalog,
  and level snapshots.
- `DungeonEditorStateContentModel` and its content-part models convert runtime
  frame state into string-heavy state-panel projections.
- `PointerInteractionTargets` resolves `List<String>` hit refs against a
  `Map<String, PreparedPointerTargetFrame>` before pointer workflow dispatch.

## Forwarding And Ceremony Baseline

Strict concrete forwarding/proxy count:

- 1 concrete shell adapter: `DungeonEditorContribution`

Operation-bundle seam count:

- 1 interface seam: `DungeonEditorRuntimeOperations`

Design-visible assembly/projection ceremony candidates:

- `DungeonEditorBinder`
- `DungeonEditorContributionModel`
- `DungeonEditorControlsContentModel`
- `DungeonEditorMapCatalogContentPartModel`
- `DungeonEditorProjectionOverlayContentPartModel`
- `DungeonEditorToolPaletteContentPartModel`
- `DungeonEditorStateNarrationContentPartModel`
- `DungeonEditorStateSelectionPreviewContentPartModel`
- `DungeonEditorStateStairGeometryContentPartModel`
- `DungeonEditorStateTransitionContentPartModel`

Not every candidate is a deletion target. Several classes also own current UI
state, normalization, or JavaFX binding. The target design must classify each
candidate explicitly as delete, absorb, retain, or untouched.

## String Boundary Baseline

Seven product String boundary families are visible in the current M4.5 surface:

1. Tool, family, and option keys across `DungeonEditorToolPaletteContentPartModel`,
   `DungeonEditorControlsViewInputEvent`, and
   `DungeonEditorControlOperations.parseToolKey`.
2. View-mode keys across controls projection, controls view events, intent
   handling, and `DungeonEditorControlOperations.parseViewModeKey`.
3. Overlay mode keys and comma-separated selected levels across controls view
   events, `DungeonEditorProjectionOverlayContentPartModel`, and
   `DungeonEditorIntentHandler`.
4. Map catalog item IDs as String event payloads converted through
   `DungeonEditorIntentHandler.parseLongOrZero`.
5. Transition destination type, map ID, tile ID, and transition ID strings
   converted into `TransitionDestinationDraftInput`.
6. Stair geometry shape, direction, and dimension strings converted before
   runtime stair operations.
7. Hit-ref and pointer-target IDs in `PH-20260711-001`:
   `List<String> hitRefs` plus `Map<String, PreparedPointerTargetFrame>`.

The target design must reduce or justify these boundaries without changing
visible behavior or frozen harness assertions.

## Harness And Review Context

M4.5 step 1 froze the following proof inventory for this area:

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

The retained step-1 logs passed in the clean proof worktree. Focused handoff
did not run Gradle because project-health intake stopped on active
`PH-20260711-001`. That failure is an honest baseline/design constraint, not a
missing documentation gate and not a reason to weaken the intake.

## Baseline Conclusions

The M4.5 target design must name:

- target classes and target call chains for controls, state-panel, map-catalog,
  pointer, and frame-readback routes
- a deletion list that either removes or justifies the projection/assembly
  ceremony above
- the byte-compatible seams preserved for runtime, map rendering, shell
  contribution, and harness consumers
- the exact handling of `PH-20260711-001`
- the metric targets and any individually justified exceptions

No implementation is approved by this baseline.
