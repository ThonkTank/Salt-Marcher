package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSession;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository.ToolSelectionPublication;

public final class PublishDungeonEditorSnapshotUseCase {
    private final DungeonEditorSnapshotPublishedStateRepository publication;

    public PublishDungeonEditorSnapshotUseCase(DungeonEditorSnapshotPublishedStateRepository publication) {
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public void execute(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        publication.publishEditorSnapshot(Objects.requireNonNull(snapshot, "snapshot"));
    }

    public void executeToolSelection(DungeonEditorSession session) {
        DungeonEditorSession safeSession = session == null ? DungeonEditorSession.empty() : session;
        publication.publishEditorToolSelection(new ToolSelectionPublication(
                safeSession.selectedTool().name(),
                safeSession.statusText()));
    }
}
