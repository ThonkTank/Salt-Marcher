package features.world.dungeonmap.rooms.model;
import features.world.dungeonmap.foundation.geometry.Point2i;


public record DungeonClusterEdgeRef(
        long clusterId,
        Point2i cell,
        DungeonRoomCluster.EdgeDirection direction
) {
    public DungeonRoomCluster.EdgeOverride toEdgeOverride(
            DungeonRoomCluster cluster,
            DungeonRoomCluster.EdgeType edgeType
    ) {
        return DungeonRoomCluster.EdgeOverride.relativeToCluster(cluster, cell, direction, edgeType);
    }
}
