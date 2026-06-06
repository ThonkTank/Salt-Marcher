package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;

public final class CreateDungeonEditorAuthoredTransitionUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;
    private final DungeonMapRepository repository;

    public CreateDungeonEditorAuthoredTransitionUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase,
            DungeonMapRepository repository
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public void execute(MapId mapId, Cell anchor, TransitionDestination destination) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(anchor, "anchor");
        Objects.requireNonNull(destination, "destination");
        long transitionId = repository.nextTransitionId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                current -> current.createTransition(
                        transitionId,
                        anchor,
                        destination.isDungeonMap(),
                        destination.mapId(),
                        destination.tileId(),
                        destination.transitionId()));
        publishMutationUseCase.execute(result);
    }

    boolean canExecute(MapId mapId, Cell anchor, TransitionDestination destination) {
        return mapId != null
                && anchor != null
                && destination != null
                && mutationUseCase.canCreateTransition(domainMapId(mapId), anchor, destination);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
