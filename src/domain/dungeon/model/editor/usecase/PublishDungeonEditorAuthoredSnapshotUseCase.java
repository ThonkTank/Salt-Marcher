package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class PublishDungeonEditorAuthoredSnapshotUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final BuildDungeonEditorAuthoredSnapshotPublicationUseCase buildPublicationUseCase;

    public PublishDungeonEditorAuthoredSnapshotUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state,
            BuildDungeonEditorAuthoredSnapshotPublicationUseCase buildPublicationUseCase
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
        this.buildPublicationUseCase = Objects.requireNonNull(buildPublicationUseCase, "buildPublicationUseCase");
    }

    public void execute(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        BuildDungeonEditorAuthoredSnapshotPublicationUseCase.SnapshotPublicationData publication =
                buildPublicationUseCase.execute(snapshot);
        state.replaceSnapshot(publication.stateFacts());
        if (publication.repositoryPublication() != null) {
            publishedStateRepository.publishSnapshot(publication.repositoryPublication());
        }
    }
}
