package src.domain.dungeon.model.map.model;

import src.domain.dungeon.model.map.model.DungeonRoomCluster;

import java.util.List;

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

    public SpatialTopology moveRoomAnchor(int deltaQ, int deltaR) {
        return new SpatialTopology(
                topology,
                width,
                height,
                roomAnchorQ + deltaQ,
                roomAnchorR + deltaR,
                roomClusters);
    }

    public SpatialTopology withRoomClusters(List<DungeonRoomCluster> clusters) {
        return new SpatialTopology(topology, width, height, roomAnchorQ, roomAnchorR, clusters);
    }

    public boolean hasAuthoredRooms() {
        return !roomClusters.isEmpty();
    }
}
