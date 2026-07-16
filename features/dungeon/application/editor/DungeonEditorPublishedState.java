package features.dungeon.application.editor;

import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorControlsSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonEditorStateSnapshot;
import platform.state.PublishedState;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;

public final class DungeonEditorPublishedState {

    private final PublishedState<DungeonEditorControlsSnapshot> controls;
    private final PublishedState<DungeonEditorMapSurfaceSnapshot> mapSurface;
    private final PublishedState<DungeonEditorStateSnapshot> state;
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;

    DungeonEditorPublishedState() {
        this(DirectUiDispatcher.INSTANCE);
    }

    public DungeonEditorPublishedState(UiDispatcher dispatcher) {
        controls = new PublishedState<>(DungeonEditorControlsSnapshot.empty(""), dispatcher);
        mapSurface = new PublishedState<>(DungeonEditorMapSurfaceSnapshot.empty(), dispatcher);
        state = new PublishedState<>(DungeonEditorStateSnapshot.empty(""), dispatcher);
        controlsModel = new DungeonEditorControlsModel(controls::current, controls::subscribe);
        mapSurfaceModel = new DungeonEditorMapSurfaceModel(mapSurface::current, mapSurface::subscribe);
        stateModel = new DungeonEditorStateModel(state::current, state::subscribe);
    }

    public DungeonEditorControlsModel controlsModel() {
        return controlsModel;
    }

    public DungeonEditorMapSurfaceModel mapSurfaceModel() {
        return mapSurfaceModel;
    }

    public DungeonEditorStateModel stateModel() {
        return stateModel;
    }

    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot =
                snapshot == null ? DungeonEditorSessionSnapshot.empty("") : snapshot;
        DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext =
                DungeonEditorSurfaceContextServiceAssembly.surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
    }

    void publishEditorControls(DungeonEditorSessionSnapshot.ControlsData controlsData) {
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(controlsData, controls.current()));
    }

    void publishEditorSessionFrame(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(
                safeFrameData.controlsData(),
                controls.current()));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(safeFrameData, mapSurface.current()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeFrameData, state.current()));
    }

    void publishEditorSessionFramePreservingSurface(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(
                safeFrameData.controlsData(),
                controls.current()));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshotPreservingSurface(
                safeFrameData,
                mapSurface.current()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeFrameData, state.current()));
    }
}
