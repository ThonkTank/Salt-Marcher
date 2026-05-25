package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot;

public final class PublishDungeonEditorSnapshotUseCase {
    private final DungeonEditorSnapshotPublication publication;

    public PublishDungeonEditorSnapshotUseCase(DungeonEditorSnapshotPublication publication) {
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public void execute(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        publication.publishEditorSnapshot(Objects.requireNonNull(snapshot, "snapshot"));
    }
}
