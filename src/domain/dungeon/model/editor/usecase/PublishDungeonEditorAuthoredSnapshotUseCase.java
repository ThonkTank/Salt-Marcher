package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredPublicationProjectionHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorAuthoredPublicationProjectionHelper.SnapshotPublication;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.LoadDungeonSnapshotUseCase;

public final class PublishDungeonEditorAuthoredSnapshotUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public PublishDungeonEditorAuthoredSnapshotUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(LoadDungeonSnapshotUseCase.DungeonSnapshotData snapshot) {
        SnapshotPublication publication = publication(snapshot);
        state.replaceSnapshot(publication == null
                ? null
                : DungeonEditorAuthoredPublicationProjectionHelper.stateFacts(publication));
        if (publication != null) {
            publishedStateRepository.publishSnapshot(repositoryPublication(publication));
        }
    }

    private static @Nullable SnapshotPublication publication(
            LoadDungeonSnapshotUseCase.@Nullable DungeonSnapshotData snapshot
    ) {
        if (snapshot == null) {
            return null;
        }
        return DungeonEditorAuthoredPublicationProjectionHelper.snapshotPublication(
                snapshot.mapName(),
                snapshot.derived(),
                snapshot.editorHandles(),
                snapshot.revision());
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
}
