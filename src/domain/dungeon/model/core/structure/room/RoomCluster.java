package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public record RoomCluster(
        long clusterId,
        long mapId,
        Cell center,
        Map<Integer, List<Cell>> cellsByLevel
) {
    public RoomCluster {
        clusterId = Math.max(0L, clusterId);
        mapId = Math.max(0L, mapId);
        center = center == null ? new Cell(0, 0, 0) : center;
        cellsByLevel = copyCellsByLevel(cellsByLevel);
    }

    public static RoomCluster fromCells(long clusterId, long mapId, Set<Cell> cells) {
        List<Cell> sortedCells = RoomClusterCells.sortedCells(cells);
        Cell resolvedCenter = sortedCells.isEmpty() ? new Cell(0, 0, 0) : sortedCells.getFirst();
        return new RoomCluster(clusterId, mapId, resolvedCenter, cellsByLevel(sortedCells));
    }

    @Override
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

    public RoomCluster withCellsByLevel(Map<Integer, List<Cell>> nextCellsByLevel) {
        return new RoomCluster(clusterId, mapId, center, nextCellsByLevel);
    }

    public List<Edge> boundingSideEdges(Cell corner, boolean vertical) {
        if (corner == null) {
            return List.of();
        }
        List<Cell> cells = cellsAt(corner.level());
        if (cells.isEmpty()) {
            return List.of();
        }
        Bounds bounds = Bounds.from(cells);
        return vertical
                ? bounds.verticalEdges(corner.q(), corner.level())
                : bounds.horizontalEdges(corner.r(), corner.level());
    }

    public static Map<Integer, List<Cell>> cellsByLevel(Iterable<Cell> cells) {
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
        return copyCellsByLevel(grouped);
    }

    private static Map<Integer, List<Cell>> copyCellsByLevel(Map<Integer, List<Cell>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<Cell>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), RoomClusterCells.sortedCells(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    private record Bounds(int minQ, int maxQ, int minR, int maxR) {
        private static Bounds from(List<Cell> cells) {
            Cell first = cells.getFirst();
            int minQ = first.q();
            int maxQ = first.q();
            int minR = first.r();
            int maxR = first.r();
            for (Cell cell : cells) {
                minQ = Math.min(minQ, cell.q());
                maxQ = Math.max(maxQ, cell.q());
                minR = Math.min(minR, cell.r());
                maxR = Math.max(maxR, cell.r());
            }
            return new Bounds(minQ, maxQ, minR, maxR);
        }

        private List<Edge> verticalEdges(int fixedQ, int level) {
            if (fixedQ != minQ && fixedQ != maxQ + 1) {
                return List.of();
            }
            Set<Edge> result = new LinkedHashSet<>();
            for (int r = minR; r <= maxR; r++) {
                result.add(new Edge(new Cell(fixedQ, r, level), new Cell(fixedQ, r + 1, level)));
            }
            return List.copyOf(result);
        }

        private List<Edge> horizontalEdges(int fixedR, int level) {
            if (fixedR != minR && fixedR != maxR + 1) {
                return List.of();
            }
            Set<Edge> result = new LinkedHashSet<>();
            for (int q = minQ; q <= maxQ; q++) {
                result.add(new Edge(new Cell(q, fixedR, level), new Cell(q + 1, fixedR, level)));
            }
            return List.copyOf(result);
        }
    }
}
