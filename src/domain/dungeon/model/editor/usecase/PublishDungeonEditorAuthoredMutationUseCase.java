package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredPublicationProjectionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredPublicationProjectionHelper.SnapshotPublication;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonEditorOperationUseCase;

public final class PublishDungeonEditorAuthoredMutationUseCase {
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public PublishDungeonEditorAuthoredMutationUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(ApplyDungeonEditorOperationUseCase.OperationResultData mutation) {
        SnapshotPublication snapshotPublication = publication(mutation);
        state.replaceMutation(mutationFacts(mutation, snapshotPublication));
        DungeonAuthoredPublishedStateRepository.MutationPublication publication =
                mutationPublication(mutation, snapshotPublication);
        if (publication != null) {
            publishedStateRepository.publishMutation(publication);
        }
    }

    private DungeonEditorDungeonState.@Nullable MutationFacts mutationFacts(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            @Nullable SnapshotPublication snapshotPublication
    ) {
        DungeonEditorDungeonState.SnapshotFacts snapshot = snapshotPublication == null
                ? null
                : DungeonEditorAuthoredPublicationProjectionHelper.stateFacts(snapshotPublication);
        return snapshot == null ? null : new DungeonEditorDungeonState.MutationFacts(snapshot, statusText(mutation));
    }

    private @Nullable SnapshotPublication publication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation
    ) {
        if (mutation == null || mutation.snapshot() == null) {
            return null;
        }
        return DungeonEditorAuthoredPublicationProjectionHelper.snapshotPublication(
                mutation.snapshot().mapName(),
                mutation.snapshot().derived(),
                mutation.snapshot().editorHandles(),
                mutation.snapshot().revision());
    }

    private DungeonAuthoredPublishedStateRepository.@Nullable MutationPublication mutationPublication(
            ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData mutation,
            @Nullable SnapshotPublication snapshotPublication
    ) {
        if (mutation == null || snapshotPublication == null) {
            return null;
        }
        return new DungeonAuthoredPublishedStateRepository.MutationPublication(
                repositoryPublication(snapshotPublication),
                mutation.validationMessages(),
                mutation.reactionMessages());
    }

    private static DungeonAuthoredPublishedStateRepository.SnapshotPublication repositoryPublication(
            SnapshotPublication publication
    ) {
        return new DungeonAuthoredPublishedStateRepository.SnapshotPublication(
                publication.mapName(),
                publication.derived(),
                publication.editorHandles(),
                publication.repositoryRevision());
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
