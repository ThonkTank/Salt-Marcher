package src.features.dungeon.runtime;

import java.util.Objects;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import src.domain.dungeon.DungeonEditorRuntimeApplicationService;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;

public record DungeonEditorRuntimeDependencies(
        CompatibilityReadbackModels compatibilityReadbackModels,
        DungeonEditorRuntimeApplicationService editorRuntimeApplicationService,
        ExecutionLane executionLane,
        UiDispatcher uiDispatcher
) {
    public DungeonEditorRuntimeDependencies(
            CompatibilityReadbackModels compatibilityReadbackModels,
            DungeonEditorRuntimeApplicationService editorRuntimeApplicationService
    ) {
        this(compatibilityReadbackModels, editorRuntimeApplicationService,
                DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE);
    }

    public DungeonEditorRuntimeDependencies {
        compatibilityReadbackModels =
                Objects.requireNonNull(compatibilityReadbackModels, "compatibilityReadbackModels");
        editorRuntimeApplicationService =
                Objects.requireNonNull(editorRuntimeApplicationService, "editorRuntimeApplicationService");
        executionLane = Objects.requireNonNull(executionLane, "executionLane");
        uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
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
