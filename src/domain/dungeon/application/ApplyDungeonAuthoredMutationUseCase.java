package src.domain.dungeon.application;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase.Mutation;
import src.domain.dungeon.model.map.helper.DungeonAuthoredPublishedProjectionHelper;
import src.domain.dungeon.model.map.helper.DungeonPublishedMapSnapshotProjectionHelper;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;

public final class ApplyDungeonAuthoredMutationUseCase {

    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final DungeonPublishedStateRepository publishedStateRepository;
    private final DungeonAuthoredPublishedProjectionHelper projectionHelper =
            new DungeonAuthoredPublishedProjectionHelper(new DungeonPublishedMapSnapshotProjectionHelper());

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
            @Nullable Mutation operation
    ) {
        publishedStateRepository.publishAuthoredMutation(
                mutation(applyDungeonEditorOperationUseCase.execute(mapId, operation)));
    }

    public void preview(
            @Nullable DungeonMapIdentity mapId,
            @Nullable Mutation operation
    ) {
        publishedStateRepository.publishAuthoredMutation(
                mutation(applyDungeonEditorOperationUseCase.preview(mapId, operation)));
    }

    private DungeonAuthoredMutationResult mutation(ApplyDungeonEditorOperationUseCase.OperationResultData result) {
        LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot = result.snapshot();
        return projectionHelper.mutation(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision(),
                result.validationMessages(),
                result.reactionMessages());
    }
}
