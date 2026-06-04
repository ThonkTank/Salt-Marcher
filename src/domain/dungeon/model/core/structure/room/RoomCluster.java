package src.domain.dungeon.model.core.structure.room;

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
        RoomClusterFloorMap floorMap,
        RoomClusterWallMap wallMap
) {
    public RoomCluster(long clusterId, long mapId, Cell center, Map<Integer, List<Cell>> cellsByLevel) {
        this(clusterId, mapId, center, new RoomClusterFloorMap(cellsByLevel), new RoomClusterWallMap(center, List.of()));
    }

    public RoomCluster(long clusterId, long mapId, Cell center, RoomClusterFloorMap floorMap) {
        this(clusterId, mapId, center, floorMap, new RoomClusterWallMap(center, List.of()));
    }

    public RoomCluster {
        clusterId = Math.max(0L, clusterId);
        mapId = Math.max(0L, mapId);
        center = center == null ? new Cell(0, 0, 0) : center;
        floorMap = floorMap == null ? new RoomClusterFloorMap(Map.of()) : floorMap;
        wallMap = wallMap == null ? new RoomClusterWallMap(center, List.of()) : wallMap;
    }

    public static RoomCluster fromCells(long clusterId, long mapId, Set<Cell> cells) {
        List<Cell> sortedCells = RoomClusterCells.sortedCells(cells);
        Cell resolvedCenter = sortedCells.isEmpty() ? new Cell(0, 0, 0) : sortedCells.getFirst();
        return new RoomCluster(clusterId, mapId, resolvedCenter, RoomClusterFloorMap.fromCells(sortedCells));
    }

    @Override
    public RoomClusterFloorMap floorMap() {
        return new RoomClusterFloorMap(floorMap.cellsByLevel());
    }

    public List<Cell> cellsAt(int level) {
        return floorMap.cellsAt(level);
    }

    public List<Cell> allCells() {
        return floorMap.allCells();
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return floorMap.cellsByLevel();
    }

    public RoomCluster withCellsByLevel(Map<Integer, ? extends Iterable<Cell>> nextCellsByLevel) {
        return new RoomCluster(
                clusterId,
                mapId,
                center,
                floorMap.replaceCellsByLevel(nextCellsByLevel).floorMap(),
                wallMap);
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
