package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class SaveDungeonEditorAuthoredTransitionLinkUseCase {
    private static final long NO_TRANSITION_ID = 0L;
    private static final long NO_MAP_ID = 0L;

    private final ApplyDungeonEditorTransitionLinkOperationUseCase operationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredTransitionLinkUseCase(
            ApplyDungeonEditorTransitionLinkOperationUseCase operationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData execute(
            MapId sourceMapId,
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        if (sourceMapId == null || sourceTransitionId <= NO_TRANSITION_ID || targetMapId <= NO_MAP_ID
                || targetTransitionId <= NO_TRANSITION_ID) {
            return null;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                new DungeonMapIdentity(sourceMapId.value()),
                sourceTransitionId,
                new DungeonMapIdentity(targetMapId),
                targetTransitionId,
                bidirectional);
        if (result == null) {
            return null;
        }
        publishMutationUseCase.execute(result);
        return result;
    }
}
