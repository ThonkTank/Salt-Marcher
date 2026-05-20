package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;

public interface DungeonEditorSnapshotPublication {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);
}
