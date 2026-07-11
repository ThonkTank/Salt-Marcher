package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;

public record DungeonEditorRoomNarrationInput(
        long roomId,
        String visualDescription,
        List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
) {
    public DungeonEditorRoomNarrationInput {
        roomId = Math.max(0L, roomId);
        visualDescription = visualDescription == null ? "" : visualDescription;
        exits = exits == null ? List.of() : List.copyOf(exits);
    }
}
