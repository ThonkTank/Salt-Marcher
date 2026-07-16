package features.dungeon.domain.core.structure.room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;

final class RoomMutationCellMaps {

    private RoomMutationCellMaps() {
    }

    static List<Cell> cellsAt(DungeonRoomTopologyClusterWork work, int level) {
        return work.cellsByLevel().getOrDefault(level, List.of());
    }

    static boolean allLevelsEmpty(Map<Integer, List<Cell>> levels) {
        for (List<Cell> cells : levels.values()) {
            if (cells != null && !cells.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    static void appendCellsByLevel(Map<Integer, Set<Cell>> target, Map<Integer, List<Cell>> source) {
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            addCellsForLevel(target, entry.getKey(), entry.getValue());
        }
    }

    static void addCellsForLevel(Map<Integer, Set<Cell>> target, int level, Iterable<Cell> cells) {
        Set<Cell> levelCells = target.computeIfAbsent(level, ignored -> new LinkedHashSet<>());
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                levelCells.add(cell);
            }
        }
    }

    static Map<Integer, List<Cell>> sortedCellsByLevel(Map<Integer, Set<Cell>> grouped) {
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, Set<Cell>> entry : grouped.entrySet()) {
            result.put(entry.getKey(), RoomClusterCells.sortedCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }
}
