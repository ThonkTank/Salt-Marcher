package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

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

    public static DungeonEditorRoomNarrationInput empty() {
        return new DungeonEditorRoomNarrationInput(0L, "", List.of());
    }
}
