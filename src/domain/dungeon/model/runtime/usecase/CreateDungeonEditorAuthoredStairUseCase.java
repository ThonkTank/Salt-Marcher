package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;

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

    public void execute(MapId mapId, StairGeometrySpec spec) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(spec, "spec");
        long stairId = repository.nextStairId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = operationUseCase.execute(
                domainMapId(mapId),
                current -> current.createStair(
                        stairId,
                        spec.anchor(),
                        spec.shape().name(),
                        spec.direction().name(),
                        spec.dimension1(),
                        spec.dimension2()));
        publishMutationUseCase.execute(result);
    }

    public boolean canExecute(MapId mapId, StairGeometrySpec spec) {
        return mapId != null
                && spec != null
                && loadDungeonMapUseCase.execute(domainMapId(mapId)).canCreateStair(
                        spec.anchor(),
                        spec.shape().name(),
                        spec.direction().name(),
                        spec.dimension1(),
                        spec.dimension2());
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
