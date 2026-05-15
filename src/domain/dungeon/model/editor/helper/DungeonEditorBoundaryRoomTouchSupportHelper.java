package src.domain.dungeon.model.editor.helper;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorBoundaryRoomTouchSupportHelper {

    private DungeonEditorBoundaryRoomTouchSupportHelper() {
    }

    static List<DungeonEditorWorkspaceValues.Cell> touchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        if (start.level() != end.level()) {
            return List.of();
        }
        if (start.r() == end.r()) {
            return horizontalTouchingCells(start, end);
        }
        if (start.q() == end.q()) {
            return verticalTouchingCells(start, end);
        }
        return List.of();
    }

    private static List<DungeonEditorWorkspaceValues.Cell> horizontalTouchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        int minQ = Math.min(start.q(), end.q());
        int maxQ = Math.max(start.q(), end.q());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int q = minQ; q < maxQ; q++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r() - 1, start.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(q, start.r(), start.level()));
        }
        return List.copyOf(result);
    }

    private static List<DungeonEditorWorkspaceValues.Cell> verticalTouchingCells(
            DungeonEditorWorkspaceValues.Cell start,
            DungeonEditorWorkspaceValues.Cell end
    ) {
        int minR = Math.min(start.r(), end.r());
        int maxR = Math.max(start.r(), end.r());
        List<DungeonEditorWorkspaceValues.Cell> result = new ArrayList<>();
        for (int r = minR; r < maxR; r++) {
            result.add(new DungeonEditorWorkspaceValues.Cell(start.q() - 1, r, start.level()));
            result.add(new DungeonEditorWorkspaceValues.Cell(start.q(), r, start.level()));
        }
        return List.copyOf(result);
    }
}
