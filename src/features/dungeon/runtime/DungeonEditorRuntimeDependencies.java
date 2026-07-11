package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public record DungeonEditorRuntimeDependencies(
        CompatibilityReadbackModels compatibilityReadbackModels,
        DungeonEditorRuntimeApplicationService editorRuntimeApplicationService
) {
    public DungeonEditorRuntimeDependencies {
        compatibilityReadbackModels =
                Objects.requireNonNull(compatibilityReadbackModels, "compatibilityReadbackModels");
        editorRuntimeApplicationService =
                Objects.requireNonNull(editorRuntimeApplicationService, "editorRuntimeApplicationService");
    }

    public record CompatibilityReadbackModels(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
        public CompatibilityReadbackModels {
            controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
            mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
            stateModel = Objects.requireNonNull(stateModel, "stateModel");
        }
    }
}
