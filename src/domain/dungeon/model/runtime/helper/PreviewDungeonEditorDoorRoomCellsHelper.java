package src.domain.dungeon.model.runtime.helper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Area;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.Cell;

public final class PreviewDungeonEditorDoorRoomCellsHelper {

    public Map<Long, List<src.domain.dungeon.model.core.geometry.Cell>> cellsByRoom(List<Area> areas) {
        Map<Long, List<src.domain.dungeon.model.core.geometry.Cell>> result = new LinkedHashMap<>();
        for (Area area : areas) {
            if (area != null && area.kind().isRoom()) {
                List<src.domain.dungeon.model.core.geometry.Cell> roomCells = result.get(area.id());
                if (roomCells == null) {
                    roomCells = new ArrayList<>();
                    result.put(area.id(), roomCells);
                }
                roomCells.addAll(coreCells(area.cells()));
            }
        }
        Map<Long, List<src.domain.dungeon.model.core.geometry.Cell>> immutable = new LinkedHashMap<>();
        for (Map.Entry<Long, List<src.domain.dungeon.model.core.geometry.Cell>> entry : result.entrySet()) {
            immutable.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static List<src.domain.dungeon.model.core.geometry.Cell> coreCells(List<Cell> cells) {
        List<src.domain.dungeon.model.core.geometry.Cell> result = new ArrayList<>();
        for (Cell cell : cells) {
            if (cell != null) {
                result.add(coreCell(cell));
            }
        }
        return List.copyOf(result);
    }

    private static src.domain.dungeon.model.core.geometry.Cell coreCell(Cell cell) {
        return new src.domain.dungeon.model.core.geometry.Cell(cell.q(), cell.r(), cell.level());
    }
}
