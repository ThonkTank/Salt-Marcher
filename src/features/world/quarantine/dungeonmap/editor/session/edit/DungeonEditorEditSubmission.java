package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingCapability;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

final class DungeonEditorEditSubmission {

    private final DungeonLoadingCapability loadingCapability;
    private final DungeonEditorEditResultCoordinator resultCoordinator;

    DungeonEditorEditSubmission(
            DungeonLoadingCapability loadingCapability,
            DungeonEditorEditResultCoordinator resultCoordinator
    ) {
        this.loadingCapability = Objects.requireNonNull(loadingCapability, "loadingCapability");
        this.resultCoordinator = Objects.requireNonNull(resultCoordinator, "resultCoordinator");
    }

    void submit(
            String action,
            DungeonEditorEditCommand command,
            Function<features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult, DungeonEditorSessionEditOutcome> outcomeMapper
    ) {
        if (command == null) {
            return;
        }
        submit(
                action,
                (onSuccess, onError) -> loadingCapability.submitEdit(command, onSuccess, onError),
                outcomeMapper);
    }

    void submit(
            String action,
            EditCall call,
            Function<features.world.quarantine.dungeonmap.layout.model.DungeonLayoutEditResult, DungeonEditorSessionEditOutcome> outcomeMapper
    ) {
        if (!loadingCapability.editingEnabled() || loadingCapability.activeEditSessionId() == null || call == null) {
            return;
        }
        call.run(
                result -> resultCoordinator.apply(result == null ? null : outcomeMapper.apply(result)),
                throwable -> resultCoordinator.handleFailure(action, throwable));
    }

    @FunctionalInterface
    interface EditCall {
        void run(Consumer<DungeonLayoutEditResult> onSuccess, Consumer<Throwable> onError);
    }
}
