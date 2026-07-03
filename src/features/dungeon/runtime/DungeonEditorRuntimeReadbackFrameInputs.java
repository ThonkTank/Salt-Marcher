package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

record DungeonEditorRuntimeReadbackFrameInputs(
        DungeonEditorControlsSnapshot controls,
        DungeonEditorMapSurfaceSnapshot mapSurface,
        DungeonEditorStateSnapshot state
) {
    static DungeonEditorRuntimeReadbackFrameInputs from(
            DungeonEditorStore store,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        return new DungeonEditorRuntimeReadbackFrameInputs(
                controlsSnapshotFromStore(store),
                Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel").current(),
                Objects.requireNonNull(stateModel, "stateModel").current());
    }

    private static DungeonEditorControlsSnapshot controlsSnapshotFromStore(DungeonEditorStore store) {
        DungeonEditorStoreState state = Objects.requireNonNull(store, "store").state();
        return new DungeonEditorControlsSnapshot(
                state.mapSummaries(),
                state.selectedMapId(),
                state.viewMode(),
                state.selectedTool(),
                state.projectionLevel(),
                state.overlaySettings(),
                state.reachableLevels(),
                state.surfaceLoaded(),
                state.statusText());
    }
}
