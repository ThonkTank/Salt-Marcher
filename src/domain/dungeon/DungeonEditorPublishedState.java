package src.domain.dungeon;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.shared.published.PublishedState;

final class DungeonEditorPublishedState {

    private final PublishedState<DungeonEditorControlsSnapshot> controls =
            PublishedState.retainingDuplicateSubscribers(DungeonEditorControlsSnapshot.empty(""));
    private final PublishedState<DungeonEditorMapSurfaceSnapshot> mapSurface =
            PublishedState.retainingDuplicateSubscribers(DungeonEditorMapSurfaceSnapshot.empty());
    private final PublishedState<DungeonEditorStateSnapshot> state =
            PublishedState.retainingDuplicateSubscribers(DungeonEditorStateSnapshot.empty(""));
    private final DungeonEditorControlsModel controlsModel =
            new DungeonEditorControlsModel(controls::current, controls::subscribe);
    private final DungeonEditorMapSurfaceModel mapSurfaceModel =
            new DungeonEditorMapSurfaceModel(mapSurface::current, mapSurface::subscribe);
    private final DungeonEditorStateModel stateModel =
            new DungeonEditorStateModel(state::current, state::subscribe);

    DungeonEditorControlsModel controlsModel() {
        return controlsModel;
    }

    DungeonEditorMapSurfaceModel mapSurfaceModel() {
        return mapSurfaceModel;
    }

    DungeonEditorStateModel stateModel() {
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
