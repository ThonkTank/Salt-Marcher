package src.domain.dungeon.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;

public final class ApplyDungeonAuthoredMutationUseCase {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;

    public ApplyDungeonAuthoredMutationUseCase(
            ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        this.applyDungeonEditorOperationUseCase =
                Objects.requireNonNull(applyDungeonEditorOperationUseCase, "applyDungeonEditorOperationUseCase");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void apply(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorOperationInstructionUseCase.Instruction operation
    ) {
        publishedStateRepository.publishAuthoredMutation(applyDungeonEditorOperationUseCase.execute(mapId, operation));
    }

    public void preview(
            @Nullable DungeonMapIdentity mapId,
            DungeonEditorOperationInstructionUseCase.Instruction operation
    ) {
        publishedStateRepository.publishAuthoredMutation(applyDungeonEditorOperationUseCase.preview(mapId, operation));
    }
}
