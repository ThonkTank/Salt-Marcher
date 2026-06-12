package src.domain.dungeon.model.core.component.floor;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.CellOrdering;

final class FloorCellMaps {
    private FloorCellMaps() {
    }

    static Map<Integer, List<Cell>> copyCellsByLevel(Map<Integer, ? extends Iterable<Cell>> source) {
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
                result.put(level, sortedCells(cells));
            }
        }
        return Collections.unmodifiableMap(result);
    }

    static List<Cell> sortedCells(Iterable<Cell> cells) {
        List<Cell> filtered = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                filtered.add(cell);
            }
        }
        return CellOrdering.sortedCells(filtered);
    }

    static Cell centroid(List<Cell> cells, Cell fallback) {
        if (cells == null || cells.isEmpty()) {
            return fallback == null ? new Cell(0, 0, 0) : fallback;
        }
        long qTotal = 0L;
        long rTotal = 0L;
        int level = cells.getFirst().level();
        for (Cell cell : cells) {
            qTotal += cell.q();
            rTotal += cell.r();
        }
        int count = Math.max(1, cells.size());
        return new Cell(Math.round((float) qTotal / count), Math.round((float) rTotal / count), level);
    }
}
