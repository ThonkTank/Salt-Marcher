package features.dungeon.application.editor.helper;

import java.util.List;
import java.util.ArrayList;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.structure.room.DungeonRoomExitDescription;
import features.dungeon.domain.core.structure.room.DungeonRoomNarration;
import features.dungeon.application.editor.session.DungeonEditorRoomNarrationInput;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceCoreGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;

public interface DungeonEditorAuthoredOperationHelper {

    static DungeonRoomNarration roomNarration(DungeonEditorRoomNarrationInput roomNarration) {
        return new DungeonRoomNarration(
                roomNarration.visualDescription(),
                roomExits(roomNarration.exits()));
    }

    static Cell cell(DungeonEditorWorkspaceValues.Cell cell) {
        DungeonEditorWorkspaceValues.Cell safeCell = cell == null
                ? DungeonEditorWorkspaceValues.Cell.empty()
                : cell;
        return DungeonEditorWorkspaceCoreGeometry.cell(safeCell);
    }

    private static List<DungeonRoomExitDescription> roomExits(
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits
    ) {
        List<DungeonRoomExitDescription> result = new ArrayList<>();
        for (DungeonEditorWorkspaceValues.RoomExitNarration exit : exits) {
            DungeonEditorWorkspaceValues.RoomExitNarration safeExit = exit == null
                    ? new DungeonEditorWorkspaceValues.RoomExitNarration(
                            "",
                            DungeonEditorWorkspaceValues.Cell.empty(),
                            "",
                            "")
                    : exit;
            result.add(new DungeonRoomExitDescription(
                    cell(safeExit.cell()),
                    Direction.parse(safeExit.direction()),
                    safeExit.description()));
        }
        return List.copyOf(result);
    }
}
