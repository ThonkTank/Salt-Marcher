package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonClusterBoundary;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonRoomCluster {

    private final long clusterId;
    private final long mapId;
    private final DungeonCell center;
    private final Map<Integer, List<DungeonCell>> relativeVerticesByLevel;
    private final Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel;

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

    public long clusterId() {
        return clusterId;
    }

    public long mapId() {
        return mapId;
    }

    public DungeonCell center() {
        return center;
    }

    public Map<Integer, List<DungeonCell>> relativeVerticesByLevel() {
        return relativeVerticesByLevel;
    }

    public Map<Integer, List<DungeonClusterBoundary>> boundariesByLevel() {
        return boundariesByLevel;
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
