package src.domain.dungeon.model.core.component.floor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import src.domain.dungeon.model.core.geometry.Cell;

public final class FloorCellMap {
    private final Map<Integer, List<Cell>> cellsByLevel;

    public FloorCellMap(Map<Integer, ? extends Iterable<Cell>> cellsByLevel) {
        this.cellsByLevel = FloorCellMaps.copyCellsByLevel(cellsByLevel);
    }

    public static FloorCellMap fromCells(Iterable<Cell> cells) {
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
        return new FloorCellMap(grouped);
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return FloorCellMaps.copyCellsByLevel(cellsByLevel);
    }

    public List<Cell> cellsAt(int level) {
        return cellsByLevel.getOrDefault(level, List.of());
    }

    public List<Cell> allCells() {
        List<Cell> result = new ArrayList<>();
        for (List<Cell> cells : cellsByLevel.values()) {
            result.addAll(cells);
        }
        return FloorCellMaps.sortedCells(result);
    }

    public Cell preferredCentroidOr(int preferredLevel, Cell fallback) {
        List<Cell> preferredCells = cellsByLevel.getOrDefault(preferredLevel, List.of());
        if (!preferredCells.isEmpty()) {
            return FloorCellMaps.centroid(preferredCells, fallback);
        }
        for (List<Cell> cells : cellsByLevel.values()) {
            if (!cells.isEmpty()) {
                return FloorCellMaps.centroid(cells, fallback);
            }
        }
        return fallback == null ? new Cell(0, 0, 0) : fallback;
    }

    public FloorMutation replaceCellsByLevel(Map<Integer, ? extends Iterable<Cell>> nextCellsByLevel) {
        FloorCellMap next = new FloorCellMap(nextCellsByLevel);
        return new FloorMutation(!cellsByLevel.equals(next.cellsByLevel), next);
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof FloorCellMap that
                && cellsByLevel.equals(that.cellsByLevel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cellsByLevel);
    }

    public record FloorMutation(boolean changed, FloorCellMap floorMap) {
        public FloorMutation {
            floorMap = floorMap == null ? new FloorCellMap(Map.of()) : floorMap;
        }

        @Override
        public FloorCellMap floorMap() {
            return new FloorCellMap(floorMap.cellsByLevel());
        }
    }
}
