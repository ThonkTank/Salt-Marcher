package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.model.session.model.DungeonEditorSessionSnapshot;

public interface DungeonEditorSnapshotPublication {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);
}
