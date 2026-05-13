package src.domain.dungeon.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapId;

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
            @Nullable DungeonMapId mapId,
            @Nullable DungeonEditorOperation operation
    ) {
        publishedStateRepository.publishAuthoredMutation(
                applyDungeonEditorOperationUseCase.execute(mapIdentity(mapId), operation));
    }

    public void preview(
            @Nullable DungeonMapId mapId,
            @Nullable DungeonEditorOperation operation
    ) {
        publishedStateRepository.publishAuthoredMutation(
                applyDungeonEditorOperationUseCase.preview(mapIdentity(mapId), operation));
    }

    private static DungeonMapIdentity mapIdentity(@Nullable DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
