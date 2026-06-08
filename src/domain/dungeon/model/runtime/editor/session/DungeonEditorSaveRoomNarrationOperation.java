package src.domain.dungeon.model.runtime.editor.session;

import src.domain.dungeon.model.core.structure.room.DungeonRoomNarration;

public record DungeonEditorSaveRoomNarrationOperation(
        long roomId,
        DungeonRoomNarration narration
) implements DungeonEditorAuthoredOperation.Variant {
    public DungeonEditorSaveRoomNarrationOperation {
        roomId = Math.max(0L, roomId);
    }
}
