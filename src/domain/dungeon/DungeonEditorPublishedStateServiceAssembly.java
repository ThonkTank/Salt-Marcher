package src.domain.dungeon;

import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.worldspace.usecase.DungeonEditorSnapshotPublication;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;

final class DungeonEditorPublishedStateServiceAssembly implements DungeonEditorSnapshotPublication {

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
    public void publishEditorToolSelection(DungeonEditorSessionValues.Tool selectedTool, String statusText) {
        DungeonEditorTool publishedTool = DungeonEditorValueProjectionServiceAssembly.tool(selectedTool);
        String safeStatusText = statusText == null ? "" : statusText;
        controls.publish(controlsSnapshot(controls.current(), publishedTool, safeStatusText));
        mapSurface.publish(mapSurfaceSnapshot(mapSurface.current(), publishedTool));
        state.publish(stateSnapshot(state.current(), publishedTool, safeStatusText));
    }

    private static DungeonEditorControlsSnapshot controlsSnapshot(
            DungeonEditorControlsSnapshot current,
            DungeonEditorTool selectedTool,
            String statusText
    ) {
        DungeonEditorControlsSnapshot safeCurrent = current == null
                ? DungeonEditorControlsSnapshot.empty(statusText)
                : current;
        return new DungeonEditorControlsSnapshot(
                safeCurrent.maps(),
                safeCurrent.selectedMapId(),
                safeCurrent.viewMode(),
                selectedTool,
                safeCurrent.projectionLevel(),
                safeCurrent.overlaySettings(),
                safeCurrent.reachableLevels(),
                safeCurrent.surfaceLoaded(),
                statusText);
    }

    private static DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot(
            DungeonEditorMapSurfaceSnapshot current,
            DungeonEditorTool selectedTool
    ) {
        DungeonEditorMapSurfaceSnapshot safeCurrent = current == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : current;
        return new DungeonEditorMapSurfaceSnapshot(
                committedSurface(safeCurrent.surface()),
                safeCurrent.selection(),
                DungeonEditorPreview.none(),
                safeCurrent.viewMode(),
                safeCurrent.overlaySettings(),
                safeCurrent.projectionLevel(),
                selectedTool);
    }

    private static DungeonEditorSurface committedSurface(DungeonEditorSurface surface) {
        if (surface == null) {
            return null;
        }
        return new DungeonEditorSurface(
                surface.mapName(),
                surface.revision(),
                surface.map(),
                null,
                surface.inspector());
    }

    private static DungeonEditorStateSnapshot stateSnapshot(
            DungeonEditorStateSnapshot current,
            DungeonEditorTool selectedTool,
            String statusText
    ) {
        DungeonEditorStateSnapshot safeCurrent = current == null
                ? DungeonEditorStateSnapshot.empty(statusText)
                : current;
        return new DungeonEditorStateSnapshot(
                safeCurrent.selection(),
                safeCurrent.inspector(),
                DungeonEditorPreview.none(),
                statusText,
                safeCurrent.viewMode(),
                selectedTool,
                safeCurrent.overlaySettings(),
                safeCurrent.projectionLevel());
    }
}
