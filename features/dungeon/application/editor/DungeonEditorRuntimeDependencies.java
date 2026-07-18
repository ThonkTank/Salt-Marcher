package features.dungeon.application.editor;

import java.util.Objects;
import platform.execution.DirectExecutionLane;
import platform.execution.ExecutionLane;
import platform.ui.DirectUiDispatcher;
import platform.ui.UiDispatcher;
import features.dungeon.application.editor.DungeonEditorRuntimeApplicationService;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorStateModel;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;

public record DungeonEditorRuntimeDependencies(
        DungeonEditorControlsModel controlsModel,
        DungeonEditorMapSurfaceModel mapSurfaceModel,
        DungeonEditorStateModel stateModel,
        DungeonEditorRuntimeApplicationService editorRuntimeApplicationService,
        CorridorRoutingPolicy corridorRoutingPolicy,
        ExecutionLane executionLane,
        UiDispatcher uiDispatcher
) {
    public DungeonEditorRuntimeDependencies(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeApplicationService editorRuntimeApplicationService
    ) {
        this(controlsModel, mapSurfaceModel, stateModel, editorRuntimeApplicationService,
                new OrthogonalCorridorRoutingPolicy(),
                DirectExecutionLane.INSTANCE, DirectUiDispatcher.INSTANCE);
    }

    public DungeonEditorRuntimeDependencies(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorRuntimeApplicationService editorRuntimeApplicationService,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher
    ) {
        this(controlsModel, mapSurfaceModel, stateModel, editorRuntimeApplicationService,
                new OrthogonalCorridorRoutingPolicy(), executionLane, uiDispatcher);
    }

    public DungeonEditorRuntimeDependencies {
        controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        stateModel = Objects.requireNonNull(stateModel, "stateModel");
        editorRuntimeApplicationService =
                Objects.requireNonNull(editorRuntimeApplicationService, "editorRuntimeApplicationService");
        corridorRoutingPolicy = Objects.requireNonNull(corridorRoutingPolicy, "corridorRoutingPolicy");
        executionLane = Objects.requireNonNull(executionLane, "executionLane");
        uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
    }

}
