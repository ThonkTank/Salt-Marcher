package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.repository.DungeonEditorAuthoredSnapshotPublicationRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class PublishDungeonEditorAuthoredSnapshotUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredSnapshotPublicationRepository snapshotPublicationRepository;

    public PublishDungeonEditorAuthoredSnapshotUseCase(
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

    public void execute(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        DungeonEditorAuthoredSnapshotPublicationRepository.SnapshotPublicationData publication =
                snapshotPublicationRepository.publication(
                        snapshot.mapName(),
                        snapshot.derived(),
                        snapshot.editorHandles(),
                        snapshot.revision());
        state.replaceSnapshot(publication.stateFacts());
        if (publication.repositoryPublication() != null) {
            publishedStateRepository.publishSnapshot(publication.repositoryPublication());
        }
    }
}
