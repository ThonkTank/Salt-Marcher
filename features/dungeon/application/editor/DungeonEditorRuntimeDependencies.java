package features.dungeon.application.editor;

import java.util.Objects;
import java.util.function.LongSupplier;
import platform.execution.ExecutionLane;
import platform.execution.DirectExecutionLane;
import platform.ui.UiDispatcher;
import platform.ui.DirectUiDispatcher;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.OrthogonalCorridorRoutingPolicy;

public record DungeonEditorRuntimeDependencies(
        DungeonEditorRuntimeApplicationService editorRuntimeApplicationService,
        CorridorRoutingPolicy corridorRoutingPolicy,
        LongSupplier requestGeneration,
        ExecutionLane executionLane,
        UiDispatcher uiDispatcher
) {
    public DungeonEditorRuntimeDependencies(
            DungeonEditorRuntimeApplicationService editorRuntimeApplicationService
    ) {
        this(editorRuntimeApplicationService,
                new OrthogonalCorridorRoutingPolicy(),
                () -> 0L,
                DirectExecutionLane.INSTANCE,
                DirectUiDispatcher.INSTANCE);
    }

    public DungeonEditorRuntimeDependencies(
            DungeonEditorRuntimeApplicationService editorRuntimeApplicationService,
            ExecutionLane executionLane,
            UiDispatcher uiDispatcher
    ) {
        this(editorRuntimeApplicationService,
                new OrthogonalCorridorRoutingPolicy(),
                () -> 0L,
                executionLane,
                uiDispatcher);
    }

    public DungeonEditorRuntimeDependencies {
        editorRuntimeApplicationService =
                Objects.requireNonNull(editorRuntimeApplicationService, "editorRuntimeApplicationService");
        corridorRoutingPolicy = Objects.requireNonNull(corridorRoutingPolicy, "corridorRoutingPolicy");
        requestGeneration = Objects.requireNonNull(requestGeneration, "requestGeneration");
        executionLane = Objects.requireNonNull(executionLane, "executionLane");
        uiDispatcher = Objects.requireNonNull(uiDispatcher, "uiDispatcher");
    }

}
