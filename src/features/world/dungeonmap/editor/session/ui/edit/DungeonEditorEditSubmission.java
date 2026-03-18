package features.world.dungeonmap.editor.session.ui.edit;

import features.world.dungeonmap.editor.edit.application.DungeonEditorEditCommand;
import features.world.dungeonmap.editor.session.application.workflow.DungeonEditorSessionWorkflow;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.layout.model.DungeonLayoutEditResult;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

final class DungeonEditorEditSubmission {

    private final DungeonEditorSessionReadModel sessionReadModel;
    private final DungeonEditorSessionWorkflow workflow;
    private final DungeonEditorEditResultCoordinator resultCoordinator;

    DungeonEditorEditSubmission(
            DungeonEditorSessionReadModel sessionReadModel,
            DungeonEditorSessionWorkflow workflow,
            DungeonEditorEditResultCoordinator resultCoordinator
    ) {
        this.sessionReadModel = Objects.requireNonNull(sessionReadModel, "sessionReadModel");
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.resultCoordinator = Objects.requireNonNull(resultCoordinator, "resultCoordinator");
    }

    void submit(
            String action,
            DungeonEditorEditCommand command,
            Function<features.world.dungeonmap.layout.model.DungeonLayoutEditResult, DungeonEditorSessionEditOutcome> outcomeMapper
    ) {
        if (command == null) {
            return;
        }
        submit(
                action,
                (mapId, onSuccess, onError) -> workflow.submitEdit(mapId, command, onSuccess, onError),
                outcomeMapper);
    }

    void submit(
            String action,
            EditCall call,
            Function<features.world.dungeonmap.layout.model.DungeonLayoutEditResult, DungeonEditorSessionEditOutcome> outcomeMapper
    ) {
        Long mapId = sessionReadModel.activeEditSessionId();
        if (!sessionReadModel.editingEnabled() || mapId == null || call == null) {
            return;
        }
        call.run(
                mapId,
                result -> resultCoordinator.apply(result == null ? null : outcomeMapper.apply(result)),
                throwable -> resultCoordinator.handleFailure(action, throwable));
    }

    @FunctionalInterface
    interface EditCall {
        void run(long mapId, Consumer<DungeonLayoutEditResult> onSuccess, Consumer<Throwable> onError);
    }
}
