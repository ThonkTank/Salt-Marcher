package features.dungeon.domain.core.structure.topology;

import java.util.List;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.structure.room.DungeonRoomCluster;

/**
 * Minimal authored spatial truth for the current dungeon parity foundation.
 *
 * <p>The full topology model grows around rooms, clusters, corridors, stairs,
 * and transitions. Empty maps keep only grid bounds until authored geometry is
 * created.</p>
 */
public record SpatialTopology(
        DungeonTopology topology,
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR,
        List<DungeonRoomCluster> roomClusters
) {
    private static final long NO_CLUSTER_ID = 0L;

    public SpatialTopology(
            DungeonTopology topology,
            int width,
            int height,
            int roomAnchorQ,
            int roomAnchorR
    ) {
        this(topology, width, height, roomAnchorQ, roomAnchorR, List.of());
    }

    public SpatialTopology {
        topology = topology == null ? DungeonTopology.SQUARE : topology;
        width = Math.max(6, width);
        height = Math.max(6, height);
        roomAnchorQ = Math.max(1, Math.min(width - 4, roomAnchorQ));
        roomAnchorR = Math.max(1, Math.min(height - 4, roomAnchorR));
        roomClusters = roomClusters == null ? List.of() : List.copyOf(roomClusters);
    }

    public static SpatialTopology empty() {
        return defaultGrid();
    }

    public static SpatialTopology defaultGrid() {
        return new SpatialTopology(DungeonTopology.SQUARE, 10, 8, 2, 2);
    }

    public SpatialTopology withRoomClusters(List<DungeonRoomCluster> clusters) {
        return new SpatialTopology(topology, width, height, roomAnchorQ, roomAnchorR, clusters);
    }

    public SpatialTopology withRoomClusterName(long clusterId, String name) {
        if (clusterId <= NO_CLUSTER_ID) {
            return this;
        }
        List<DungeonRoomCluster> nextClusters = new java.util.ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster cluster : roomClusters) {
            if (cluster.clusterId() == clusterId) {
                DungeonRoomCluster renamed = cluster.withName(name);
                nextClusters.add(renamed);
                changed = changed || !renamed.equals(cluster);
            } else {
                nextClusters.add(cluster);
            }
        }
        return changed ? withRoomClusters(nextClusters) : this;
    }

    public boolean hasAuthoredRooms() {
        return !roomClusters.isEmpty();
    }
}
