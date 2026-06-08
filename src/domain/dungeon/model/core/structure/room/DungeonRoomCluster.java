package src.domain.dungeon.model.core.structure.room;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.DungeonBoundaryKey;
import src.domain.dungeon.model.core.structure.room.RoomClusterBoundaryMaterialization.BoundaryRow;
import src.domain.dungeon.model.core.structure.room.RoomClusterWallMap.WallRun;

public record DungeonRoomCluster(
        long clusterId,
        long mapId,
        String name,
        Cell center,
        Map<Integer, List<Cell>> relativeVerticesByLevel,
        Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
) {
    public DungeonRoomCluster(
            long clusterId,
            long mapId,
            String name,
            Cell center,
            Map<Integer, List<Cell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
        this.name = defaultName(clusterId, name);
        this.center = center == null ? new Cell(0, 0, 0) : center;
        this.relativeVerticesByLevel = copyNestedLists(relativeVerticesByLevel);
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

    public Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaryMap() {
        return DungeonClusterBoundary.boundaryMap(center, flattenBoundaries());
    }

    public RoomCluster toCore(Map<Integer, List<Cell>> cellsByLevel) {
        Map<Integer, List<Cell>> copiedCellsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            copiedCellsByLevel.put(entry.getKey(), copiedCells(entry.getValue()));
        }
        return new RoomCluster(clusterId, mapId, center, copiedCellsByLevel);
    }

    public List<Cell> authoredBoundaryVertices(int level) {
        return wallMap().authoredBoundaryVertices(
                center,
                level,
                relativeVerticesByLevel().getOrDefault(level, List.of()));
    }

    public List<WallRun> authoredWallRuns(int level) {
        return wallMap().authoredWallRuns(level);
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
                boundariesByLevel);
    }

    public DungeonRoomCluster withName(String nextName) {
        return new DungeonRoomCluster(
                clusterId,
                mapId,
                nextName,
                center,
                relativeVerticesByLevel,
                boundariesByLevel);
    }

    private List<DungeonClusterBoundary> flattenBoundaries() {
        List<DungeonClusterBoundary> result = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries : boundariesByLevel().values()) {
            result.addAll(boundaries);
        }
        return List.copyOf(result);
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

    private RoomClusterWallMap wallMap() {
        List<BoundaryRow> rows = new ArrayList<>();
        for (List<DungeonClusterBoundary> boundaries : boundariesByLevel().values()) {
            for (DungeonClusterBoundary boundary : boundaries) {
                if (boundary != null) {
                    rows.add(boundary.toCoreRow());
                }
            }
        }
        return new RoomClusterWallMap(center, rows);
    }

    private static String defaultName(long clusterId, String name) {
        return name == null || name.isBlank() ? "Cluster " + clusterId : name.trim();
    }
}
