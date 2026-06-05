package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;

public final class CreateDungeonEditorAuthoredStairUseCase {

    private final ApplyDungeonAuthoredMutationUseCase mutationUseCase;
    private final PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase;
    private final DungeonMapRepository repository;

    public CreateDungeonEditorAuthoredStairUseCase(
            ApplyDungeonAuthoredMutationUseCase mutationUseCase,
            PublishDungeonEditorAuthoredMutationUseCase publishMutationUseCase,
            DungeonMapRepository repository
    ) {
        this.mutationUseCase = Objects.requireNonNull(mutationUseCase, "mutationUseCase");
        this.publishMutationUseCase = Objects.requireNonNull(publishMutationUseCase, "publishMutationUseCase");
        this.repository = Objects.requireNonNull(repository, "repository");
    }

    public void execute(MapId mapId, Cell anchor, String shapeName) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(anchor, "anchor");
        long stairId = repository.nextStairId();
        ApplyDungeonEditorOperationUseCase.OperationResultData result = mutationUseCase.apply(
                domainMapId(mapId),
                current -> current.createStair(stairId, anchor, shapeName));
        publishMutationUseCase.execute(result);
    }

    boolean canExecute(MapId mapId, Cell anchor, String shapeName) {
        return mapId != null
                && anchor != null
                && mutationUseCase.canCreateStair(
                        domainMapId(mapId),
                        anchor,
                        shapeName);
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId.value());
    }
}
