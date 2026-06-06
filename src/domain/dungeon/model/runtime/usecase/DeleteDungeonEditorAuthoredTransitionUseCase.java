package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase;

public final class DeleteDungeonEditorAuthoredTransitionUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public DeleteDungeonEditorAuthoredTransitionUseCase(
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            ApplyDungeonEditorOperationUseCase operationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
    }

    public boolean execute(MapId mapId, long transitionId) {
        if (mapId == null || transitionId <= NO_TRANSITION_ID) {
            return false;
        }
        DungeonMapIdentity domainMapId = domainMapId(mapId);
        if (!loadDungeonMapUseCase.execute(domainMapId).canDeleteTransition(transitionId)) {
            return false;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId,
                current -> current.deleteTransition(transitionId));
        publishMutationUseCase.execute(result);
        return true;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
