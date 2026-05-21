package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.usecase.DungeonEditorAuthoredPublicationUseCase.Publication;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class PublishDungeonEditorAuthoredSnapshotUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;
    private final DungeonEditorAuthoredPublicationUseCase publicationUseCase;

    public PublishDungeonEditorAuthoredSnapshotUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
        publicationUseCase = new DungeonEditorAuthoredPublicationUseCase();
    }

    public void execute(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        Publication publication = publication(snapshot);
        state.replaceSnapshot(publication == null ? null : publication.stateFacts());
        if (publication != null) {
            publishedStateRepository.publishSnapshot(publication.repositoryPublication());
        }
    }

    private @Nullable Publication publication(
            LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
    ) {
        if (snapshot == null) {
            return null;
        }
        return publicationUseCase.execute(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision());
    }
}
