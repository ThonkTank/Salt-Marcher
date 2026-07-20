package features.dungeon.domain.core.structure.topology;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.structure.room.RoomCluster;

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
        List<RoomCluster> roomClusters
) {
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

    public SpatialTopology withRoomClusters(List<RoomCluster> clusters) {
        return new SpatialTopology(topology, width, height, roomAnchorQ, roomAnchorR, clusters);
    }

    public @Nullable RoomCluster roomCluster(long clusterId) {
        for (RoomCluster cluster : roomClusters) {
            if (cluster.clusterId() == clusterId) {
                return cluster;
            }
        }
        return null;
    }

    public SpatialTopology withExactRoomClusterChange(
            @Nullable RoomCluster before,
            @Nullable RoomCluster after
    ) {
        RoomCluster identity = after == null ? before : after;
        if (identity == null) {
            throw new IllegalArgumentException("room cluster change requires identity");
        }
        if (!Objects.equals(roomCluster(identity.clusterId()), before)) {
            throw new IllegalStateException("room cluster patch does not match current authored truth");
        }
        List<RoomCluster> nextClusters = new java.util.ArrayList<>();
        for (RoomCluster cluster : roomClusters) {
            if (cluster.clusterId() == identity.clusterId()) {
                if (after != null) {
                    nextClusters.add(after);
                }
            } else {
                nextClusters.add(cluster);
            }
        }
        if (before == null && after != null) {
            nextClusters.add(after);
        }
        return withRoomClusters(nextClusters);
    }

    public boolean hasAuthoredRooms() {
        return !roomClusters.isEmpty();
    }
}
