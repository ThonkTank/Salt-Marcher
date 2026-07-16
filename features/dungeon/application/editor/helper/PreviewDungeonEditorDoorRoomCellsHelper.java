package features.dungeon.application.editor.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Area;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.Cell;

public final class PreviewDungeonEditorDoorRoomCellsHelper {

    public Map<Long, List<features.dungeon.domain.core.geometry.Cell>> cellsByRoom(List<Area> areas) {
        Map<Long, List<features.dungeon.domain.core.geometry.Cell>> result = new LinkedHashMap<>();
        for (Area area : areas) {
            if (area != null && area.kind().isRoom()) {
                List<features.dungeon.domain.core.geometry.Cell> roomCells = result.get(area.id());
                if (roomCells == null) {
                    roomCells = new ArrayList<>();
                    result.put(area.id(), roomCells);
                }
                roomCells.addAll(coreCells(area.cells()));
            }
        }
        Map<Long, List<features.dungeon.domain.core.geometry.Cell>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Long, List<features.dungeon.domain.core.geometry.Cell>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static List<features.dungeon.domain.core.geometry.Cell> coreCells(List<Cell> cells) {
        List<features.dungeon.domain.core.geometry.Cell> result = new ArrayList<>();
        for (Cell cell : cells) {
            if (cell != null) {
                result.add(coreCell(cell));
            }
        }
        return List.copyOf(result);
    }

    private static features.dungeon.domain.core.geometry.Cell coreCell(Cell cell) {
        return new features.dungeon.domain.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }
}
