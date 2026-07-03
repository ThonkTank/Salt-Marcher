package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.repository.DungeonEditorSnapshotPublishedStateRepository;

public final class PublishDungeonEditorSnapshotUseCase {
    private final DungeonEditorSnapshotPublishedStateRepository publication;

    public PublishDungeonEditorSnapshotUseCase(DungeonEditorSnapshotPublishedStateRepository publication) {
        this.publication = Objects.requireNonNull(publication, "publication");
    }

    public void execute(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
        publication.publishEditorSnapshot(Objects.requireNonNull(snapshot, "snapshot"));
    }

    public void executeControls(DungeonEditorSessionSnapshot.ControlsData controls) {
        publication.publishEditorControls(Objects.requireNonNull(controls, "controls"));
    }

    public void executeSessionFrame(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
        publication.publishEditorSessionFrame(Objects.requireNonNull(frameData, "frameData"));
    }

    public void executeSessionFramePreservingSurface(DungeonEditorSessionSnapshot.SessionFrameData frameData) {
        publication.publishEditorSessionFramePreservingSurface(Objects.requireNonNull(frameData, "frameData"));
    }
}
