package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorSessionValues;

public interface DungeonEditorSnapshotPublication {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);

    void publishEditorToolSelection(DungeonEditorSessionValues.Tool selectedTool, String statusText);
}
