package src.domain.dungeon;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

final class DungeonEditorPublishedStateServiceAssembly implements DungeonEditorSnapshotPublishedStateRepository {

    private final DungeonPublishedChannelServiceAssembly<DungeonEditorControlsSnapshot> controls =
            new DungeonPublishedChannelServiceAssembly<>(DungeonEditorControlsSnapshot.empty(""));
    private final DungeonPublishedChannelServiceAssembly<DungeonEditorMapSurfaceSnapshot> mapSurface =
            new DungeonPublishedChannelServiceAssembly<>(DungeonEditorMapSurfaceSnapshot.empty());
    private final DungeonPublishedChannelServiceAssembly<DungeonEditorStateSnapshot> state =
            new DungeonPublishedChannelServiceAssembly<>(DungeonEditorStateSnapshot.empty(""));
    final DungeonEditorControlsModel controlsModel =
            new DungeonEditorControlsModel(controls::current, controls::subscribe);
    final DungeonEditorMapSurfaceModel mapSurfaceModel =
            new DungeonEditorMapSurfaceModel(mapSurface::current, mapSurface::subscribe);
    final DungeonEditorStateModel stateModel =
            new DungeonEditorStateModel(state::current, state::subscribe);

    void registerModels(shell.api.ServiceRegistry.Builder services) {
        services.registerFactory(
                DungeonEditorSnapshotPublishedStateRepository.class,
                registry -> this);
        services.registerFactory(
                DungeonEditorControlsModel.class,
                registry -> controlsModel);
        services.registerFactory(
                DungeonEditorMapSurfaceModel.class,
                registry -> mapSurfaceModel);
        services.registerFactory(
                DungeonEditorStateModel.class,
                registry -> stateModel);
    }

    @Override
    public void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        DungeonEditorSessionSnapshot.SnapshotData safeSnapshot =
                snapshot == null ? DungeonEditorSessionSnapshot.empty("") : snapshot;
        DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext =
                DungeonEditorSurfaceContextServiceAssembly.surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
    }

    @Override
    public void publishEditorControls(DungeonEditorSessionSnapshot.ControlsData controlsData) {
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(controlsData, controls.current()));
    }

    @Override
    public void publishEditorSessionFrame(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
        DungeonEditorSessionSnapshot.SessionFrameData safeFrameData =
                frameData == null ? DungeonEditorSessionSnapshot.sessionFrameData(null) : frameData;
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(
                safeFrameData.controlsData(),
                controls.current()));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(safeFrameData, mapSurface.current()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeFrameData, state.current()));
    }

    @Override
    public void publishEditorSessionFramePreservingSurface(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
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
