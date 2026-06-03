package src.domain.dungeon.model.worldspace;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.room.RoomCluster;

public record DungeonRoomCluster(
        long clusterId,
        long mapId,
        DungeonCell center,
        Map<Integer, List<DungeonCell>> relativeVerticesByLevel,
        Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
) {
    public DungeonRoomCluster(
            long clusterId,
            long mapId,
            DungeonCell center,
            Map<Integer, List<DungeonCell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        this.clusterId = clusterId;
        this.mapId = mapId;
        this.center = center == null ? new DungeonCell(0, 0, 0) : center;
        this.relativeVerticesByLevel = copyNestedLists(relativeVerticesByLevel);
        this.boundariesByLevel = copyNestedLists(boundariesByLevel);
    }

    @Override
    public Map<Integer, List<DungeonCell>> relativeVerticesByLevel() {
        return copyNestedLists(relativeVerticesByLevel);
    }

    @Override
    public Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel() {
        return copyNestedLists(boundariesByLevel);
    }

    RoomCluster toCore(Map<Integer, List<DungeonCell>> cellsByLevel) {
        Map<Integer, List<Cell>> coreCellsByLevel = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<DungeonCell>> entry : cellsByLevel.entrySet()) {
            coreCellsByLevel.put(entry.getKey(), toCoreCells(entry.getValue()));
        }
        return new RoomCluster(clusterId, mapId, center.geometry(), coreCellsByLevel);
    }

    static DungeonRoomCluster fromCore(
            RoomCluster cluster,
            Map<Integer, List<DungeonCell>> relativeVerticesByLevel,
            Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel
    ) {
        return new DungeonRoomCluster(
                cluster.clusterId(),
                cluster.mapId(),
                DungeonCell.fromGeometry(cluster.center()),
                relativeVerticesByLevel,
                boundariesByLevel);
    }

    private static List<Cell> toCoreCells(List<DungeonCell> cells) {
        List<Cell> result = new java.util.ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null) {
                result.add(cell.geometry());
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
