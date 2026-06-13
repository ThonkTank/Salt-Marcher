package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.geometry.Edge;
import src.domain.dungeon.model.core.geometry.EdgeKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

public record DungeonRoomCluster(
        long clusterId,
        long mapId,
        String name,
        Cell center,
        Map<Integer, List<Cell>> relativeVerticesByLevel,
        RoomClusterFloorMap floorMap,
        Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
) {
    public DungeonRoomCluster(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            Map<Integer, List<Cell>> relativeVerticesByLevel,
            RoomClusterFloorMap floorMap,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
        this.name = defaultName(clusterId, name);
        this.center = center == null ? new Cell(0, 0, 0) : center;
        this.relativeVerticesByLevel = copyNestedLists(relativeVerticesByLevel);
        this.floorMap = floorMap == null
                ? new RoomClusterFloorMap(Map.of())
                : new RoomClusterFloorMap(floorMap.cellsByLevel());
        this.boundariesByLevel = copyNestedLists(boundariesByLevel);
    }

    @Override
    public Map<Integer, List<Cell>> relativeVerticesByLevel() {
        return copyNestedLists(relativeVerticesByLevel);
    }

    @Override
    public Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel() {
        return copyNestedLists(boundariesByLevel);
    }

    @Override
    public RoomClusterFloorMap floorMap() {
        return new RoomClusterFloorMap(floorMap.cellsByLevel());
    }

    public Map<Integer, List<Cell>> cellsByLevel() {
        return floorMap.cellsByLevel();
    }

    public Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap() {
        return boundarySnapshot().boundaryMap();
    }

    public List<DungeonClusterBoundary> orderedAuthoredBoundaries() {
        return boundarySnapshot().orderedBoundaries();
    }

    public DungeonClusterBoundary boundaryAt(Edge edge) {
        if (edge == null) {
            return null;
        }
        for (DungeonClusterBoundary boundary : boundarySnapshot().orderedBoundaries()) {
            if (boundary.matchesAbsoluteEdge(center, edge)) {
                return boundary;
            }
        }
        return null;
    }

    public Set<Integer> boundaryLevels() {
        return boundarySnapshot().boundaryLevels();
    }

    public Map<Integer, List<Edge>> closedBoundaryEdgesByLevel() {
        return boundarySnapshot().closedBoundaryEdgesByLevel();
    }

    public RoomCluster toCore(Map<Integer, List<Cell>> cellsByLevel) {
        Map<Integer, List<Cell>> copiedCellsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            copiedCellsByLevel.put(entry.getKey(), copiedCells(entry.getValue()));
        }
        return new RoomCluster(clusterId, mapId, center, new RoomClusterFloorMap(copiedCellsByLevel));
    }

    public List<Cell> authoredBoundaryVertices(int level) {
        return boundarySnapshot().authoredBoundaryVertices(level);
    }

    public List<WallRun> authoredWallRuns(int level) {
        return boundarySnapshot().authoredWallRuns(level);
    }

    public List<DungeonClusterBoundary> orderedBoundariesForWriteback() {
        return boundarySnapshot().orderedBoundaries();
    }

    List<EdgeKey> adjacentWallRunEdgeKeys(Cell corner, boolean vertical) {
        return boundarySnapshot().adjacentWallRunEdgeKeys(corner, vertical);
    }

    public static DungeonRoomCluster fromCore(
            RoomCluster cluster,
            Map<Integer, List<Cell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                cluster.clusterId(),
                cluster.mapId(),
                "",
                cluster.center(),
                relativeVerticesByLevel,
                cluster.floorMap(),
                boundariesByLevel);
    }

    public DungeonRoomCluster withName(String nextName) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                nextName,
                center,
                relativeVerticesByLevel,
                floorMap,
                boundariesByLevel);
    }

    private static List<Cell> copiedCells(List<Cell> cells) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : cells == null ? List.<Cell>of() : cells) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    private static <T> Map<Integer, List<T>> copyNestedLists(Map<Integer, List<T>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Integer, List<T>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<T>> entry : source.entrySet()) {
            if (entry.getKey() != null && entry.getValue() != null) {
                result.put(entry.getKey(), List.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }

    private RoomClusterBoundarySnapshot boundarySnapshot() {
        return new RoomClusterBoundarySnapshot(center, boundariesByLevel);
    }

    private static String defaultName(long clusterId, String name) {
        return name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
    }
}
