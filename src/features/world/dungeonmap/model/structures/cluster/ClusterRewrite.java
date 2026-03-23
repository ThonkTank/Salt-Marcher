package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record ClusterRewrite(
        Long targetClusterId,
        TileShape clusterShape,
        Point2i clusterCenter,
        List<Room> rooms,
        List<ClusterBoundaryWrite> persistedBoundaries,
        Set<Long> deletedRoomIds,
        Map<Long, Long> replacedRoomIds,
        Set<Long> mergedRoomIds,
        Set<Long> deletedClusterIds,
        Map<Long, List<Room>> splitFragmentsBySourceRoomId,
        boolean topologyChanged
) {
    public ClusterRewrite {
        rooms = rooms == null ? List.of() : List.copyOf(rooms);
        persistedBoundaries = persistedBoundaries == null ? List.of() : List.copyOf(persistedBoundaries);
        deletedRoomIds = deletedRoomIds == null ? Set.of() : Set.copyOf(deletedRoomIds);
        replacedRoomIds = replacedRoomIds == null ? Map.of() : Map.copyOf(replacedRoomIds);
        mergedRoomIds = mergedRoomIds == null ? Set.of() : Set.copyOf(mergedRoomIds);
        deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
        splitFragmentsBySourceRoomId = immutableRoomLists(splitFragmentsBySourceRoomId);
    }

    public boolean deletesCluster() {
        return targetClusterId != null && deletedClusterIds.contains(targetClusterId);
    }

    public boolean isNoOp() {
        return !topologyChanged
                && !deletesCluster()
                && deletedRoomIds.isEmpty()
                && replacedRoomIds.isEmpty()
                && mergedRoomIds.isEmpty()
                && deletedClusterIds.isEmpty();
    }

    public Set<Long> affectedClusterIds() {
        Set<Long> result = new LinkedHashSet<>(deletedClusterIds);
        if (targetClusterId != null) {
            result.add(targetClusterId);
        }
        return Set.copyOf(result);
    }

    public Set<Long> affectedRoomIds() {
        Set<Long> result = new LinkedHashSet<>(deletedRoomIds);
        result.addAll(replacedRoomIds.keySet());
        result.addAll(mergedRoomIds);
        return Set.copyOf(result);
    }

    private static Map<Long, List<Room>> immutableRoomLists(Map<Long, List<Room>> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Room>> entry : source.entrySet()) {
            if (entry.getKey() != null) {
                result.put(entry.getKey(), entry.getValue() == null ? List.of() : List.copyOf(entry.getValue()));
            }
        }
        return Map.copyOf(result);
    }
}
