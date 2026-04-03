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
        Set<Long> deletedRoomIds,
        Set<Long> deletedClusterIds,
        List<ClusterRewriteSplit> splitClusters,
        boolean topologyChanged
) {
    // Null-intolerant: use builder() or unchanged() factories which handle null gracefully.
    public ClusterRewrite {
        rooms = List.copyOf(rooms);
        deletedRoomIds = Set.copyOf(deletedRoomIds);
        deletedClusterIds = Set.copyOf(deletedClusterIds);
        splitClusters = List.copyOf(splitClusters);
    }

    public static Builder builder(
            Long targetClusterId,
            CellCoord clusterCenter,
            List<Room> rooms
    ) {
        return new Builder(targetClusterId, clusterCenter, rooms);
    }

    public static ClusterRewrite unchanged(
            Long targetClusterId,
            CellCoord clusterCenter,
            List<Room> rooms
    ) {
        return builder(targetClusterId, clusterCenter, rooms).build();
    }

    public boolean deletesCluster() {
        return targetClusterId != null && deletedClusterIds.contains(targetClusterId);
    }

    public boolean isNoOp() {
        return !topologyChanged
                && !deletesCluster()
                && deletedRoomIds.isEmpty()
                && deletedClusterIds.isEmpty()
                && splitClusters.isEmpty();
    }

    public ClusterRewrite withSplitClusters(List<ClusterRewriteSplit> splitClusters) {
        return builder(targetClusterId, clusterCenter, rooms)
                .deletedRoomIds(deletedRoomIds)
                .deletedClusterIds(deletedClusterIds)
                .splitClusters(splitClusters)
                .topologyChanged(topologyChanged)
                .build();
    }

    public static final class Builder {
        private final Long targetClusterId;
        private final CellCoord clusterCenter;
        private final List<Room> rooms;
        private Set<Long> deletedRoomIds = Set.of();
        private Set<Long> deletedClusterIds = Set.of();
        private List<ClusterRewriteSplit> splitClusters = List.of();
        private boolean topologyChanged;

        private Builder(
                Long targetClusterId,
                CellCoord clusterCenter,
                List<Room> rooms
        ) {
            this.targetClusterId = targetClusterId;
            this.clusterCenter = clusterCenter;
            this.rooms = rooms == null ? List.of() : List.copyOf(rooms);
        }

        public Builder deletedRoomIds(Set<Long> deletedRoomIds) {
            this.deletedRoomIds = deletedRoomIds == null ? Set.of() : Set.copyOf(deletedRoomIds);
            return this;
        }

        public Builder deletedClusterIds(Set<Long> deletedClusterIds) {
            this.deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
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
                    deletedRoomIds,
                    deletedClusterIds,
                    splitClusters,
                    topologyChanged);
        }
    }
}
