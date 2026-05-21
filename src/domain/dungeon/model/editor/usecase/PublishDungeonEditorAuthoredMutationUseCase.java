package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class PublishDungeonEditorAuthoredMutationUseCase {
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final PublishDungeonEditorAuthoredSnapshotUseCase publishSnapshotUseCase;

    public PublishDungeonEditorAuthoredMutationUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state,
            PublishDungeonEditorAuthoredSnapshotUseCase publishSnapshotUseCase
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
        this.publishSnapshotUseCase = Objects.requireNonNull(publishSnapshotUseCase, "publishSnapshotUseCase");
    }

    public void execute(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        state.replaceMutation(mutationFacts(mutation));
        DungeonAuthoredPublishedStateRepository.MutationPublication publication = mutationPublication(mutation);
        if (publication != null) {
            publishedStateRepository.publishMutation(publication);
        }
    }

    private DungeonEditorDungeonState.@Nullable MutationFacts mutationFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        DungeonEditorDungeonState.SnapshotFacts snapshot =
                mutation == null ? null : publishSnapshotUseCase.snapshotFacts(mutation.snapshot());
        return snapshot == null ? null : new DungeonEditorDungeonState.MutationFacts(snapshot, statusText(mutation));
    }

    private DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        if (mutation == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.MutationPublication(
                publishSnapshotUseCase.snapshotPublication(mutation.snapshot()),
                mutation.validationMessages(),
                mutation.reactionMessages());
    }

    private static String statusText(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        if (!mutation.reactionMessages().isEmpty()) {
            return mutation.reactionMessages().getFirst();
        }
        if (!mutation.validationMessages().isEmpty()) {
            return mutation.validationMessages().getFirst();
        }
        return "";
    }
}
