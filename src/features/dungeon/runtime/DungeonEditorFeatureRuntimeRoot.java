package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

public final class DungeonEditorFeatureRuntimeRoot implements DungeonEditorRuntimeOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorPointerSession pointerSession = new DungeonEditorPointerSession();

    public static DungeonEditorFeatureRuntimeRoot create(ServiceRegistry registry) {
        ServiceRegistry safeRegistry = Objects.requireNonNull(registry, "registry");
        return new DungeonEditorFeatureRuntimeRoot(
                safeRegistry.require(DungeonEditorControlsModel.class),
                safeRegistry.require(DungeonEditorMapSurfaceModel.class),
                safeRegistry.require(DungeonEditorStateModel.class),
                DungeonEditorAuthoredRuntimeAssembly.create(safeRegistry));
    }

    private DungeonEditorFeatureRuntimeRoot(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
    }

    public DungeonEditorRuntimeOperations operations() {
        return this;
    }

    @Override
    public void selectMap(long mapIdValue) {
        operationOwner.selectMap(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        operationOwner.createMap(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        operationOwner.renameMap(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        operationOwner.deleteMap(mapIdValue);
    }

    @Override
    public void setViewMode(String viewModeKey) {
        operationOwner.setViewMode(viewModeKey);
    }

    @Override
    public void setTool(String toolKey) {
        clearPointerSession();
        operationOwner.setTool(toolKey);
    }

    @Override
    public void cancelActivePreviewSession() {
        clearPointerSession();
        operationOwner.cancelActivePreviewSession();
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        operationOwner.shiftProjectionLevel(levelShift);
    }

    @Override
    public void setOverlay(String modeKey, int levelRange, double opacity, java.util.List<Integer> selectedLevels) {
        operationOwner.setOverlay(modeKey, levelRange, opacity, selectedLevels);
    }

    @Override
    public void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorTool wallTool = DungeonEditorWallBoundaryDraftRuntimeOperation.wallTool(toolKey);
        if (wallTool != null) {
            operationOwner.applyWallBoundaryDraft(
                    action,
                    wallTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return;
        }
        DungeonEditorTool corridorTool = DungeonEditorCorridorDraftRuntimeOperation.corridorTool(toolKey);
        if (corridorTool != null) {
            operationOwner.applyCorridorDraft(
                    action,
                    corridorTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return;
        }
        if (DungeonEditorTool.SELECT == DungeonEditorRuntimeEnumTranslator.editorTool(toolKey)) {
            operationOwner.applySelectionHandlePreview(
                    action,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return;
        }
        operationOwner.applyPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination);
    }

    @Override
    public PointerWorkflowIntent pointerWorkflowIntent(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        return DungeonEditorPointerWorkflowIntentResolver.resolve(selectedTool, gesture);
    }

    @Override
    public boolean acceptPointerSession(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            int projectionLevel
    ) {
        return pointerSession.accept(action, toolKey, sample, projectionLevel);
    }

    @Override
    public void clearPointerSession() {
        pointerSession.clear();
    }

    @Override
    public void scrollSelection(int levelDelta) {
        operationOwner.scrollSelection(levelDelta);
    }

    @Override
    public void moveHandle(HandleTarget handle, int q, int r) {
        operationOwner.moveHandle(handle, q, r);
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        operationOwner.saveRoomNarration(narration);
    }

    @Override
    public void saveLabelName(String targetKind, long targetId, String name) {
        operationOwner.saveLabelName(targetKind, targetId, name);
    }

    @Override
    public void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        operationOwner.saveTransitionLink(sourceTransitionId, targetMapId, targetTransitionId, bidirectional);
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        operationOwner.saveTransitionDescription(transitionId, description);
    }

    @Override
    public void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        operationOwner.saveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2);
    }

    public DungeonEditorRuntimePublication currentPublication() {
        return DungeonEditorRuntimePublication.published(currentFrame());
    }

    public Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        Consumer<DungeonEditorRuntimePublication> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        return stateModel.subscribe(ignored -> safeSubscriber.accept(currentPublication()));
    }

    private DungeonEditorRenderFrame currentFrame() {
        DungeonEditorControlsSnapshot controls = controlsModel.current();
        return new DungeonEditorRenderFrame(
                controls,
                mapSurfaceModel.current(),
                stateModel.current(),
                preparedFacts(controls));
    }

    private static DungeonEditorPreparedFrameFacts preparedFacts(DungeonEditorControlsSnapshot controlsSnapshot) {
        DungeonEditorControlsSnapshot safeControls = controlsSnapshot == null
                ? DungeonEditorControlsSnapshot.empty("")
                : controlsSnapshot;
        var mapEntries = safeControls.maps().stream()
                .map(DungeonEditorFeatureRuntimeRoot::toMapEntry)
                .toList();
        DungeonMapId selectedMapId = safeControls.selectedMapId();
        var reachableLevels = safeControls.reachableLevels();
        int projectionLevel = clampProjectionLevel(reachableLevels, safeControls.projectionLevel());
        DungeonOverlaySettings overlaySettings = safeControls.overlaySettings() == null
                ? DungeonOverlaySettings.defaults()
                : safeControls.overlaySettings();
        DungeonEditorViewMode viewMode = safeControls.viewMode() == null
                ? DungeonEditorViewMode.GRID
                : safeControls.viewMode();
        DungeonEditorTool selectedTool = safeControls.selectedTool() == null
                ? DungeonEditorTool.SELECT
                : safeControls.selectedTool();
        return new DungeonEditorPreparedFrameFacts(
                mapEntries,
                keyOf(selectedMapId),
                selectedMapId == null ? 0L : selectedMapId.value(),
                reachableLevels,
                false,
                statusTextFor(safeControls, mapEntries),
                viewMode.name(),
                DungeonEditorPreparedFrameFacts.labelForViewMode(viewMode.name()),
                overlaySettings,
                DungeonEditorPreparedFrameFacts.OverlayFrame.from(overlaySettings),
                projectionLevel,
                selectedTool.name(),
                DungeonEditorToolFrameLabels.labelFor(selectedTool));
    }

    private static DungeonEditorPreparedFrameFacts.MapEntry toMapEntry(DungeonMapSummary summary) {
        DungeonMapSummary safeSummary = summary == null
                ? new DungeonMapSummary(new DungeonMapId(1L), "Dungeon Map", 0L)
                : summary;
        return new DungeonEditorPreparedFrameFacts.MapEntry(
                keyOf(safeSummary.mapId()),
                safeSummary.mapId() == null ? 0L : safeSummary.mapId().value(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    private static String keyOf(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    private static int clampProjectionLevel(java.util.List<Integer> reachableLevels, int projectionLevel) {
        if (reachableLevels == null || reachableLevels.isEmpty()) {
            return Math.max(0, projectionLevel);
        }
        return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
    }

    private static String statusTextFor(
            DungeonEditorControlsSnapshot controls,
            java.util.List<DungeonEditorPreparedFrameFacts.MapEntry> mapEntries
    ) {
        if (controls.surfaceLoaded()) {
            return controls.statusText();
        }
        if (mapEntries.isEmpty()) {
            return "Keine Dungeon-Maps vorhanden.";
        }
        if (controls.selectedMapId() == null) {
            return "Kein Dungeon ausgewählt.";
        }
        return controls.statusText();
    }

}
