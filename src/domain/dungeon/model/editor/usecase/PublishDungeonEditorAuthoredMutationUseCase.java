package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonEditorAuthoredSnapshotPublicationRepository;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class PublishDungeonEditorAuthoredMutationUseCase {
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredSnapshotPublicationRepository snapshotPublicationRepository;

    public PublishDungeonEditorAuthoredMutationUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state,
            DungeonEditorAuthoredSnapshotPublicationRepository snapshotPublicationRepository
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
        this.snapshotPublicationRepository =
                Objects.requireNonNull(snapshotPublicationRepository, "snapshotPublicationRepository");
    }

    public void execute(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        DungeonEditorAuthoredSnapshotPublicationRepository.SnapshotPublicationData snapshotPublication =
                publication(mutation);
        state.replaceMutation(mutationFacts(mutation, snapshotPublication));
        DungeonAuthoredPublishedStateRepository.MutationPublication publication =
                mutationPublication(mutation, snapshotPublication);
        if (publication != null) {
            publishedStateRepository.publishMutation(publication);
        }
    }

    private DungeonEditorDungeonState.@Nullable MutationFacts mutationFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            DungeonEditorAuthoredSnapshotPublicationRepository.@Nullable SnapshotPublicationData snapshotPublication
    ) {
        DungeonEditorDungeonState.SnapshotFacts snapshot =
                snapshotPublication == null ? null : snapshotPublication.stateFacts();
        return snapshot == null ? null : new DungeonEditorDungeonState.MutationFacts(snapshot, statusText(mutation));
    }

    private DungeonEditorAuthoredSnapshotPublicationRepository.@Nullable SnapshotPublicationData publication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        if (mutation == null || mutation.snapshot() == null) {
            return null;
        }
        return snapshotPublicationRepository.publication(
                mutation.snapshot().mapName(),
                mutation.snapshot().derived(),
                mutation.snapshot().editorHandles(),
                mutation.snapshot().revision());
    }

    private DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            DungeonEditorAuthoredSnapshotPublicationRepository.@Nullable SnapshotPublicationData snapshotPublication
    ) {
        if (mutation == null || snapshotPublication == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.MutationPublication(
                snapshotPublication.repositoryPublication(),
                mutation.validationMessages(),
                mutation.reactionMessages());
    }

    private static String statusText(ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation) {
        if (mutation == null) {
            return "";
        }
        if (!mutation.reactionMessages().isEmpty()) {
            return mutation.reactionMessages().getFirst();
        }
        if (!mutation.validationMessages().isEmpty()) {
            return mutation.validationMessages().getFirst();
        }
        return "";
    }
}
