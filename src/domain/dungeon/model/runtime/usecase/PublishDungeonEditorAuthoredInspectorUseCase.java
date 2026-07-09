package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonEditorAuthoredInspectorUseCase {

    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public PublishDungeonEditorAuthoredInspectorUseCase(
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(LoadDungeonSnapshotUseCase.InspectorSnapshotData inspector) {
        state.replaceInspector(DungeonInspectorWorkspaceMapper.inspectorFacts(inspector));
        DungeonAuthoredPublishedStateRepository.InspectorPublication publication =
                DungeonInspectorPublicationMapper.inspectorPublication(inspector);
        if (publication != null) {
            publishedStateRepository.publishInspector(publication);
        }
    }
}
