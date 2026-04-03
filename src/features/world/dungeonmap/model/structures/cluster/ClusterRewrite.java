package features.world.dungeonmap.model.structures.cluster;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record ClusterRewrite(
        Long targetClusterId,
        CellCoord clusterCenter,
        List<Room> rooms,
        List<InternalBoundaryEdge> persistedBoundaries,
        Set<Long> deletedRoomIds,
        Map<Long, Long> replacedRoomIds,
        Set<Long> mergedRoomIds,
        Set<Long> deletedClusterIds,
        Map<Long, List<Room>> splitFragmentsBySourceRoomId,
        List<ClusterRewriteSplit> splitClusters,
        boolean topologyChanged
) {
    // Null-intolerant: use builder() or unchanged() factories which handle null gracefully.
    public ClusterRewrite {
        rooms = List.copyOf(rooms);
        persistedBoundaries = List.copyOf(persistedBoundaries);
        deletedRoomIds = Set.copyOf(deletedRoomIds);
        replacedRoomIds = Map.copyOf(replacedRoomIds);
        mergedRoomIds = Set.copyOf(mergedRoomIds);
        deletedClusterIds = Set.copyOf(deletedClusterIds);
        splitFragmentsBySourceRoomId = immutableRoomLists(splitFragmentsBySourceRoomId);
        splitClusters = List.copyOf(splitClusters);
    }

    public static Builder builder(
            Long targetClusterId,
            CellCoord clusterCenter,
            List<Room> rooms,
            List<InternalBoundaryEdge> persistedBoundaries
    ) {
        return new Builder(targetClusterId, clusterCenter, rooms, persistedBoundaries);
    }

    public static ClusterRewrite unchanged(
            Long targetClusterId,
            CellCoord clusterCenter,
            List<Room> rooms,
            List<InternalBoundaryEdge> persistedBoundaries
    ) {
        return builder(targetClusterId, clusterCenter, rooms, persistedBoundaries).build();
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
                && deletedClusterIds.isEmpty()
                && splitFragmentsBySourceRoomId.isEmpty()
                && splitClusters.isEmpty();
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
        for (ClusterRewriteSplit splitCluster : splitClusters) {
            for (Room room : splitCluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return Set.copyOf(result);
    }

    public ClusterRewrite withSplitClusters(List<ClusterRewriteSplit> splitClusters) {
        return builder(targetClusterId, clusterCenter, rooms, persistedBoundaries)
                .deletedRoomIds(deletedRoomIds)
                .replacedRoomIds(replacedRoomIds)
                .mergedRoomIds(mergedRoomIds)
                .deletedClusterIds(deletedClusterIds)
                .splitFragmentsBySourceRoomId(splitFragmentsBySourceRoomId)
                .splitClusters(splitClusters)
                .topologyChanged(topologyChanged)
                .build();
    }

    public static final class Builder {
        private final Long targetClusterId;
        private final CellCoord clusterCenter;
        private final List<Room> rooms;
        private final List<InternalBoundaryEdge> persistedBoundaries;
        private Set<Long> deletedRoomIds = Set.of();
        private Map<Long, Long> replacedRoomIds = Map.of();
        private Set<Long> mergedRoomIds = Set.of();
        private Set<Long> deletedClusterIds = Set.of();
        private Map<Long, List<Room>> splitFragmentsBySourceRoomId = Map.of();
        private List<ClusterRewriteSplit> splitClusters = List.of();
        private boolean topologyChanged;

        private Builder(
                Long targetClusterId,
                CellCoord clusterCenter,
                List<Room> rooms,
                List<InternalBoundaryEdge> persistedBoundaries
        ) {
            this.targetClusterId = targetClusterId;
            this.clusterCenter = clusterCenter;
            this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
            this.persistedBoundaries = persistedBoundaries == null ? List.of() : List.copyOf(persistedBoundaries);
        }

        public Builder deletedRoomIds(Set<Long> deletedRoomIds) {
            this.deletedRoomIds = deletedRoomIds == null ? Set.of() : Set.copyOf(deletedRoomIds);
            return this;
        }

        public Builder replacedRoomIds(Map<Long, Long> replacedRoomIds) {
            this.replacedRoomIds = replacedRoomIds == null ? Map.of() : Map.copyOf(replacedRoomIds);
            return this;
        }

        public Builder mergedRoomIds(Set<Long> mergedRoomIds) {
            this.mergedRoomIds = mergedRoomIds == null ? Set.of() : Set.copyOf(mergedRoomIds);
            return this;
        }

        public Builder deletedClusterIds(Set<Long> deletedClusterIds) {
            this.deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
            return this;
        }

        public Builder splitFragmentsBySourceRoomId(Map<Long, List<Room>> splitFragmentsBySourceRoomId) {
            this.splitFragmentsBySourceRoomId = splitFragmentsBySourceRoomId == null
                    ? Map.of()
                    : immutableRoomLists(splitFragmentsBySourceRoomId);
            return this;
        }

        public Builder splitClusters(List<ClusterRewriteSplit> splitClusters) {
            this.splitClusters = splitClusters == null ? List.of() : List.copyOf(splitClusters);
            return this;
        }

        public Builder topologyChanged(boolean topologyChanged) {
            this.topologyChanged = topologyChanged;
            return this;
        }

        public ClusterRewrite build() {
            return new ClusterRewrite(
                    targetClusterId,
                    clusterCenter,
                    rooms,
                    persistedBoundaries,
                    deletedRoomIds,
                    replacedRoomIds,
                    mergedRoomIds,
                    deletedClusterIds,
                    splitFragmentsBySourceRoomId,
                    splitClusters,
                    topologyChanged);
        }
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
