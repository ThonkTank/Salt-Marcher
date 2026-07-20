package features.dungeon.domain.core.structure.corridor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import features.dungeon.domain.core.geometry.Cell;

public record CorridorHostCells(Map<Long, List<Cell>> cellsByCorridor) {
    public CorridorHostCells {
        cellsByCorridor = normalizedCellsByCorridor(cellsByCorridor);
    }

    public List<Cell> cellsFor(long corridorId) {
        return cellsByCorridor.getOrDefault(Math.max(0L, corridorId), List.of());
    }

    @Override
    public Map<Long, List<Cell>> cellsByCorridor() {
        return Map.copyOf(cellsByCorridor);
    }

    public Cell snapToHostCell(long corridorId, Cell desired) {
        return CorridorAnchorSnap.nearestHostCell(desired, cellsFor(corridorId));
    }

    private static Map<Long, List<Cell>> normalizedCellsByCorridor(Map<Long, List<Cell>> source) {
        Map<Long, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : source == null ? Map.<Long, List<Cell>>of().entrySet() : source.entrySet()) {
            Long key = entry.getKey();
            if (key == null) {
                continue;
            }
            long corridorId = Math.max(0L, key);
            List<Cell> cells = result.computeIfAbsent(corridorId, ignored -> new ArrayList<>());
            for (Cell cell : entry.getValue() == null ? List.<Cell>of() : entry.getValue()) {
                if (cell != null) {
                    cells.add(cell);
                }
            }
        }
        Map<Long, List<Cell>> copied = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Cell>> entry : result.entrySet()) {
            copied.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(copied);
    }
}
