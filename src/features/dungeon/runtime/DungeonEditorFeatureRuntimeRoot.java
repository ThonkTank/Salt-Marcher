package src.features.dungeon.runtime;

import java.util.Objects;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public final class DungeonEditorFeatureRuntimeRoot implements DungeonEditorRuntimeOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorRuntimeOperations operationOwner;
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
            DungeonEditorRuntimeOperations operationOwner
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
        operationOwner.applyPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination);
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
        return new DungeonEditorRenderFrame(
                controlsModel.current(),
                mapSurfaceModel.current(),
                stateModel.current());
    }
}
