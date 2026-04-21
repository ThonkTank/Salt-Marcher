package src.domain.dungeon.map.value;

import src.domain.dungeon.map.entity.DungeonRoomCluster;

import java.util.ArrayList;
import java.util.List;

/**
 * Minimal authored spatial truth for the current dungeon parity foundation.
 *
 * <p>The full topology model will grow around rooms, clusters, corridors,
 * stairs, and transitions. These seed facts keep the existing surfaces
 * functional while the legacy behavior is moved behind the aggregate
 * boundary.</p>
 */
public record SpatialTopology(
        DungeonTopology topology,
        int width,
        int height,
        int roomAnchorQ,
        int roomAnchorR,
        List<DungeonRoomCluster> roomClusters
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
        return demo();
    }

    public static SpatialTopology demo() {
        return new SpatialTopology(DungeonTopology.SQUARE, 10, 8, 2, 2);
    }

    public SpatialTopology moveRoomAnchor(int deltaQ, int deltaR) {
        return new SpatialTopology(
                topology,
                width,
                height,
                roomAnchorQ + deltaQ,
                roomAnchorR + deltaR,
                roomClusters);
    }

    public SpatialTopology moveRoomCluster(long clusterId, int deltaQ, int deltaR) {
        if (clusterId <= 0L || (deltaQ == 0 && deltaR == 0)) {
            return this;
        }
        List<DungeonRoomCluster> movedClusters = new ArrayList<>();
        boolean changed = false;
        for (DungeonRoomCluster cluster : roomClusters) {
            if (cluster.clusterId() == clusterId) {
                movedClusters.add(cluster.movedBy(deltaQ, deltaR));
                changed = true;
            } else {
                movedClusters.add(cluster);
            }
        }
        return changed ? withRoomClusters(movedClusters) : this;
    }

    public SpatialTopology withRoomClusters(List<DungeonRoomCluster> clusters) {
        return new SpatialTopology(topology, width, height, roomAnchorQ, roomAnchorR, clusters);
    }

    public boolean hasAuthoredRooms() {
        return !roomClusters.isEmpty();
    }
}
