package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.PublishDungeonEditorAuthoredMutationUseCase;

public final class CreateDungeonEditorAuthoredStairUseCase {

    private final ApplyDungeonEditorOperationUseCase operationUseCase;
    private final LoadDungeonMapUseCase loadDungeonMapUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;
    private final DungeonMapRepository repository;

    public CreateDungeonEditorAuthoredStairUseCase(
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

    public void execute(MapId mapId, Cell anchor, String shapeName) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(anchor, "anchor");
        long stairId = repository.nextStairId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.createStair(stairId, anchor, shapeName));
        publishMutationUseCase.execute(result);
    }

    public boolean canExecute(MapId mapId, Cell anchor, String shapeName) {
        return mapId != null
                && anchor != null
                && loadDungeonMapUseCase.execute(domainMapId(mapId)).canCreateStair(anchor, shapeName);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
