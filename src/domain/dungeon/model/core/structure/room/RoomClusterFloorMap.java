package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;

public final class RoomClusterFloorMap {
    private final Map<Integer, List<Cell>> cellsByLevel;

    public RoomClusterFloorMap(Map<Integer, ? extends Iterable<Cell>> cellsByLevel) {
        this.cellsByLevel = copyCellsByLevel(cellsByLevel);
    }

    public static RoomClusterFloorMap fromCells(Iterable<Cell> cells) {
        Map<Integer, List<Cell>> grouped = new LinkedHashMap<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell == null) {
                continue;
            }
            List<Cell> levelCells = grouped.get(cell.level());
            if (levelCells == null) {
                levelCells = new ArrayList<>();
                grouped.put(cell.level(), levelCells);
            }
            levelCells.add(cell);
        }
        return new RoomClusterFloorMap(grouped);
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return copyCellsByLevel(cellsByLevel);
    }

    public List<Cell> cellsAt(int level) {
        return cellsByLevel.getOrDefault(level, List.of());
    }

    public List<Cell> allCells() {
        List<Cell> result = new ArrayList<>();
        for (List<Cell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return RoomClusterCells.sortedCells(result);
    }

    public FloorMutation replaceCellsByLevel(Map<Integer, ? extends Iterable<Cell>> nextCellsByLevel) {
        RoomClusterFloorMap next = new RoomClusterFloorMap(nextCellsByLevel);
        return new FloorMutation(!cellsByLevel.equals(next.cellsByLevel), next);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof RoomClusterFloorMap that
                && cellsByLevel.equals(that.cellsByLevel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cellsByLevel);
    }

    private static Map<Integer, List<Cell>> copyCellsByLevel(Map<Integer, ? extends Iterable<Cell>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        List<Integer> levels = new ArrayList<>();
        for (Integer level : source.keySet()) {
            if (level != null) {
                levels.add(level);
            }
        }
        Collections.sort(levels);
        for (Integer level : levels) {
            Iterable<Cell> cells = source.get(level);
            if (cells != null) {
                result.put(level, RoomClusterCells.sortedCells(cells));
            }
        }
        return Collections.unmodifiableMap(result);
    }

    public record FloorMutation(boolean changed, RoomClusterFloorMap floorMap) {
        public FloorMutation {
            floorMap = floorMap == null ? new RoomClusterFloorMap(Map.of()) : floorMap;
        }

        @Override
        public RoomClusterFloorMap floorMap() {
            return new RoomClusterFloorMap(floorMap.cellsByLevel());
        }
    }
}
