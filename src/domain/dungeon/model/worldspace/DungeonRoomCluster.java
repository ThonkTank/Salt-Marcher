package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomCluster;

public record DungeonRoomCluster(
        long clusterId,
        long mapId,
        Cell center,
        Map<Integer, List<Cell>> relativeVerticesByLevel,
        Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
) {
    public DungeonRoomCluster(
            long clusterId,
            long mapId,
            Cell center,
            Map<Integer, List<Cell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
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

    RoomCluster toCore(Map<Integer, List<Cell>> cellsByLevel) {
        Map<Integer, List<Cell>> copiedCellsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Cell>> entry : cellsByLevel.entrySet()) {
            copiedCellsByLevel.put(entry.getKey(), copiedCells(entry.getValue()));
        }
        return new RoomCluster(clusterId, mapId, center, copiedCellsByLevel);
    }

    static DungeonRoomCluster fromCore(
            RoomCluster cluster,
            Map<Integer, List<Cell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                cluster.clusterId(),
                cluster.mapId(),
                cluster.center(),
                relativeVerticesByLevel,
                boundariesByLevel);
    }

    private static List<Cell> copiedCells(List<Cell> cells) {
        List<Cell> result = new java.util.ArrayList<>();
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
}
