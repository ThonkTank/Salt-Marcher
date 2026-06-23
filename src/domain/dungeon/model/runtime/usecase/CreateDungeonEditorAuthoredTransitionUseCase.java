package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;

public final class CreateDungeonEditorAuthoredTransitionUseCase {

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;
    private final DungeonMapRepository repository;

    public CreateDungeonEditorAuthoredTransitionUseCase(
            ApplyDungeonEditorOperationUseCase operationUseCase,
            LoadDungeonMapUseCase loadDungeonMapUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase,
            DungeonMapRepository repository
    ) {
        this.operationUseCase = Objects.requireNonNull(operationUseCase, "operationUseCase");
        this.loadDungeonMapUseCase = Objects.requireNonNull(loadDungeonMapUseCase, "loadDungeonMapUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public void execute(MapId mapId, Cell anchor, TransitionDestination destination) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(anchor, "anchor");
        Objects.requireNonNull(destination, "destination");
        long transitionId = repository.nextTransitionId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.withTransitionCatalog(current.transitionCatalog().withCreated(
                        transitionId,
                        current.metadata().mapId().value(),
                        anchor,
                        destination)));
        publishMutationUseCase.execute(result);
    }

    public boolean canExecute(MapId mapId, Cell anchor, TransitionDestination destination) {
        return mapId != null
                && anchor != null
                && destination != null
                && loadDungeonMapUseCase.execute(domainMapId(mapId)).transitionCatalog().canCreate(anchor, destination);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
