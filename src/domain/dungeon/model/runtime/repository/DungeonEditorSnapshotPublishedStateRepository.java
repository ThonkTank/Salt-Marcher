package src.domain.dungeon.model.runtime.repository;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;

public interface DungeonEditorSnapshotPublishedStateRepository {
    void publishEditorSnapshot(DungeonEditorSessionSnapshot.SnapshotData snapshot);

    void publishEditorToolSelection(ToolSelectionPublication publication);

    record ToolSelectionPublication(String selectedToolName, String statusText) {
        public ToolSelectionPublication {
            selectedToolName = selectedToolName == null ? "" : selectedToolName;
            statusText = statusText == null ? "" : statusText;
        }
    }
}
