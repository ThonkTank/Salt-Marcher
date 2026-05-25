package src.domain.dungeon;

final class DungeonEditorPublishedStateServiceAssembly implements src.domain.dungeon.model.worldspace.usecase.DungeonEditorSnapshotPublication {

    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonEditorControlsSnapshot> controls =
            new DungeonPublishedChannelServiceAssembly<>(src.domain.dungeon.published.DungeonEditorControlsSnapshot.empty(""));
    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot> mapSurface =
            new DungeonPublishedChannelServiceAssembly<>(src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot.empty());
    private final DungeonPublishedChannelServiceAssembly<src.domain.dungeon.published.DungeonEditorStateSnapshot> state =
            new DungeonPublishedChannelServiceAssembly<>(src.domain.dungeon.published.DungeonEditorStateSnapshot.empty(""));
    final src.domain.dungeon.published.DungeonEditorControlsModel controlsModel =
            new src.domain.dungeon.published.DungeonEditorControlsModel(controls::current, controls::subscribe);
    final src.domain.dungeon.published.DungeonEditorMapSurfaceModel mapSurfaceModel =
            new src.domain.dungeon.published.DungeonEditorMapSurfaceModel(mapSurface::current, mapSurface::subscribe);
    final src.domain.dungeon.published.DungeonEditorStateModel stateModel =
            new src.domain.dungeon.published.DungeonEditorStateModel(state::current, state::subscribe);

    void registerModels(shell.api.ServiceRegistry.Builder services) {
        services.registerFactory(
                src.domain.dungeon.published.DungeonEditorControlsModel.class,
                registry -> controlsModel);
        services.registerFactory(
                src.domain.dungeon.published.DungeonEditorMapSurfaceModel.class,
                registry -> mapSurfaceModel);
        services.registerFactory(
                src.domain.dungeon.published.DungeonEditorStateModel.class,
                registry -> stateModel);
    }

    @Override
    public void publishEditorSnapshot(src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot.SnapshotData safeSnapshot =
                snapshot == null ? src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot.empty("") : snapshot;
        DungeonEditorSurfaceContextServiceAssembly.SurfaceContext surfaceContext =
                DungeonEditorSurfaceContextServiceAssembly.surfaceContext(safeSnapshot.surface(), safeSnapshot.projectionLevel());
        controls.publish(DungeonEditorControlsProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext));
        mapSurface.publish(DungeonEditorMapSurfaceProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
        state.publish(DungeonEditorStateProjectionServiceAssembly.snapshot(safeSnapshot, surfaceContext.surface()));
    }
}
