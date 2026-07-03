package src.domain.dungeon.model.runtime.repository;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;

public interface DungeonEditorSnapshotPublishedStateRepository {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);

    void publishEditorControls(DungeonEditorSessionSnapshot.ControlsData controls);

    void publishEditorSessionFrame(DungeonEditorSessionSnapshot.SessionFrameData frameData);

    void publishEditorSessionFramePreservingSurface(DungeonEditorSessionSnapshot.SessionFrameData frameData);
}
