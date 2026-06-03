package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.worldspace.usecase.DungeonEditorAuthoredPublicationUseCase.Publication;

public final class PublishDungeonEditorAuthoredMutationUseCase {
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredPublicationUseCase publicationUseCase;

    public PublishDungeonEditorAuthoredMutationUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
        publicationUseCase = new DungeonEditorAuthoredPublicationUseCase();
    }

    public void execute(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        Publication snapshotPublication = publication(mutation);
        state.replaceMutation(mutationFacts(mutation, snapshotPublication));
        DungeonAuthoredPublishedStateRepository.MutationPublication mutationPublication =
                mutationPublication(mutation, snapshotPublication);
        if (mutationPublication != null) {
            publishedStateRepository.publishMutation(mutationPublication);
        }
    }

    private DungeonEditorDungeonState.@Nullable MutationFacts mutationFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            @Nullable Publication publication
    ) {
        DungeonEditorDungeonState.SnapshotFacts snapshot = publication == null ? null : publication.stateFacts();
        return snapshot == null ? null : new DungeonEditorDungeonState.MutationFacts(snapshot, statusText(mutation));
    }

    private @Nullable Publication publication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        if (mutation == null || mutation.snapshot() == null) {
            return null;
        }
        return publicationUseCase.execute(
                mutation.snapshot().mapName(),
                mutation.snapshot().derived(),
                mutation.snapshot().editorHandles(),
                mutation.snapshot().revision());
    }

    private DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            @Nullable Publication publication
    ) {
        if (mutation == null || publication == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.MutationPublication(
                publication.repositoryPublication(),
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
