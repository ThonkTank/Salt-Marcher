package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;

public final class DeleteDungeonEditorAuthoredTransitionUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;

    public DeleteDungeonEditorAuthoredTransitionUseCase(
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase
    ) {
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
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
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId,
                current -> current.deleteTransition(transitionId));
        publishMutationUseCase.execute(result);
        return true;
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
