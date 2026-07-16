package features.dungeon.application.editor;

import java.util.Objects;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorControlsSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.api.DungeonEditorStateSnapshot;

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
