package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;

public interface DungeonEditorSnapshotPublication {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);

    void publishEditorToolSelection(DungeonEditorSessionValues.Tool selectedTool, String statusText);
}
