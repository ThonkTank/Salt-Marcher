package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.published.DungeonEditorControlsModel;
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
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        return new DungeonEditorRuntimeReadbackFrameInputs(
                Objects.requireNonNull(controlsModel, "controlsModel").current(),
                Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel").current(),
                Objects.requireNonNull(stateModel, "stateModel").current());
    }
}
