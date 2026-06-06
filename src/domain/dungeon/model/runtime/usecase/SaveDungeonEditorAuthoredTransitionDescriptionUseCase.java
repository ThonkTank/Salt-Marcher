package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase;

public final class SaveDungeonEditorAuthoredTransitionDescriptionUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public SaveDungeonEditorAuthoredTransitionDescriptionUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public void execute(MapId mapId, long transitionId, String description) {
        if (mapId == null || transitionId <= NO_TRANSITION_ID) {
            return;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.saveTransitionDescription(transitionId, description));
        publishMutationUseCase.execute(result);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
